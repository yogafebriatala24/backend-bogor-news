# Panduan Arsitektur Backend Website Media Massa

> Panduan dasar untuk membangun backend media massa yang scalable, maintainable, aman, dan tetap nyaman dikembangkan dalam jangka panjang.

---

## 1. Tujuan Arsitektur

Arsitektur ini dirancang untuk website media massa dengan karakteristik:

- Traffic baca jauh lebih tinggi dibanding traffic tulis.
- Artikel dapat terus bertambah hingga ratusan ribu atau jutaan dokumen.
- Membutuhkan pencarian cepat.
- Membutuhkan kategori, tag, author, media, komentar, view, trending, dan statistik.
- Membutuhkan dashboard editor/admin.
- Membutuhkan cache agar database tidak menerima semua request.
- Membutuhkan background worker untuk pekerjaan berat.
- Membutuhkan object storage untuk image/video.
- Harus dapat berkembang tanpa langsung memakai microservices.

Prinsip utama:

1. Mulai dengan **modular monolith**.
2. Gunakan **MongoDB** sebagai source of truth.
3. Gunakan **Redis** untuk cache dan data high-frequency.
4. Gunakan **BullMQ** untuk background jobs.
5. Gunakan **Meilisearch** untuk search.
6. Gunakan **MinIO** sebagai object storage.
7. API dibuat stateless agar mudah di-scale horizontal.
8. Hindari overengineering di tahap awal.
9. Pisahkan business logic dari infrastructure.
10. Siapkan observability, backup, dan recovery sejak awal.

---

# 2. Stack Utama

## Backend

- Node.js
- TypeScript
- NestJS
- REST API

## Database

- MongoDB
- Mongoose

## Cache

- Redis

## Queue

- BullMQ
- Redis

## Search Engine

Tahap awal:

- Meilisearch

Jika kebutuhan search semakin kompleks:

- OpenSearch

## Object Storage

- MinIO

MinIO digunakan untuk:

- thumbnail
- image artikel
- video
- attachment
- avatar
- media CMS

## Reverse Proxy

- Nginx atau Caddy

## CDN / Edge

Untuk production publik, MinIO sebaiknya tidak langsung diekspos sebagai origin public tanpa lapisan proxy/CDN.

Bisa menggunakan:

- Cloudflare
- Nginx
- CDN lain

## Deployment

- Docker
- Docker Compose untuk tahap awal

## Observability

Minimum:

- Sentry
- Structured logging

Jika sistem berkembang:

- OpenTelemetry
- Prometheus
- Grafana
- Loki

---

# 3. High-Level Architecture

```text
                           Internet
                              |
                              v
                    +-------------------+
                    |    Cloudflare     |
                    | CDN / WAF / Cache |
                    +---------+---------+
                              |
                              v
                    +-------------------+
                    |      Next.js      |
                    | Website / CMS FE  |
                    +---------+---------+
                              |
                           REST API
                              |
                              v
                    +-------------------+
                    |      NestJS       |
                    | Modular Monolith  |
                    +--+-----+-----+----+
                       |     |     |
              +--------+     |     +---------------+
              |              |                     |
              v              v                     v
         +---------+      +-------+            +----------+
         | MongoDB |      | Redis |            | BullMQ   |
         +---------+      +-------+            +-----+----+
                                                      |
                                                      v
                                                 +---------+
                                                 | Workers |
                                                 +----+----+
                                                      |
                            +-------------------------+----------------------+
                            |                         |                      |
                            v                         v                      v
                    +---------------+          +-------------+         +---------+
                    | Meilisearch   |          |   MinIO     |         | Sitemap |
                    | Search Index  |          | Object Store|         | Jobs    |
                    +---------------+          +-------------+         +---------+
```

---

# 4. Kenapa Modular Monolith?

Jangan langsung menggunakan microservices.

Untuk tahap awal hingga skala cukup besar, gunakan satu aplikasi NestJS yang dibagi menjadi modul domain yang jelas.

Contoh:

```text
NestJS Application
|
+-- Auth Module
+-- Users Module
+-- Authors Module
+-- Articles Module
+-- Categories Module
+-- Tags Module
+-- Media Module
+-- Search Module
+-- Comments Module
+-- Analytics Module
+-- Notifications Module
+-- Queue Module
+-- Health Module
```

Keuntungan:

- deployment lebih sederhana;
- debugging lebih mudah;
- development lebih cepat;
- lebih sedikit network call internal;
- business flow lebih mudah diikuti;
- lebih murah secara operasional;
- tetap bisa dipecah menjadi service terpisah di masa depan.

Gunakan microservices hanya jika ada alasan teknis atau organisasi yang nyata.

---

# 5. Struktur Folder NestJS

Struktur yang direkomendasikan:

```text
src/
|
+-- main.ts
+-- app.module.ts
|
+-- config/
|   +-- app.config.ts
|   +-- database.config.ts
|   +-- redis.config.ts
|   +-- storage.config.ts
|   +-- search.config.ts
|
+-- common/
|   +-- decorators/
|   +-- dto/
|   +-- enums/
|   +-- exceptions/
|   +-- filters/
|   +-- guards/
|   +-- interceptors/
|   +-- middleware/
|   +-- pipes/
|   +-- utils/
|
+-- database/
|   +-- database.module.ts
|   +-- migrations/
|
+-- infrastructure/
|   +-- cache/
|   +-- queue/
|   +-- storage/
|   +-- search/
|   +-- logger/
|
+-- modules/
|   +-- auth/
|   +-- users/
|   +-- authors/
|   +-- articles/
|   +-- categories/
|   +-- tags/
|   +-- media/
|   +-- comments/
|   +-- analytics/
|   +-- notifications/
|   +-- health/
|
+-- workers/
    +-- search-index.worker.ts
    +-- analytics.worker.ts
    +-- sitemap.worker.ts
    +-- image.worker.ts
```

Contoh struktur module:

```text
articles/
|
+-- controllers/
|   +-- articles.controller.ts
|
+-- services/
|   +-- articles.service.ts
|
+-- repositories/
|   +-- articles.repository.ts
|
+-- dto/
|   +-- create-article.dto.ts
|   +-- update-article.dto.ts
|   +-- article-query.dto.ts
|
+-- schemas/
|   +-- article.schema.ts
|
+-- interfaces/
+-- constants/
+-- articles.module.ts
```

Gunakan flow:

```text
Controller
    |
    v
Service
    |
    v
Repository
    |
    v
MongoDB
```

Controller tidak boleh menjadi tempat business logic utama.

---

# 6. Domain Utama

## Content

- articles
- categories
- tags
- authors
- media
- article revisions

## User

- users
- roles
- permissions
- sessions

## Engagement

- comments
- bookmarks
- reactions
- views

## Discovery

- search
- related articles
- trending
- recommendations

## Infrastructure

- cache
- queue
- object storage
- logs
- metrics

---

# 7. Desain MongoDB

MongoDB cocok untuk sistem media karena artikel secara natural berbentuk document.

Contoh document article:

```ts
{
  _id: ObjectId,

  title: string,
  slug: string,
  excerpt: string,

  content: {
    version: number,
    blocks: []
  },

  status: "draft" | "review" | "scheduled" | "published" | "archived",

  authorId: ObjectId,
  categoryId: ObjectId,

  authorSnapshot: {
    name: string,
    avatar: string
  },

  categorySnapshot: {
    name: string,
    slug: string
  },

  tags: [
    {
      id: ObjectId,
      name: string,
      slug: string
    }
  ],

  thumbnail: {
    objectKey: string,
    url: string,
    alt: string
  },

  seo: {
    title: string,
    description: string,
    canonicalUrl: string
  },

  publishedAt: Date,
  scheduledAt: Date,

  createdAt: Date,
  updatedAt: Date
}
```

---

# 8. Embed vs Reference

Gunakan pendekatan hybrid.

## Reference

Gunakan reference untuk entity utama:

```ts
authorId
categoryId
```

## Snapshot

Simpan data kecil yang sering dibaca:

```ts
authorSnapshot: {
  name,
  avatar
}
```

Dengan ini frontend tidak perlu melakukan banyak query tambahan.

Jika nama author berubah, pilih salah satu policy:

- snapshot lama tetap dipertahankan sebagai historical snapshot; atau
- snapshot di-update melalui background job.

Pilih satu policy dan gunakan secara konsisten.

---

# 9. Collection Minimum

```text
users
authors
articles
article_revisions
categories
tags
media
comments
bookmarks
notifications
audit_logs
```

Untuk high-frequency event seperti view, jangan langsung tulis satu event ke collection utama pada setiap request.

---

# 10. Index MongoDB

Index harus mengikuti pola query.

Slug:

```js
db.articles.createIndex(
  { slug: 1 },
  { unique: true }
)
```

Latest article:

```js
db.articles.createIndex({
  status: 1,
  publishedAt: -1
})
```

Category listing:

```js
db.articles.createIndex({
  categoryId: 1,
  status: 1,
  publishedAt: -1
})
```

Author listing:

```js
db.articles.createIndex({
  authorId: 1,
  status: 1,
  publishedAt: -1
})
```

Scheduled:

```js
db.articles.createIndex({
  status: 1,
  scheduledAt: 1
})
```

Category slug:

```js
db.categories.createIndex(
  { slug: 1 },
  { unique: true }
)
```

Jangan membuat index ke semua field.

Setiap index memiliki biaya:

- storage;
- memory;
- write performance.

---

# 11. Pagination

Untuk public article listing, jangan bergantung pada offset besar.

Hindari:

```ts
skip(500000).limit(20)
```

Gunakan cursor pagination.

Contoh:

```ts
Article.find({
  status: 'published',
  publishedAt: {
    $lt: cursorDate
  }
})
.sort({
  publishedAt: -1,
  _id: -1
})
.limit(20)
```

Response:

```json
{
  "data": [],
  "meta": {
    "nextCursor": "..."
  }
}
```

Offset pagination masih boleh digunakan untuk dashboard admin jika dataset dan filter relatif kecil.

---

# 12. Redis

Redis digunakan untuk:

- cache;
- view counters;
- rate limiting;
- sessions;
- distributed lock;
- temporary state;
- trending score;
- queue backend.

Contoh key:

```text
media:prod:article:{slug}
media:prod:homepage:v1
media:prod:category:{slug}:{cursor}
media:prod:article:{id}:views
media:prod:trending:1h
```

Gunakan prefix yang konsisten.

---

# 13. Cache Strategy

Gunakan pola cache-aside.

```text
Request
   |
   v
Redis
   |
   +--- HIT ---> Response
   |
   +--- MISS
          |
          v
       MongoDB
          |
          v
        Redis
          |
          v
       Response
```

Pseudo-code:

```ts
const cached = await redis.get(key);

if (cached) {
  return JSON.parse(cached);
}

const article = await repository.findBySlug(slug);

await redis.set(
  key,
  JSON.stringify(article),
  'EX',
  300
);

return article;
```

---

# 14. Cache Invalidation

Saat artikel berubah:

```text
Update Article
      |
      v
MongoDB
      |
      +----> invalidate article cache
      |
      +----> invalidate homepage cache
      |
      +----> invalidate category cache
      |
      +----> queue search re-index
```

Jangan hanya mengandalkan TTL.

Gunakan:

- event-driven invalidation;
- TTL sebagai safety net.

---

# 15. Cache Stampede

Untuk artikel viral, banyak request bisa mengalami cache miss bersamaan.

Gunakan:

- distributed lock;
- stale-while-revalidate;
- request coalescing.

Tujuan:

```text
1000 cache miss
      |
      v
1 request -> MongoDB
999 request -> stale cache / menunggu
```

---

# 16. View Counter

Jangan update MongoDB pada setiap page view.

Hindari:

```ts
await Article.updateOne(
  { _id: articleId },
  { $inc: { views: 1 } }
)
```

Gunakan Redis:

```text
INCR media:prod:article:{id}:views
```

Kemudian worker melakukan batch persist.

```text
Redis
  |
  v
Analytics Worker
  |
  v
MongoDB / analytics storage
```

---

# 17. Trending

Trending sebaiknya dihitung menggunakan Redis Sorted Set.

Contoh:

```text
ZINCRBY media:prod:trending:1h 1 article-id
```

Score dapat dikembangkan:

```text
view     = 1
comment  = 3
bookmark = 4
share    = 5
```

Gunakan decay berdasarkan waktu agar artikel lama tidak mendominasi terus-menerus.

---

# 18. BullMQ

Gunakan BullMQ untuk pekerjaan asynchronous.

Contoh:

- search indexing;
- image processing;
- sitemap generation;
- scheduled publish;
- email;
- push notification;
- analytics aggregation;
- trending calculation;
- cache purge;
- snapshot update.

Publish flow:

```text
POST /articles/:id/publish
          |
          v
       MongoDB
          |
          v
      HTTP Response
          |
          +----> search queue
          +----> sitemap queue
          +----> notification queue
          +----> cache invalidation
```

---

# 19. Queue Design

Jangan satu queue untuk seluruh pekerjaan.

Gunakan queue per domain:

```text
content
search
analytics
media
notifications
maintenance
```

Contoh job:

```text
search:index-article
search:remove-article

analytics:aggregate-views

media:process-image

content:publish-scheduled

maintenance:generate-sitemap
```

---

# 20. Job Harus Idempotent

Worker dapat menjalankan ulang job.

Maka job seperti:

```text
index article 123
```

harus aman jika dieksekusi dua kali.

Gunakan deterministic job ID jika dibutuhkan.

---

# 21. Retry dan Failed Job

External service dapat gagal.

Gunakan retry dengan exponential backoff.

Contoh:

```text
attempt 1
  |
5 sec
  |
attempt 2
  |
30 sec
  |
attempt 3
```

Job yang gagal permanen harus tercatat dan bisa di-replay.

---

# 22. Search Architecture

Jangan menggunakan regex MongoDB sebagai full-text search production utama.

Gunakan:

```text
MongoDB
   |
publish/update
   |
   v
BullMQ
   |
   v
Search Worker
   |
   v
Meilisearch
```

Request search:

```text
Frontend
   |
GET /api/v1/search?q=ekonomi
   |
NestJS
   |
Meilisearch
```

MongoDB tetap menjadi source of truth.

Meilisearch hanya index.

---

# 23. Search Document

Index hanya field yang dibutuhkan.

Contoh:

```ts
{
  id,
  title,
  slug,
  excerpt,
  author,
  category,
  tags,
  thumbnail,
  publishedAt
}
```

Jangan memasukkan seluruh content mentah jika tidak diperlukan.

---

# 24. MinIO

MinIO menjadi object storage utama.

Digunakan untuk:

```text
article-images
article-videos
thumbnails
avatars
attachments
cms-assets
```

Jangan menyimpan binary file langsung di MongoDB untuk kebutuhan umum.

MongoDB hanya menyimpan metadata.

Contoh:

```ts
{
  objectKey: "articles/2026/10/article-123/image.webp",
  bucket: "media",
  mimeType: "image/webp",
  size: 238123,
  width: 1200,
  height: 675,
  checksum: "...",
  createdAt: Date
}
```

---

# 25. Struktur Bucket MinIO

Jangan membuat bucket per user atau per article.

Gunakan bucket berdasarkan fungsi.

Contoh:

```text
media-public
media-private
backups
```

Di dalam bucket:

```text
articles/
authors/
avatars/
attachments/
temporary/
```

Contoh object key:

```text
articles/2026/10/{articleId}/original/image.jpg
articles/2026/10/{articleId}/1200/image.webp
articles/2026/10/{articleId}/768/image.webp
articles/2026/10/{articleId}/400/image.webp
```

Gunakan object key yang deterministic dan mudah di-debug.

---

# 26. Public dan Private Bucket

## Public

Untuk:

- article image;
- thumbnail;
- public avatar.

## Private

Untuk:

- draft attachment;
- internal document;
- file editorial;
- export admin.

Akses private object menggunakan presigned URL.

---

# 27. Upload ke MinIO

Untuk upload file besar, frontend sebaiknya upload langsung ke MinIO menggunakan presigned URL.

Flow:

```text
Frontend
   |
   | request upload URL
   v
NestJS
   |
   | generate presigned URL
   v
MinIO

Frontend ------------------> MinIO
         direct upload
```

Dengan demikian file besar tidak perlu melewati memory NestJS.

---

# 28. Upload Flow yang Direkomendasikan

1. Frontend request upload intent.
2. Backend memvalidasi:
   - user;
   - role;
   - filename;
   - MIME;
   - size;
   - destination type.
3. Backend generate object key.
4. Backend generate presigned URL.
5. Frontend upload ke MinIO.
6. Frontend memberi tahu backend upload selesai.
7. Backend melakukan verification.
8. Backend membuat record media.
9. Jika image, enqueue processing job.

Contoh endpoint:

```text
POST /api/v1/admin/media/upload-url
POST /api/v1/admin/media/complete
```

---

# 29. Image Processing

Simpan original.

Generate beberapa variant.

Contoh:

```text
original
1200
768
400
```

Format output bisa menggunakan WebP atau AVIF sesuai kebutuhan frontend.

Flow:

```text
Original Uploaded
       |
       v
Media Queue
       |
       v
Image Worker
       |
       +----> resize 1200
       +----> resize 768
       +----> resize 400
       |
       v
MinIO
```

Jangan melakukan image processing berat di request utama.

---

# 30. MinIO Endpoint Strategy

Pisahkan:

```text
Internal MinIO API
Public Media Domain
```

Contoh:

```text
minio.internal.local
media.example.com
```

Aplikasi backend berbicara ke MinIO melalui network internal.

Public reader mengakses image melalui:

```text
media.example.com
```

yang berada di depan MinIO melalui reverse proxy/CDN.

---

# 31. MinIO Production

Untuk production jangka panjang:

- gunakan disk terpisah;
- hindari single disk jika data penting;
- gunakan erasure coding/distributed deployment sesuai kebutuhan;
- aktifkan versioning untuk bucket penting;
- monitor disk;
- siapkan replication/backup;
- jangan menganggap MinIO sebagai backup.

Object storage tetap perlu backup atau replication strategy.

---

# 32. Authentication

Pisahkan:

```text
Public API
CMS/Admin API
```

Role awal:

```text
superadmin
admin
editor
writer
```

Untuk jangka panjang gunakan permissions.

Contoh:

```text
article:create
article:update
article:review
article:publish
article:delete

category:manage
media:upload
user:manage
```

---

# 33. Token Strategy

Untuk dashboard berbasis browser, rekomendasi:

```text
Access Token
+
Refresh Token
```

Gunakan HttpOnly Secure cookie jika arsitektur frontend dan backend memungkinkan.

Cookie production:

```text
HttpOnly
Secure
SameSite
```

Jangan menyimpan secret pada frontend.

---

# 34. Password

Gunakan:

```text
Argon2id
```

Jangan gunakan:

```text
MD5
SHA1
SHA256(password)
```

SHA-256 bukan password hashing algorithm.

---

# 35. Authorization

Semua permission dicek backend.

Frontend hanya untuk UX.

Contoh:

```ts
@Permissions('article:publish')
@Post(':id/publish')
publishArticle() {}
```

---

# 36. Validation

Gunakan DTO.

```text
DTO
+
class-validator
+
ValidationPipe
```

Global:

```ts
new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true
})
```

---

# 37. Rate Limiting

Prioritaskan:

```text
login
forgot password
search
comments
upload intent
public API
```

Gunakan Redis-backed rate limit jika API memiliki banyak instance.

---

# 38. API Response Format

Success:

```json
{
  "success": true,
  "data": {}
}
```

Collection:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "nextCursor": "..."
  }
}
```

Error:

```json
{
  "success": false,
  "error": {
    "code": "ARTICLE_NOT_FOUND",
    "message": "Article not found"
  }
}
```

---

# 39. API Versioning

Gunakan version sejak awal.

```text
/api/v1/articles
/api/v1/categories
/api/v1/search
```

Versioning memberi ruang untuk breaking changes di masa depan.

---

# 40. REST Endpoint Awal

Public:

```text
GET /api/v1/articles
GET /api/v1/articles/:slug

GET /api/v1/categories
GET /api/v1/categories/:slug/articles

GET /api/v1/tags/:slug/articles

GET /api/v1/search
GET /api/v1/trending
```

CMS:

```text
POST   /api/v1/admin/articles
PATCH  /api/v1/admin/articles/:id
DELETE /api/v1/admin/articles/:id

POST /api/v1/admin/articles/:id/review
POST /api/v1/admin/articles/:id/publish
POST /api/v1/admin/articles/:id/schedule
POST /api/v1/admin/articles/:id/archive
```

Media:

```text
POST /api/v1/admin/media/upload-url
POST /api/v1/admin/media/complete
DELETE /api/v1/admin/media/:id
```

---

# 41. Article Lifecycle

Gunakan state yang jelas:

```text
draft
  |
  v
review
  |
  +------> rejected
  |
  v
scheduled
  |
  v
published
  |
  v
archived
```

Jangan hanya:

```ts
isPublished: boolean
```

Karena workflow editorial biasanya berkembang.

---

# 42. Article Revision

Simpan versi artikel lama.

Collection:

```text
article_revisions
```

Contoh:

```ts
{
  articleId,
  revision: 12,
  title,
  content,
  editedBy,
  createdAt
}
```

Digunakan untuk:

- audit;
- compare revision;
- rollback;
- histori editorial.

---

# 43. Audit Log

Operasi penting harus memiliki audit log.

Contoh:

```text
ARTICLE_CREATED
ARTICLE_UPDATED
ARTICLE_PUBLISHED
ARTICLE_ARCHIVED
ARTICLE_DELETED

MEDIA_UPLOADED
MEDIA_DELETED

USER_CREATED
ROLE_UPDATED
```

Record:

```ts
{
  actorId,
  action,
  entity,
  entityId,
  metadata,
  ip,
  userAgent,
  createdAt
}
```

---

# 44. Logging

Jangan menjadikan `console.log()` sebagai solusi logging production.

Gunakan structured logging.

Contoh:

```json
{
  "level": "info",
  "requestId": "abc123",
  "method": "GET",
  "path": "/api/v1/articles/article-slug",
  "duration": 28
}
```

---

# 45. Request ID

Setiap request mendapatkan correlation ID.

```text
Client
  |
NestJS Request ID
  |
MongoDB / Redis
  |
Queue
  |
Worker
```

Request ID mempermudah tracing error.

---

# 46. Error Handling

Gunakan global exception filter.

Jangan expose ke client:

```text
MongoDB connection string
stack trace
filesystem path
JWT secret
MinIO secret
raw third-party error
```

Detail error disimpan di logging/monitoring.

---

# 47. Environment Variable

Contoh:

```env
NODE_ENV=production
PORT=3001

MONGODB_URI=

REDIS_CACHE_URL=
REDIS_QUEUE_URL=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=

MINIO_ENDPOINT=
MINIO_PORT=9000
MINIO_ACCESS_KEY=
MINIO_SECRET_KEY=
MINIO_USE_SSL=true

MINIO_PUBLIC_BUCKET=media-public
MINIO_PRIVATE_BUCKET=media-private

MEILISEARCH_HOST=
MEILISEARCH_API_KEY=
```

Jangan commit `.env`.

Sediakan:

```text
.env.example
```

---

# 48. Environment

Pisahkan:

```text
development
staging
production
```

Idealnya masing-masing memiliki:

```text
MongoDB
Redis
MinIO bucket
Meilisearch index
```

yang terpisah.

---

# 49. MongoDB Production

Untuk sistem production penting, gunakan replica set.

```text
Primary
   |
   +---- Secondary
   |
   +---- Secondary
```

Bisa menggunakan MongoDB Atlas jika ingin mengurangi beban operasional.

---

# 50. Backup Strategy

Backup wajib.

Minimum:

```text
MongoDB:
daily backup

MinIO:
replication / snapshot / external backup

Configuration:
backup infrastructure config
```

Backup harus memiliki:

- retention;
- encryption;
- restore procedure;
- restore test.

Backup yang belum pernah diuji restore belum cukup.

---

# 51. Redis Production

Jika memungkinkan pisahkan:

```text
Redis Cache
Redis Queue
```

Karena:

- cache boleh expire/evict;
- queue tidak boleh kehilangan job secara sembarangan.

Jika tahap awal menggunakan satu Redis instance, desain config agar mudah dipisahkan di kemudian hari.

---

# 52. Health Check

Endpoint:

```text
GET /health/live
GET /health/ready
```

Liveness:

> Process masih hidup atau tidak.

Readiness:

> Aplikasi siap menerima traffic atau tidak.

Readiness bisa mengecek:

```text
MongoDB
Redis
Meilisearch
MinIO
```

Tetapi jangan membuat health check terlalu berat.

---

# 53. Graceful Shutdown

Tangani:

```text
SIGTERM
SIGINT
```

Shutdown flow:

1. berhenti menerima request baru;
2. selesaikan request yang sedang berjalan;
3. hentikan worker dengan aman;
4. tutup Redis;
5. tutup MongoDB;
6. tutup koneksi MinIO jika diperlukan.

---

# 54. Docker

Pisahkan process.

Contoh development:

```text
api
worker
mongodb
redis
meilisearch
minio
```

Production:

```text
api
worker
redis
meilisearch
minio
```

MongoDB dapat menggunakan managed service atau cluster terpisah.

---

# 55. Contoh Docker Compose Development

```yaml
services:
  api:
    build: .
    command: npm run start:dev
    env_file:
      - .env
    depends_on:
      - mongodb
      - redis
      - meilisearch
      - minio

  worker:
    build: .
    command: npm run start:worker
    env_file:
      - .env
    depends_on:
      - redis
      - mongodb
      - meilisearch
      - minio

  mongodb:
    image: mongo
    volumes:
      - mongodb_data:/data/db

  redis:
    image: redis
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

  meilisearch:
    image: getmeili/meilisearch
    environment:
      MEILI_ENV: development
    volumes:
      - meili_data:/meili_data

  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data

volumes:
  mongodb_data:
  redis_data:
  meili_data:
  minio_data:
```

Versi image sebaiknya dipin saat production.

Jangan menggunakan tag `latest` tanpa kontrol.

---

# 56. Stateless API

NestJS API harus stateless.

Jangan menyimpan data penting di memory process.

Gunakan:

```text
Redis
MongoDB
MinIO
```

Dengan begitu:

```text
Load Balancer
      |
  +---+---+
  |       |
API-1   API-2
```

bisa berjalan tanpa sticky session.

---

# 57. Horizontal Scaling

Saat traffic bertambah:

```text
Cloudflare
     |
Load Balancer
     |
 +---+---+---+
 |       |   |
API-1 API-2 API-3
     |
 +---+------------+
 |       |        |
Redis  MongoDB  MinIO
```

Workers dapat di-scale terpisah:

```text
Search Worker x2
Media Worker x4
Analytics Worker x2
```

---

# 58. Jangan Langsung Kubernetes

Untuk tahap awal:

```text
Docker
+
MongoDB
+
Redis
+
Meilisearch
+
MinIO
+
Cloudflare
```

sudah cukup.

Pertimbangkan Kubernetes jika:

- instance sangat banyak;
- autoscaling kompleks dibutuhkan;
- deployment sangat sering;
- infrastructure team siap;
- biaya kompleksitas memang sepadan.

---

# 59. Testing Strategy

## Unit Test

Untuk:

```text
service
utility
permission
business rule
```

## Integration Test

Untuk:

```text
Mongo repository
Redis
BullMQ
Meilisearch adapter
MinIO adapter
```

## E2E

Untuk:

```text
login
create article
review article
publish article
upload media
read article
search
```

---

# 60. Repository Pattern

Pisahkan persistence dari business logic.

Contoh:

```ts
interface ArticleRepository {
  findById(id: string): Promise<Article | null>;

  findBySlug(slug: string): Promise<Article | null>;

  create(data: CreateArticleData): Promise<Article>;

  update(
    id: string,
    data: UpdateArticleData
  ): Promise<Article>;
}
```

---

# 61. Storage Abstraction

Jangan biarkan service artikel langsung bergantung pada MinIO SDK.

Buat abstraction.

```ts
interface ObjectStorage {
  generateUploadUrl(input: GenerateUploadUrlInput): Promise<string>;

  deleteObject(key: string): Promise<void>;

  objectExists(key: string): Promise<boolean>;

  generateDownloadUrl(key: string): Promise<string>;
}
```

Implementasi:

```text
MinioObjectStorage
```

Keuntungan:

- mudah di-test;
- mudah ganti storage;
- dependency infrastructure tidak menyebar ke seluruh codebase.

---

# 62. Search Abstraction

Gunakan interface serupa:

```ts
interface SearchEngine {
  indexArticle(article: SearchArticle): Promise<void>;

  removeArticle(id: string): Promise<void>;

  search(query: SearchQuery): Promise<SearchResult>;
}
```

Implementasi awal:

```text
MeilisearchSearchEngine
```

Nanti bisa diganti:

```text
OpenSearchSearchEngine
```

tanpa rewrite business logic.

---

# 63. Service Layer

Contoh:

```ts
class PublishArticleService {
  async execute(articleId: string) {
    const article =
      await this.articleRepository.findById(articleId);

    if (!article) {
      throw new ArticleNotFoundException();
    }

    const published =
      await this.articleRepository.publish(articleId);

    await this.cache.invalidateArticle(published.slug);

    await this.searchQueue.add('index-article', {
      articleId
    });

    return published;
  }
}
```

Service menjalankan use case.

Repository menangani persistence.

---

# 64. Jangan Overengineering

Tidak perlu membuat terlalu banyak layer hanya demi mengikuti textbook clean architecture.

Gunakan separation of concerns secara pragmatis.

Tujuan arsitektur:

```text
mudah dibaca
mudah di-test
mudah dikembangkan
mudah di-scale
```

bukan sekadar memiliki banyak folder.

---

# 65. DTO dan Schema

Jangan gunakan MongoDB schema sebagai API contract.

Pisahkan:

```text
CreateArticleDto
UpdateArticleDto

ArticleSchema
```

Database representation tidak harus sama dengan public response.

---

# 66. Soft Delete

Untuk artikel dan media penting:

```ts
deletedAt: Date | null
deletedBy: ObjectId | null
```

Ini memudahkan recovery dari accidental delete.

Hard delete bisa dilakukan berdasarkan retention policy.

---

# 67. Scheduled Publish

Simpan:

```ts
status: "scheduled"
scheduledAt: Date
```

Worker atau delayed job mempublish saat waktunya tiba.

Workflow harus idempotent.

---

# 68. SEO Backend Requirements

Article response sebaiknya menyediakan:

```text
slug
title
excerpt
author
category
publishedAt
updatedAt
thumbnail
canonical
seo title
seo description
```

Backend harus dapat mendukung:

```text
sitemap
news sitemap
RSS
structured data source
canonical URL
```

Generate sitemap besar melalui worker.

---

# 69. Domain Strategy

Contoh:

```text
www.example.com
cms.example.com
api.example.com
media.example.com
```

Mapping:

```text
www.example.com   -> Next.js public site
cms.example.com   -> Next.js CMS
api.example.com   -> NestJS
media.example.com -> CDN / proxy -> MinIO
```

---

# 70. SSR / ISR Flow

```text
Next.js
   |
   v
NestJS
   |
   v
Redis
   |
   v
MongoDB
```

Gunakan kombinasi:

```text
CDN Cache
Next.js Cache / ISR
Redis
MongoDB
```

Jangan membuat terlalu banyak cache layer tanpa invalidation strategy.

---

# 71. Security Checklist

Minimum:

- HTTPS.
- Helmet/security headers.
- CORS whitelist.
- Input validation.
- Authorization backend.
- Rate limiting.
- Argon2id password hashing.
- Secure cookie.
- Secret rotation.
- Dependency scanning.
- Upload validation.
- Audit log.
- Error sanitization.
- Backup.
- WAF.
- MinIO private network.
- Presigned URL untuk private object.

---

# 72. Upload Security

Jangan percaya file extension.

Validasi:

```text
MIME type
magic bytes jika diperlukan
file size
allowed file type
max dimensions untuk image
```

Beri random/deterministic object key yang dibuat backend.

Jangan percaya filename dari client sebagai final object key.

---

# 73. CORS

Jangan menggunakan:

```ts
origin: '*'
```

untuk authenticated API dengan credential.

Gunakan whitelist:

```text
https://example.com
https://cms.example.com
```

---

# 74. Dependency Management

Gunakan lockfile:

```text
package-lock.json
pnpm-lock.yaml
```

Commit lockfile.

Upgrade dependency melalui:

```text
development
staging
production
```

bukan langsung production.

---

# 75. CI/CD

Minimum:

```text
Push
  |
  v
Lint
  |
  v
Typecheck
  |
  v
Unit Test
  |
  v
Integration Test
  |
  v
Build
  |
  v
Docker Image
  |
  v
Staging
  |
  v
Production
```

---

# 76. Database Migration

MongoDB tetap membutuhkan migration strategy.

Simpan script:

```text
migrations/
```

Contoh perubahan:

```text
categoryId string
```

menjadi:

```text
categoryId ObjectId
```

Jangan menjalankan migration berat secara otomatis saat API startup.

---

# 77. Schema Evolution

Untuk perubahan besar bisa menggunakan:

```ts
schemaVersion: 2
```

Migration tanpa downtime:

```text
read old + new
write new
backfill old
remove old
```

---

# 78. Monitoring

Monitor:

```text
request rate
response latency
error rate

CPU
RAM

MongoDB query latency
MongoDB connection

Redis memory
Redis connection

queue waiting
queue active
queue failed

worker processing time

Meilisearch latency

MinIO storage usage
MinIO disk health
MinIO request error
```

---

# 79. Alert

Buat alert jika:

```text
API error rate tinggi
p95 latency tinggi
MongoDB unavailable
Redis unavailable
MinIO unavailable
disk hampir penuh
queue backlog tinggi
job failure meningkat
```

---

# 80. Performance Target

Tetapkan internal SLO.

Contoh awal:

```text
cached article:
p95 < 100 ms

uncached article:
p95 < 300 ms

search:
p95 < 300 ms
```

Gunakan:

```text
p50
p95
p99
```

Jangan hanya average.

---

# 81. Load Testing

Gunakan:

```text
k6
Artillery
```

Test endpoint realistis:

```text
homepage
article detail
category listing
search
trending
image URL
```

---

# 82. Hot Article Scenario

Artikel viral adalah skenario utama media.

Ideal:

```text
User
 |
Cloudflare
 |
Next.js Cache
 |
Redis
 |
MongoDB
```

Sebagian besar request tidak boleh mencapai MongoDB.

Image juga idealnya:

```text
User
 |
CDN
 |
media.example.com
 |
MinIO
```

dan mayoritas request media seharusnya dilayani CDN.

---

# 83. Failure Strategy

## Meilisearch Down

Artikel tetap bisa dibaca.

Search boleh degraded.

## Redis Down

Fallback ke MongoDB secara terbatas.

Pastikan ada protection agar database tidak langsung overload.

## Queue Down

Core write dapat tetap berjalan jika side-effect bisa direcovery.

## MinIO Down

Artikel yang sudah dicache CDN mungkin masih bisa tampil.

Upload baru harus gagal secara terkendali.

## MongoDB Down

Write berhenti.

Uncached read juga berhenti.

Return controlled:

```text
503 Service Unavailable
```

---

# 84. Timeout

Semua external operation harus memiliki timeout.

Termasuk:

```text
MongoDB
Redis
Meilisearch
MinIO
third-party APIs
```

Jangan membiarkan request menggantung tanpa batas.

---

# 85. Graceful Degradation

Prioritas availability:

```text
1. Article delivery
2. Homepage/category
3. CMS publish
4. Media delivery
5. Search
6. Comments
7. Recommendation
8. Analytics
```

Recommendation gagal tidak boleh membuat article detail gagal.

---

# 86. Kapan Memisahkan Microservices?

Pertimbangkan jika:

- scaling characteristic berbeda;
- worker menggunakan resource sangat besar;
- ownership team berbeda;
- deployment domain mengganggu core API;
- reliability boundary dibutuhkan.

Candidate:

```text
media processing
analytics
search indexing
notifications
recommendation
```

Article CRUD dapat tetap berada di core API.

---

# 87. Roadmap Arsitektur

## Stage 1 — Development

```text
NestJS
MongoDB
Redis
MinIO
```

## Stage 2 — Initial Production

```text
NestJS
MongoDB
Redis
BullMQ
Worker
Meilisearch
MinIO
Cloudflare
```

## Stage 3 — Growing Traffic

```text
Load Balancer

NestJS xN
Worker xN

MongoDB Replica Set
Redis Cache
Redis Queue
Meilisearch
MinIO Distributed / Replicated
Cloudflare CDN
```

## Stage 4 — Large Scale

Hanya jika diperlukan:

```text
Core API

Search Service
Analytics Service
Media Service
Recommendation Service
Notification Service
```

---

# 88. Recommended Initial Production Architecture

```text
                         Cloudflare
                             |
                 +-----------+-----------+
                 |                       |
                 v                       v
             Next.js               media.example.com
                 |                       |
                 |                       v
                 |                Reverse Proxy / CDN
                 |                       |
                 |                       v
                 |                     MinIO
                 |
                 v
            Load Balancer
                 |
          +------+------+
          |             |
          v             v
       NestJS-1      NestJS-2
          |             |
          +------+------+
                 |
      +----------+-----------+
      |          |           |
      v          v           v
   MongoDB     Redis      Meilisearch
                 |
                 v
              BullMQ
                 |
        +--------+--------+
        |        |        |
        v        v        v
      Media    Search  Analytics
      Worker   Worker   Worker
        |
        v
      MinIO
```

---

# 89. Urutan Implementasi yang Direkomendasikan

Jangan implementasikan semuanya sekaligus.

## Phase 1

Bangun:

```text
NestJS
MongoDB
Auth
Users
Articles
Categories
Tags
MinIO upload
```

## Phase 2

Tambahkan:

```text
Redis cache
BullMQ
Media processing
Article revisions
Audit log
```

## Phase 3

Tambahkan:

```text
Meilisearch
Trending
View counter
Scheduled publishing
Sitemap worker
```

## Phase 4

Tambahkan:

```text
Monitoring
Metrics
Distributed deployment
Advanced backup
Horizontal scaling
```

---

# 90. Prinsip Jangka Panjang

Selalu pertahankan prinsip berikut:

```text
MongoDB = source of truth

Redis = cache / ephemeral high-speed data

BullMQ = asynchronous work

Meilisearch = search index

MinIO = object storage

NestJS = core business logic

Next.js = presentation / frontend
```

Jangan mencampur tanggung jawab.

---

# 91. Rule of Thumb

Saat menambahkan fitur baru, tanyakan:

### Apakah ini data utama?

Jika ya:

```text
MongoDB
```

### Apakah ini temporary atau frequently accessed?

Jika ya:

```text
Redis
```

### Apakah prosesnya berat atau tidak perlu selesai saat request?

Jika ya:

```text
BullMQ
```

### Apakah ini file?

Jika ya:

```text
MinIO
```

### Apakah ini search?

Jika ya:

```text
Meilisearch
```

---

# 92. Rekomendasi Final Stack

```text
Frontend
----------------
Next.js
TypeScript
TanStack Query
Zustand
Tailwind

Backend
----------------
NestJS
TypeScript
REST API

Database
----------------
MongoDB
Mongoose

Cache
----------------
Redis

Queue
----------------
BullMQ

Search
----------------
Meilisearch

Object Storage
----------------
MinIO

Infrastructure
----------------
Docker
Nginx / Caddy
Cloudflare

Monitoring
----------------
Sentry

Future
----------------
OpenTelemetry
Prometheus
Grafana
Loki
```

---

# 93. Kesimpulan

Untuk backend media massa, pendekatan yang disarankan adalah:

```text
Modular Monolith
      |
      v
NestJS
      |
      +---- MongoDB
      |
      +---- Redis
      |
      +---- BullMQ
      |
      +---- Meilisearch
      |
      +---- MinIO
```

Arsitektur ini cukup sederhana untuk dikembangkan oleh team kecil, tetapi tetap memiliki jalur scaling yang jelas.

Yang paling penting bukan seberapa banyak teknologi yang digunakan, tetapi:

- domain separation yang jelas;
- query MongoDB yang ter-index;
- cache yang benar;
- async processing;
- object storage yang terpisah;
- stateless API;
- observability;
- backup;
- testing;
- security;
- documented operational procedures.

Mulai sederhana, ukur bottleneck nyata, lalu scale bagian yang memang membutuhkan scaling.
