// Real-service integration check. Creates and removes only uniquely named test resources.
require('dotenv').config({ quiet: true });
const { randomUUID } = require('node:crypto');
const assert = require('node:assert/strict');
const runId = randomUUID().replaceAll('-', '');
const databaseName = `db-news-test-${runId}`;
const bucketName = `db-news-test-${runId}`;
const uri = new URL(process.env.MONGODB_URI);
uri.pathname = `/${databaseName}`;
process.env.MONGODB_URI = uri.toString();
process.env.MINIO_BUCKET = bucketName;
process.env.REDIS_PREFIX = `media:test:${runId}`;
process.env.NODE_ENV = 'test';
const { NestFactory } = require('@nestjs/core');
const { getConnectionToken } = require('@nestjs/mongoose');
const { AppModule } = require('../dist/app.module');
const { setupHttp } = require('../dist/common/http/setup');
const { setupSwagger } = require('../dist/common/swagger/setup-swagger');
const { CacheService } = require('../dist/infrastructure/cache/cache.service');
const argon2 = require('argon2');
const { Client } = require('minio');
const minio = new Client({ endPoint: process.env.MINIO_ENDPOINT, port: Number(process.env.MINIO_PORT), useSSL: process.env.MINIO_USE_SSL === 'true', accessKey: process.env.MINIO_ACCESS_KEY, secretKey: process.env.MINIO_SECRET_KEY });
let checks = 0;
async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const connection = app.get(getConnectionToken());
  const cache = app.get(CacheService);
  try {
    setupHttp(app);
    setupSwagger(app);
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    await Promise.all(Object.values(connection.models).map(model => model.init()));
    async function api(method, path, body, token, status = 200) {
      const response = await fetch(`${base}${path}`, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const result = await response.json();
      assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(result)}`);
      assert.equal(result.success, status < 400);
      assert.equal(result.meta.requestId, response.headers.get('x-request-id'));
      checks++;
      return result;
    }
    const docsPage = await fetch(`${base}/docs/`);
    assert.equal(docsPage.status, 200);
    assert.ok((await docsPage.text()).includes('swagger-ui'));
    assert.ok(!docsPage.headers.get('content-security-policy').includes('upgrade-insecure-requests'));
    const docsAsset = await fetch(`${base}/docs/swagger-ui-init.js`);
    assert.equal(docsAsset.status, 200);
    const spec = await fetch(`${base}/docs-json`);
    assert.equal(spec.status, 200);
    assert.ok((await spec.json()).paths['/api/v1/auth/login']);
    console.log('PASS: Swagger UI, assets and OpenAPI JSON are accessible.');
    await api('GET', '/health/ready');
    const password = `Test-${randomUUID()}`;
    const admin = await connection.models.User.create({ name: 'Smoke Admin', email: 'admin@example.test', role: 'superadmin', passwordHash: await argon2.hash(password), active: true });
    const login = (await api('POST', '/api/v1/auth/login', { email: admin.email, password })).data;
    const token = login.accessToken;
    await api('GET', '/api/v1/auth/me', undefined, token);
    await api('POST', '/api/v1/admin/users', { name: 'Smoke Writer', email: 'writer@example.test', password, role: 'writer' }, token, 201);
    const writer = (await api('POST', '/api/v1/auth/login', { email: 'writer@example.test', password })).data.accessToken;
    await api('POST', '/api/v1/admin/users', { name: 'Not allowed', email: 'forbidden@example.test', password, role: 'admin' }, writer, 403);
    const category = (await api('POST', '/api/v1/admin/categories', { name: 'News', slug: 'news' }, token, 201)).data;
    const tag = (await api('POST', '/api/v1/admin/tags', { name: 'Local', slug: 'local' }, token, 201)).data;
    await api('POST', '/api/v1/admin/categories', { name: 'Duplicate', slug: 'news' }, token, 409);
    await api('POST', '/api/v1/admin/articles', { title: 'Invalid' }, token, 400);
    const body = { title: 'Local backend integration', slug: 'local-backend-integration', excerpt: 'Integration check', categoryId: category.id, tagIds: [tag.id], content: { version: 1, blocks: [{ type: 'paragraph', text: 'A test article.' }] } };
    let article = (await api('POST', '/api/v1/admin/articles', body, writer, 201)).data;
    await api('GET', `/api/v1/articles/${article.slug}`, undefined, undefined, 404);
    await api('POST', `/api/v1/admin/articles/${article.id}/publish`, { revision: article.revision }, writer, 403);
    await api('POST', `/api/v1/admin/articles/${article.id}/publish`, { revision: article.revision }, token, 409);
    article = (await api('POST', `/api/v1/admin/articles/${article.id}/review`, { revision: article.revision }, writer)).data;
    await api('PATCH', `/api/v1/admin/articles/${article.id}`, { revision: article.revision, title: 'Cannot edit during review' }, writer, 403);
    article = (await api('POST', `/api/v1/admin/articles/${article.id}/publish`, { revision: article.revision }, token)).data;
    await api('PATCH', `/api/v1/admin/articles/${article.id}`, { revision: 1, title: 'Stale revision' }, token, 409);
    await api('GET', `/api/v1/articles/${article.slug}`);
    await api('GET', `/api/v1/articles/${article.slug}`);
    const cached = await cache.get(`article:${article.id}:v${article.revision}`);
    assert.ok(cached, 'article cache populated');
    await api('GET', `/api/v1/categories/news/articles`);
    await api('GET', `/api/v1/tags/local/articles`);
    await api('GET', `/api/v1/articles?cursor=invalid`, undefined, undefined, 400);
    // Equal timestamps exercise the ObjectId tie-breaker in cursor pagination.
    const second = await connection.models.Article.create({ ...body, slug: 'second-article', authorId: admin._id, authorSnapshot: { id: admin.id, name: admin.name }, categorySnapshot: { id: category.id, name: category.name, slug: category.slug }, status: 'published', publishedAt: new Date(article.publishedAt) });
    const firstPage = await api('GET', '/api/v1/articles?limit=1');
    assert.ok(firstPage.meta.nextCursor);
    const secondPage = await api('GET', `/api/v1/articles?limit=1&cursor=${firstPage.meta.nextCursor}`);
    assert.equal(secondPage.data.length, 1);
    assert.notEqual(firstPage.data[0].id, secondPage.data[0].id);
    await api('PATCH', `/api/v1/admin/articles/${second.id}`, { revision: 1, title: 'Not my article' }, writer, 403);
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a9xkAAAAASUVORK5CYII=', 'base64');
    const intent = (await api('POST', '/api/v1/admin/media/upload-url', { filename: 'test.png', mimeType: 'image/png', size: image.length }, writer, 201)).data;
    const form = new FormData();
    for (const [key, value] of Object.entries(intent.fields)) form.append(key, value);
    form.append('file', new Blob([image], { type: 'image/png' }), 'test.png');
    const uploaded = await fetch(intent.url, { method: 'POST', body: form });
    assert.ok(uploaded.ok, `MinIO upload: ${uploaded.status} ${await uploaded.text()}`);
    const completed = (await api('POST', '/api/v1/admin/media/complete', { mediaId: intent.mediaId }, writer, 201)).data;
    assert.equal(completed.status, 'complete');
    await api('POST', '/api/v1/admin/media/complete', { mediaId: intent.mediaId }, writer, 201);
    const download = (await api('GET', `/api/v1/admin/media/${intent.mediaId}/download-url`, undefined, writer)).data;
    const downloaded = await fetch(download.url);
    assert.ok(downloaded.ok);
    assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()), image);
    article = (await api('PATCH', `/api/v1/admin/articles/${article.id}`, { revision: article.revision, thumbnailId: intent.mediaId }, token)).data;
    const publicArticle = (await api('GET', `/api/v1/articles/${article.slug}`)).data;
    assert.ok(publicArticle.thumbnail.url);
    assert.equal(publicArticle.status, undefined);
    await api('POST', `/api/v1/admin/articles/${article.id}/archive`, { revision: article.revision }, token);
    await api('GET', `/api/v1/articles/${article.slug}`, undefined, undefined, 404);
    const refreshed = (await api('POST', '/api/v1/auth/refresh', { refreshToken: login.refreshToken })).data;
    await api('POST', '/api/v1/auth/refresh', { refreshToken: login.refreshToken }, undefined, 401);
    await api('POST', '/api/v1/auth/logout', {}, refreshed.accessToken);
    await api('GET', '/api/v1/auth/me', undefined, refreshed.accessToken, 401);
    console.log(`PASS: ${checks} API checks, real MongoDB indexes/cursor pagination, Redis cache, MinIO upload/download, refresh rotation and logout.`);
  } finally {
    // Cleanup is restricted to the unique resources generated by this invocation.
    if (connection.name === databaseName && databaseName.startsWith('db-news-test-')) await connection.dropDatabase();
    let cursor = '0';
    do { const [next, keys] = await cache.client.scan(cursor, 'MATCH', `${process.env.REDIS_PREFIX}:*`, 'COUNT', 100); cursor = next; if (keys.length) await cache.client.del(...keys); } while (cursor !== '0');
    if (bucketName.startsWith('db-news-test-') && await minio.bucketExists(bucketName)) {
      for await (const object of minio.listObjectsV2(bucketName, '', true)) { if (object.name) await minio.removeObject(bucketName, object.name); }
      await minio.removeBucket(bucketName);
    }
    await app.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
