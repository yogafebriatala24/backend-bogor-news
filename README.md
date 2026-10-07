# Backend News

Backend media massa menggunakan NestJS modular monolith, MongoDB/Mongoose, Redis, dan MinIO. Implementasi **Phase 1** dari `backend-media-architecture-guide.md`, dengan tambahan fondasi cache dan operasional.

## Dokumentasi API

- Swagger UI: <http://127.0.0.1:3001/docs>
- OpenAPI JSON: <http://127.0.0.1:3001/docs-json>
- OpenAPI YAML: <http://127.0.0.1:3001/docs-yaml>
- Panduan endpoint dan contoh request: [docs/API.md](docs/API.md)

Jalankan API, login melalui endpoint Auth di Swagger, lalu tempel `data.accessToken` pada tombol **Authorize** tanpa awalan Bearer. Swagger memuat schema body, query, response standar, serta kebutuhan autentikasi/permission.

## Menjalankan lokal

Node.js >= 22.12.0. MongoDB, Redis, dan MinIO harus aktif. Konfigurasi lokal:

| Service | Konfigurasi |
| --- | --- |
| API | `http://127.0.0.1:3001/api/v1` |
| MongoDB | `mongodb://127.0.0.1:27017/db-news` |
| Redis cache/rate limit | `redis://127.0.0.1:6379/0` |
| Redis queue (cadangan Phase 2) | `redis://127.0.0.1:6379/1` |
| MinIO API | `http://127.0.0.1:49000` |
| MinIO bucket | `db-news`, private |
| MinIO lokal | user/password `minioadmin` / `minioadmin` |

`.env` lokal telah disiapkan dengan JWT secret acak. `.env` diabaikan Git dan Docker. Untuk checkout baru:

```bash
npm ci
cp .env.example .env
# Isi JWT_ACCESS_SECRET dengan secret acak minimal 32 karakter.
# Isi ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD untuk membuat superadmin.
npm run setup:local
npm run start:dev
```

`setup:local` membuat index MongoDB, membuat bucket bila belum ada, memeriksa Redis, dan membuat akun admin jika konfigurasi `ADMIN_*` tersedia. Akun yang sudah ada tidak diubah. Redis lokal yang sudah berjalan dapat langsung dipakai tanpa database/schema setup; semua key memakai prefix `media:development:db-news`.

Untuk project lokal ini, email admin adalah `admin@db-news.local`. Password acaknya berada di `.env` pada `ADMIN_PASSWORD`. Pembuatan admin juga dapat dijalankan terpisah dengan `npm run seed:admin`.

```bash
curl http://127.0.0.1:3001/health/live
curl http://127.0.0.1:3001/health/ready
```

API bind ke loopback secara default. `APP_HOST=0.0.0.0` dapat digunakan untuk container atau akses LAN.

## Standar response

Success (HTTP 200 atau 201):

```json
{
  "success": true,
  "data": { "id": "...", "title": "Judul artikel" },
  "meta": { "requestId": "uuid", "timestamp": "2026-10-03T00:00:00.000Z" }
}
```

Listing artikel publik memakai `data: []` dan `meta.nextCursor`. Listing users/categories/tags memakai `meta.page`, `meta.limit`, `meta.total`. Listing admin articles/media menggunakan pagination `page` dan `limit` tanpa total count.

Error:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": ["title must be longer than or equal to 5 characters"]
  },
  "meta": { "requestId": "uuid", "timestamp": "2026-10-03T00:00:00.000Z" }
}
```

`details` hanya diberikan untuk validasi. Batas JSON body adalah 100 KiB; upload binary langsung ke MinIO. Request ID juga tersedia melalui header `X-Request-ID`. Error internal tidak mengekspos stack trace, credentials, query, atau path filesystem.

| Status | Contoh code |
| --- | --- |
| 400 | `VALIDATION_ERROR`, `INVALID_ID`, `INVALID_CURSOR`, `INVALID_UPLOAD` |
| 401 | `INVALID_CREDENTIALS`, `INVALID_ACCESS_TOKEN`, `SESSION_EXPIRED` |
| 403 | `PERMISSION_DENIED`, `ARTICLE_FORBIDDEN`, `ARTICLE_LOCKED` |
| 404 | `ARTICLE_NOT_FOUND`, `MEDIA_NOT_FOUND`, `TAXONOMY_NOT_FOUND` |
| 409 | `DUPLICATE_RESOURCE`, `REVISION_CONFLICT`, `INVALID_ARTICLE_TRANSITION` |
| 429 | `RATE_LIMIT_EXCEEDED` |
| 500 | `INTERNAL_SERVER_ERROR` |
| 503 | `DATABASE_UNAVAILABLE`, `STORAGE_UNAVAILABLE`, `DEPENDENCIES_UNAVAILABLE`, `RATE_LIMIT_UNAVAILABLE` |

## Auth dan permission

```http
POST /api/v1/auth/login
Content-Type: application/json

{"email":"admin@db-news.local","password":"isi-dari-ADMIN_PASSWORD"}
```

Response memberikan access token (15 menit), refresh token (session 7 hari), dan `tokenType: Bearer`. Endpoint terlindungi menggunakan `Authorization: Bearer <accessToken>`.

- `POST /auth/refresh`: body `{ "refreshToken": "..." }`. Token lama langsung tidak dapat digunakan ulang setelah rotasi. Masa session dihitung dari login, bukan diperpanjang tanpa batas.
- `POST /auth/logout`: mencabut session, termasuk access token yang belum expired.
- `GET /auth/me`: user saat ini.
- Password menggunakan Argon2id; refresh token disimpan dalam bentuk hash.
- Role dan status aktif dibaca ulang dari database pada setiap request terlindungi.
- Tidak ada registrasi publik. Admin membuat user melalui endpoint admin.
- Mode awal menggunakan Bearer token untuk REST client. Integrasi browser dengan HttpOnly/Secure cookie dan proteksi CSRF belum disediakan; jangan menyimpan refresh token di localStorage.

| Role | Kemampuan |
| --- | --- |
| superadmin | Semua permission, termasuk mengelola administrator |
| admin | User writer/editor, taxonomy, artikel, publikasi, media |
| editor | Taxonomy, artikel, publikasi, media |
| writer | Membuat/edit draft sendiri, submit review, upload/akses media sendiri |

Admin tidak dapat mengelola akun admin/superadmin; hanya superadmin. Perubahan role atau deaktivasi akun sendiri ditolak.

## Endpoint

Semua endpoint di bawah menggunakan prefix `/api/v1`.

| Method | Path | Akses |
| --- | --- | --- |
| GET | `/articles?limit=20&cursor=...` | Publik, hanya published |
| GET | `/articles/:slug` | Publik, hanya published |
| GET | `/categories`, `/tags` | Publik |
| GET | `/categories/:slug/articles`, `/tags/:slug/articles` | Publik |
| GET, POST | `/admin/users` | `user:manage` |
| PATCH | `/admin/users/:id` | `user:manage` |
| POST | `/admin/categories`, `/admin/tags` | `taxonomy:manage` |
| PATCH, DELETE | `/admin/categories/:id`, `/admin/tags/:id` | `taxonomy:manage` |
| GET, POST | `/admin/articles` | Login / `article:create` |
| GET, PATCH, DELETE | `/admin/articles/:id` | Ownership / permission |
| POST | `/admin/articles/:id/review` | `article:review` |
| POST | `/admin/articles/:id/reject` | `article:publish` |
| POST | `/admin/articles/:id/publish`, `/admin/articles/:id/archive` | `article:publish` |
| GET | `/admin/media` | `media:upload` |
| POST | `/admin/media/upload-url`, `/admin/media/complete` | `media:upload` |
| GET | `/admin/media/:id/download-url` | `media:upload` + ownership |
| DELETE | `/admin/media/:id` | `media:upload` + ownership |

Artikel publik dapat difilter menggunakan `categoryId`, `authorId`, `tagId`. Pagination memakai pasangan `publishedAt` + `_id` agar waktu publikasi yang sama tidak menyebabkan artikel terlewat. Admin list menerima `page`, `limit`, dan filter `status` untuk artikel.

## Membuat dan mempublikasikan artikel

Buat kategori (`name`, `slug`, optional `description`) dan tag terlebih dahulu. Contoh body `POST /admin/articles`:

```json
{
  "title": "Berita lokal pertama",
  "slug": "berita-lokal-pertama",
  "excerpt": "Ringkasan berita",
  "categoryId": "OBJECT_ID_KATEGORI",
  "tagIds": [],
  "content": {
    "version": 1,
    "blocks": [{ "type": "paragraph", "text": "Isi berita." }]
  },
  "seo": { "title": "Berita lokal pertama", "description": "Ringkasan SEO" }
}
```

Tipe block: `paragraph`, `heading`, `quote`; teks diperlakukan sebagai plain text dan harus di-escape saat rendering frontend. `thumbnailId` optional, harus merujuk image dengan status upload `complete`. `thumbnailId: null` menghapus thumbnail.

Transisi: `draft → review → published → archived`. Reject mengembalikan `review → draft`. Writer hanya dapat mengedit draft miliknya. Editor/admin dapat mengedit artikel, termasuk published.

PATCH, DELETE, dan action review/reject/publish/archive membutuhkan body dengan `revision` terakhir, misalnya `{ "revision": 1 }`. Setiap perubahan menaikkan revision. Revision lama mendapat 409, sehingga perubahan bersamaan tidak menimpa data.

Author pada Phase 1 menggunakan akun user penulis. Snapshot author/category/tag dipertahankan sebagai histori; rename taxonomy tidak otomatis memperbarui snapshot lama. Pengubahan kategori/tag pada artikel memperbarui snapshot relasi tersebut. Articles, taxonomy, dan media menggunakan soft delete.

## Upload MinIO

1. `POST /admin/media/upload-url` dengan `{ "filename":"foto.png", "mimeType":"image/png", "size":12345 }`.
2. Response memberikan `mediaId`, `url`, `method: POST`, dan `fields`. Kirim seluruh fields sebagai multipart form ke URL MinIO, lalu field `file` **terakhir**. Jangan set header multipart boundary secara manual.
3. `POST /admin/media/complete` dengan `{ "mediaId":"..." }`.
4. Backend memverifikasi size, MIME, dan magic bytes, kemudian menyalin byte yang sudah diperiksa ke object key final yang terpisah. URL upload sementara tidak dapat menimpa object final.
5. Gunakan ID hasilnya sebagai `thumbnailId`, atau ambil URL download melalui endpoint media.

Upload mendukung JPEG, PNG, WebP, dan PDF; default maksimum 10 MiB. Upload policy berlaku 5 menit dan membatasi object key, MIME, serta panjang file. URL download berlaku 15 menit. Bucket tetap private, dan policy bucket yang sudah ada tidak diubah oleh aplikasi. Browser melakukan upload langsung ke endpoint MinIO lokal; hostname tersebut harus dapat diakses browser.

Pemeriksaan decoding gambar/dimensi, resize WebP/AVIF, antivirus, dan cleanup upload yatim secara terjadwal termasuk tahap worker selanjutnya. Soft delete tidak menghapus binary secara permanen; URL download yang sudah terbit dapat tetap berlaku sampai expired.

## Cache, kegagalan, dan logging

Redis menggunakan namespace terpisah dan TTL 60 detik untuk content artikel. Lookup status/revision ringan ke MongoDB mendahului cache: artikel yang sudah archived/deleted tidak diambil dari cache lama. Key cache menyertakan revision dan dihapus saat perubahan. Ini memprioritaskan ketepatan publikasi; optimasi untuk traffic viral dan cache stampede termasuk tahap selanjutnya.

Rate limit tersimpan di Redis: 10 request login/refresh per IP per menit; 300 request API lain per IP per menit. Health check dikecualikan. Saat Redis gagal, endpoint API fail-closed dengan 503 untuk menjaga rate protection; `/health/live` tetap hidup. Karena default berjalan langsung di loopback, aplikasi tidak mempercayai `X-Forwarded-For`; konfigurasi trusted proxy yang spesifik diperlukan sebelum memasang reverse proxy.

Logging menggunakan JSON (request ID, method, path, status, durasi), tanpa token/password/body request. Health readiness memeriksa MongoDB, Redis, dan bucket MinIO. Jika signing thumbnail gagal karena MinIO tidak tersedia, artikel tetap dikirim dengan `thumbnail: null`. Koneksi memiliki timeout dan shutdown hook menutup koneksi. CORS memakai daftar origin eksplisit dan Helmet memasang security headers.

## Pengujian dan operasi

```bash
npm run lint:check
npm run typecheck
npm test -- --runInBand
npm run test:e2e -- --runInBand
npm run test:smoke
```

Unit dan HTTP-contract tests tidak membutuhkan database. HTTP tests membuka port lokal sementara. `test:smoke` membutuhkan tiga service lokal: ia membuat database/bucket `db-news-test-<acak>` dan prefix Redis unik, lalu hanya membersihkan resource uji tersebut. Smoke test mencakup workflow publikasi, permission/ownership, duplicate slug, revision conflict, cursor tie-breaker, cache invalidation, upload/download MinIO, refresh rotation, dan pencabutan session.

`npm run db:indexes` dijalankan setelah build ketika deploy production. Index otomatis aktif di development, dinonaktifkan di production. Script index hanya membuat index, tidak menghapus yang sudah ada. Tidak ada migrasi berat saat API startup.

Dockerfile tersedia untuk aplikasi (`docker build -t backend-news .`); image belum termasuk service database/storage. Untuk Docker di macOS gunakan hostname service atau `host.docker.internal` pada environment, karena `127.0.0.1` di container merujuk container itu sendiri. Sesuaikan public endpoint MinIO agar presigned URL dapat dicapai frontend. `.env` tidak dimasukkan ke image.

## Tahap berikutnya sesuai panduan

Implementasi ini belum mencakup BullMQ/worker, riwayat revisi lengkap dan audit log, Meilisearch, scheduled publishing, trending/view counter, sitemap/RSS, comments/bookmarks, modul authors terpisah, Sentry/metrics, serta deployment/backup production. `revision` saat ini adalah pengaman concurrent edit, bukan collection riwayat revisi. Integrasi lanjutan mengikuti Phase 2–4 dalam panduan.

Referensi implementasi: [NestJS MongoDB](https://docs.nestjs.com/techniques/mongodb), [NestJS authentication](https://docs.nestjs.com/security/authentication), dan [MinIO JavaScript SDK](https://docs.min.io/aistor/developers/sdk/javascript/api/).
