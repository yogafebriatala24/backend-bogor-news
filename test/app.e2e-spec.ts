import { Body, Controller, Get, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import request from 'supertest';
import type { App } from 'supertest/types';
import { setupHttp } from '../src/common/http/setup';
import { CreateArticleDto } from '../src/modules/articles/articles.dto';
import { AuthGuard } from '../src/modules/auth/auth.guard';
import { AuthService } from '../src/modules/auth/auth.service';
import { Permissions, Public } from '../src/common/auth/security';
import { Page } from '../src/common/http/response.interceptor';
@Controller('contract')
class ContractController {
  @Public() @Get() list() {
    return new Page([{ id: 'one' }], { nextCursor: null });
  }
  @Public() @Post() create(@Body() dto: CreateArticleDto) {
    return { title: dto.title };
  }
  @Public() @Get('error') fail() {
    throw new Error('mongodb://secret:password@internal');
  }
  @Public() @Get('duplicate') duplicate() {
    throw Object.assign(new Error('secret query'), { code: 11000 });
  }
  @Get('private') privateRoute() {
    return { ok: true };
  }
  @Permissions('article:publish') @Post('publish') publish() {
    return { ok: true };
  }
}
interface Envelope {
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string; details?: string[] };
  meta: { requestId: string; timestamp: string; nextCursor?: string | null };
}
describe('HTTP contract (e2e, no external databases)', () => {
  let app: INestApplication<App>;
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ContractController],
      providers: [
        {
          provide: ConfigService,
          useValue: new ConfigService({
            CORS_ORIGINS: 'http://localhost:3000',
          }),
        },
        {
          provide: AuthService,
          useValue: { authenticate: () => Promise.resolve({ role: 'writer' }) },
        },
        { provide: APP_GUARD, useClass: AuthGuard },
      ],
    }).compile();
    app = module.createNestApplication();
    app.useLogger(false);
    setupHttp(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('wraps collections and returns a correlation header', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/contract')
      .expect(200);
    const body = res.body as Envelope;
    expect(body.success).toBe(true);
    expect(body.data).toEqual([{ id: 'one' }]);
    expect(body.meta.nextCursor).toBeNull();
    expect(body.meta.requestId).toBe(res.headers['x-request-id']);
  });
  it('rejects missing required article fields', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/contract')
      .send({ title: 'Test article' })
      .expect(400);
    const body = res.body as Envelope;
    expect(body.error?.code).toBe('VALIDATION_ERROR');
    expect(body.error?.details).toEqual(
      expect.arrayContaining([expect.stringContaining('content')]),
    );
  });
  it('validates nested fields and rejects injected privilege fields', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/contract')
      .send({
        title: 'Test article',
        slug: 'test-article',
        categoryId: '507f1f77bcf86cd799439011',
        content: { version: 1, blocks: [{ type: 'html', text: 'bad' }] },
        status: 'published',
      })
      .expect(400);
    const body = res.body as Envelope;
    expect(body.error?.details?.join(' ')).toContain('status');
    expect(body.error?.details?.join(' ')).toContain('type');
  });
  it('hides unexpected internal error details', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/contract/error')
      .expect(500);
    const body = res.body as Envelope;
    expect(body.error?.code).toBe('INTERNAL_SERVER_ERROR');
    expect(JSON.stringify(body)).not.toContain('secret');
  });
  it('maps uniqueness conflicts to 409', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/contract/duplicate')
      .expect(409);
    expect((res.body as Envelope).error?.code).toBe('DUPLICATE_RESOURCE');
  });
  it('requires authentication by default', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/contract/private')
      .expect(401);
    expect((res.body as Envelope).error?.code).toBe('AUTHENTICATION_REQUIRED');
  });
  it('checks permission on protected routes', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/contract/publish')
      .set('Authorization', 'Bearer writer-token')
      .expect(403);
    expect((res.body as Envelope).error?.code).toBe('PERMISSION_DENIED');
  });
  it('rejects malformed JSON with a standard error', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/contract')
      .set('Content-Type', 'application/json')
      .send('{invalid')
      .expect(400);
    expect((res.body as Envelope).success).toBe(false);
  });
  it('returns 413 for oversized JSON bodies', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/contract')
      .send({ content: 'x'.repeat(110000) })
      .expect(413);
    expect((res.body as Envelope).error?.code).toBe('PAYLOAD_TOO_LARGE');
  });
  it('uses the same error envelope for unknown endpoints', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/missing')
      .expect(404);
    expect((res.body as Envelope).success).toBe(false);
  });
});
