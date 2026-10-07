# Dokumentasi API Backend News

Versi API: `v1`. Base URL lokal: `http://127.0.0.1:3001/api/v1`.

## Swagger

Jalankan `npm run start:dev`, kemudian buka:

- Swagger UI: <http://127.0.0.1:3001/docs>
- OpenAPI JSON: <http://127.0.0.1:3001/docs-json>
- OpenAPI YAML: <http://127.0.0.1:3001/docs-yaml>

Swagger menyediakan schema request/response, field wajib, batas validasi, query/path parameter, permission, dan **Try it out** untuk 35 operasi API. Dokumen OpenAPI menggunakan response envelope API; file OpenAPI itu sendiri disajikan langsung tanpa envelope.

Cara mencoba endpoint terlindungi:

1. Buka `Auth → POST /api/v1/auth/login` → **Try it out**.
2. Isi email/password. Admin lokal memakai email `admin@db-news.local`; password ada di `.env` pada `ADMIN_PASSWORD`.
3. Klik **Execute**, lalu salin `data.accessToken`.
4. Klik **Authorize**, tempel token tanpa awalan `Bearer`, lalu konfirmasi.
5. Coba endpoint admin. Untuk refresh, salin token baru dan perbarui Authorize.

Token tidak dipersistensikan oleh Swagger setelah halaman dimuat ulang. Semua nilai contoh di schema adalah placeholder; ID kategori/tag/media harus diganti dengan ID resource yang benar.

## Konvensi umum

- Request body JSON menggunakan `Content-Type: application/json`, maksimal 100 KiB.
- Field yang tidak dikenali ditolak dengan 400, termasuk `status` atau `authorId` yang disisipkan pada body create article.
- ID resource adalah MongoDB ObjectId, string hex 24 karakter.
- Waktu berbentuk ISO 8601 UTC.
- Slug berupa huruf kecil/angka dengan pemisah `-`.
- Request ID dihasilkan server dan dikirim melalui `X-Request-ID` serta `meta.requestId`.
- Autentikasi menggunakan header `Authorization: Bearer <accessToken>`.
- Semua endpoint pada tabel berikut relatif terhadap `/api/v1`, kecuali health.

### Response berhasil

```json
{
  "success": true,
  "data": { "id": "507f1f77bcf86cd799439011" },
  "meta": {
    "requestId": "7190e76f-fbc3-4580-ae8f-f008e0b30e0e",
    "timestamp": "2026-10-03T00:00:00.000Z"
  }
}
```

Status success adalah 200, kecuali operasi create dan upload intent/complete yang memakai 201. DELETE mengembalikan JSON dengan status 200.

### Response error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": ["title must be longer than or equal to 5 characters"]
  },
  "meta": {
    "requestId": "7190e76f-fbc3-4580-ae8f-f008e0b30e0e",
    "timestamp": "2026-10-03T00:00:00.000Z"
  }
}
```

`details` hanya muncul pada error validasi. Error internal tidak mengirim stack trace, credentials, atau query database.

| HTTP | Code yang umum | Tindakan client |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR`, `INVALID_ID`, `INVALID_CURSOR`, `INVALID_UPLOAD`, `FILE_TOO_LARGE`, `INVALID_THUMBNAIL` | Perbaiki request |
| 401 | `AUTHENTICATION_REQUIRED`, `INVALID_CREDENTIALS`, `INVALID_ACCESS_TOKEN`, `INVALID_REFRESH_TOKEN`, `SESSION_EXPIRED`, `ACCOUNT_INACTIVE` | Login/refresh sesuai kasus |
| 403 | `PERMISSION_DENIED`, `ROLE_FORBIDDEN`, `ARTICLE_FORBIDDEN`, `ARTICLE_LOCKED`, `MEDIA_FORBIDDEN` | Periksa role, ownership, dan status artikel |
| 404 | `ARTICLE_NOT_FOUND`, `TAXONOMY_NOT_FOUND`, `USER_NOT_FOUND`, `MEDIA_NOT_FOUND` | Resource tidak tersedia |
| 409 | `DUPLICATE_RESOURCE`, `REVISION_CONFLICT`, `INVALID_ARTICLE_TRANSITION`, `SELF_LOCKOUT`, `UPLOAD_EXPIRED`, `UPLOAD_INCOMPLETE` | Muat ulang data atau perbaiki state |
| 413 | `PAYLOAD_TOO_LARGE` | Kurangi ukuran JSON body |
| 429 | `RATE_LIMIT_EXCEEDED` | Tunggu sebelum mencoba kembali |
| 500 | `INTERNAL_SERVER_ERROR` | Catat request ID untuk debugging |
| 503 | `DATABASE_UNAVAILABLE`, `STORAGE_UNAVAILABLE`, `RATE_LIMIT_UNAVAILABLE`, `DEPENDENCIES_UNAVAILABLE` | Service sementara tidak tersedia |

### Pagination

Artikel publik menggunakan cursor:

```http
GET /api/v1/articles?limit=20
GET /api/v1/articles?limit=20&cursor=<meta.nextCursor>
```

`meta.nextCursor` bernilai `null` jika halaman terakhir. Pertahankan filter yang sama pada request lanjutan. Cursor memakai `publishedAt` dan `_id` sebagai tie-breaker. `limit` default 20, minimum 1, maksimum 100; panjang cursor maksimal 512 karakter.

Users, categories, dan tags menggunakan `page` (default 1, maksimum 1000) dan `limit` (default 20, maksimum 100). Response memuat `meta.page`, `meta.limit`, dan `meta.total`.

Admin articles/media juga menerima `page` dan `limit`, tetapi response tidak menyertakan total/pagination metadata; hanya `data: []`, request ID, dan timestamp.

## Auth

| Method | Path | Auth | Body | HTTP |
| --- | --- | --- | --- | --- |
| POST | `/auth/login` | Publik | `email`, `password` | 200 |
| POST | `/auth/refresh` | Publik | `refreshToken` | 200 |
| POST | `/auth/logout` | Bearer | Tidak diperlukan | 200 |
| GET | `/auth/me` | Bearer | — | 200 |

Login:

```json
{ "email": "admin@db-news.local", "password": "password-admin-anda" }
```

`email` harus valid, maksimum 254 karakter; password login 1–128 karakter. Email dinormalisasi menjadi lowercase dan dipangkas spasi luar.

`data` untuk login/refresh:

```json
{
  "accessToken": "<jwt>",
  "refreshToken": "<session-id>.<random-token>",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

Access token berlaku 15 menit. Session/refresh berlaku 7 hari sejak login. Refresh token memiliki 89 karakter dan dirotasi setiap kali dipakai; token sebelumnya tidak dapat digunakan lagi. Logout mencabut session beserta access token yang terkait. `GET /auth/me` memberikan `id`, `name`, `email`, `role`; logout memberikan `{ "message": "Logged out" }`.

Tidak ada registrasi publik atau auth berbasis cookie pada implementasi ini.

## Roles dan users

| Role | Akses |
| --- | --- |
| superadmin | Semua permission, termasuk membuat/mengelola admin dan superadmin |
| admin | Mengelola writer/editor, taxonomy, artikel, publikasi, media |
| editor | Mengelola taxonomy, artikel, publikasi, media |
| writer | Draft sendiri, submit review sendiri, media sendiri |

| Method | Path | Permission | HTTP |
| --- | --- | --- | --- |
| GET | `/admin/users?page=1&limit=20` | `user:manage` | 200 |
| POST | `/admin/users` | `user:manage` | 201 |
| PATCH | `/admin/users/:id` | `user:manage` | 200 |

Create user:

```json
{
  "name": "Penulis Berita",
  "email": "writer@example.com",
  "password": "contoh-password-aman",
  "role": "writer"
}
```

Semua field create wajib. `name` 2–120 karakter; email valid maksimum 254; password 12–128; role salah satu dari empat role di atas.

PATCH menerima field opsional `name`, `role`, `active` (boolean). Endpoint PATCH belum mendukung mengganti email/password. Mengubah role sendiri atau menonaktifkan akun sendiri ditolak. Hanya superadmin dapat mengelola akun admin/superadmin.

Response user memuat `id`, `name`, `email`, `role`, `active`, tanpa password hash.

## Categories dan tags

| Method | Path | Akses | HTTP |
| --- | --- | --- | --- |
| GET | `/categories?page=1&limit=20` | Publik | 200 |
| GET | `/tags?page=1&limit=20` | Publik | 200 |
| POST | `/admin/categories` | `taxonomy:manage` | 201 |
| POST | `/admin/tags` | `taxonomy:manage` | 201 |
| PATCH | `/admin/categories/:id` | `taxonomy:manage` | 200 |
| PATCH | `/admin/tags/:id` | `taxonomy:manage` | 200 |
| DELETE | `/admin/categories/:id` | `taxonomy:manage` | 200 |
| DELETE | `/admin/tags/:id` | `taxonomy:manage` | 200 |

Create category/tag:

```json
{ "name": "Nasional", "slug": "nasional", "description": "Berita nasional" }
```

`name` wajib 2–100 karakter; `slug` wajib 2–140 karakter dan unik dalam jenis taxonomy; `description` opsional maksimum 500 karakter. PATCH menerima ketiga field secara opsional. DELETE tidak memerlukan body.

Response create/update/delete memuat `id`, `name`, `slug`, `description`. DELETE melakukan soft delete; resource hilang dari listing publik, sedangkan snapshot pada artikel lama tetap dipertahankan. Slug soft-deleted tetap terikat unique index.

## Artikel publik

| Method | Path | HTTP |
| --- | --- | --- |
| GET | `/articles` | 200 |
| GET | `/articles/:slug` | 200 |
| GET | `/categories/:slug/articles` | 200 |
| GET | `/tags/:slug/articles` | 200 |

Listing menerima `limit`, `cursor`, serta filter `categoryId`, `authorId`, `tagId` berupa ObjectId. Route berdasarkan slug kategori/tag menetapkan filter taxonomy terkait dari path.

Hanya artikel `published`, tidak soft-deleted, dan waktu publikasinya sudah tiba yang tersedia. Draft, review, atau archived menghasilkan 404 pada endpoint detail publik.

Response artikel publik memuat `id`, `title`, `slug`, `excerpt`, snapshot `author`, `category`, `tags`, `seo`, `publishedAt`, `updatedAt`, dan `thumbnail`. Detail juga memuat `content`; listing tidak memuat content. Thumbnail bernilai `null` atau `{ "id":"...", "url":"presigned-url", "mimeType":"image/png" }`. Status editorial/revision tidak diekspos pada response publik.

## Artikel editorial

| Method | Path | Permission | HTTP |
| --- | --- | --- | --- |
| GET | `/admin/articles?page=1&limit=20&status=draft` | Login + ownership | 200 |
| GET | `/admin/articles/:id` | Login + ownership | 200 |
| POST | `/admin/articles` | `article:create` | 201 |
| PATCH | `/admin/articles/:id` | `article:update` | 200 |
| DELETE | `/admin/articles/:id` | `article:delete` | 200 |
| POST | `/admin/articles/:id/review` | `article:review` | 200 |
| POST | `/admin/articles/:id/reject` | `article:publish` | 200 |
| POST | `/admin/articles/:id/publish` | `article:publish` | 200 |
| POST | `/admin/articles/:id/archive` | `article:publish` | 200 |

Create draft:

```json
{
  "title": "Berita lokal pertama",
  "slug": "berita-lokal-pertama",
  "excerpt": "Ringkasan berita.",
  "categoryId": "507f1f77bcf86cd799439011",
  "tagIds": [],
  "content": {
    "version": 1,
    "blocks": [{ "type": "paragraph", "text": "Isi berita." }]
  },
  "seo": { "title": "Judul SEO", "description": "Deskripsi SEO" }
}
```

| Field | Wajib create | Aturan |
| --- | --- | --- |
| `title` | Ya | 5–250 karakter |
| `slug` | Ya | 3–260 karakter, unik |
| `excerpt` | Tidak | Maksimal 500 karakter |
| `categoryId` | Ya | ID kategori aktif |
| `tagIds` | Tidak | Array maksimal 20 ID tag aktif yang unik |
| `content` | Ya | Object dengan version dan blocks |
| `content.version` | Ya | Integer `1` |
| `content.blocks` | Ya | 1–200 block |
| `blocks[].type` | Ya | `paragraph`, `heading`, `quote` |
| `blocks[].text` | Ya | Plain text 1–20.000 karakter; escape saat render |
| `thumbnailId` | Tidak | ID image complete atau `null` |
| `seo.title` | Tidak | Maksimal 160 karakter |
| `seo.description` | Tidak | Maksimal 320 karakter |
| `seo.canonicalUrl` | Tidak | URL HTTP(S), maksimal 2048 karakter |

Author diambil dari user login. Artikel baru selalu berstatus draft dan memiliki `revision: 1`.

PATCH menerima field create secara opsional, ditambah `revision` **wajib**, integer minimal 1. Field object yang dikirim, seperti `content` atau `seo`, menggantikan object tersebut. `tagIds: []` mengosongkan tag; `thumbnailId: null` menghapus thumbnail.

Contoh PATCH:

```json
{ "revision": 1, "title": "Judul berita diperbarui" }
```

Semua action dan DELETE menggunakan body `{ "revision": <revision-terakhir> }`. Setiap mutasi menaikkan revision; jika revision sudah berubah, server mengembalikan 409 `REVISION_CONFLICT`. Muat ulang artikel sebelum mencoba lagi.

| Action | Transisi |
| --- | --- |
| review | draft → review |
| reject | review → draft |
| publish | review → published |
| archive | published → archived |

Writer hanya dapat melihat artikelnya sendiri, mengedit draft sendiri, dan submit review. Writer tidak dapat publish/reject/archive/delete. Editor/admin/superadmin dapat mengelola artikel lintas author. Tidak ada endpoint untuk membuka ulang archived pada Phase 1.

Response admin memuat field artikel, `content`, `thumbnailId`, `authorId`, `categoryId`, `status`, `revision`, `createdAt`; tidak memuat URL thumbnail hasil signing. DELETE memberikan `{ "id":"...", "deleted":true }`.

## Media dan upload MinIO

Semua endpoint memerlukan `media:upload`. Writer hanya dapat mengakses media sendiri; editor/admin/superadmin dapat mengakses media lintas owner.

| Method | Path | Body | HTTP |
| --- | --- | --- | --- |
| GET | `/admin/media?page=1&limit=20` | — | 200 |
| POST | `/admin/media/upload-url` | `filename`, `mimeType`, `size` | 201 |
| POST | `/admin/media/complete` | `mediaId` | 201 |
| GET | `/admin/media/:id/download-url` | — | 200 |
| DELETE | `/admin/media/:id` | — | 200 |

### 1. Buat upload intent

```json
{ "filename": "foto.png", "mimeType": "image/png", "size": 12345 }
```

Filename 1–180 karakter. MIME yang didukung: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`. Size wajib integer positif dalam byte; default batas konfigurasi 10 MiB, dengan batas validasi maksimal 100 MiB.

Response `data`:

```json
{
  "mediaId": "507f1f77bcf86cd799439011",
  "method": "POST",
  "url": "http://127.0.0.1:49000/db-news",
  "fields": { "key": "temporary/...", "Content-Type": "image/png", "policy": "..." },
  "expiresIn": 300
}
```

### 2. Upload binary langsung ke MinIO

Kirim **seluruh** `fields` dari response, bukan hanya contoh yang ditampilkan. File harus menjadi field terakhir. Contoh browser setelah mendapatkan object `intent` dan `file`:

```javascript
const form = new FormData();
for (const [key, value] of Object.entries(intent.fields)) form.append(key, value);
form.append('file', file);
const response = await fetch(intent.url, { method: 'POST', body: form });
if (!response.ok) throw new Error('Upload MinIO gagal');
```

Jangan set `Content-Type: multipart/form-data` secara manual; browser akan menambahkan boundary. Jangan mengirim Bearer token API ke MinIO. Response MinIO memakai format storage sendiri, bukan envelope API.

Swagger digunakan untuk membuat intent dan complete. Binary upload dilakukan terpisah ke MinIO melalui browser/client multipart, karena URL dan signature ditentukan oleh intent.

### 3. Selesaikan upload

```json
{ "mediaId": "507f1f77bcf86cd799439011" }
```

Backend memverifikasi ukuran, MIME, magic bytes, dan kepemilikan. File yang lolos disimpan ke key final terpisah dari key upload sementara. Pemanggilan complete ulang untuk media yang sudah complete mengembalikan metadata yang sama.

Response metadata: `id`, `filename`, `mimeType`, `size`, `status`. Gunakan ID image complete sebagai `thumbnailId` pada artikel.

### 4. Download dan delete

Endpoint download memberikan `{ "url":"presigned-url", "expiresIn":900 }`. Bucket private; URL berlaku 15 menit. DELETE melakukan soft delete metadata dan memberikan `{ "id":"...", "deleted":true }`. Binary tidak langsung dihapus, dan URL lama dapat tetap berlaku sampai expired.

## Health dan rate limit

| Method | URL lengkap | Hasil |
| --- | --- | --- |
| GET | `http://127.0.0.1:3001/health/live` | 200, data `{ "status":"ok" }` |
| GET | `http://127.0.0.1:3001/health/ready` | 200 jika MongoDB/Redis/MinIO siap, selainnya 503 |

Health bersifat publik dan dikecualikan dari rate limit. Readiness success memberikan `checks: { "mongodb":"up", "redis":"up", "minio":"up" }`.

Login/refresh berbagi batas 10 request per IP per menit. Endpoint API lain berbagi batas 300 request per IP per menit. Redis gagal menyebabkan endpoint yang dilindungi rate limiter memberikan 503. Swagger UI/spec dilayani sebagai dokumentasi, di luar guard API.

## Cakupan

Dokumentasi ini mencakup endpoint Phase 1 yang sudah tersedia. Search, scheduled publishing, trending, komentar, dan endpoint worker belum tersedia.

Schema Swagger didefinisikan dekat DTO/controller; response envelope bersama berada pada `src/common/swagger`. Jika kontrak berubah, perbarui Markdown ini bersamaan dengan dekorator/schema. Pengujian OpenAPI memeriksa daftar operasi, schema request, envelope response, auth, pagination, dan referensi schema.

Referensi integrasi: [NestJS OpenAPI](https://docs.nestjs.com/openapi/introduction).
