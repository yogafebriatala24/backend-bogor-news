import type { SchemaObject } from '@nestjs/swagger';
const string: SchemaObject = { type: 'string' };
const id: SchemaObject = {
  type: 'string',
  pattern: '^[a-fA-F0-9]{24}$',
  example: '507f1f77bcf86cd799439011',
};
const date: SchemaObject = { type: 'string', format: 'date-time' };
export const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const object = (
  properties: Record<string, SchemaObject | { $ref: string }>,
  required = Object.keys(properties),
): SchemaObject => ({ type: 'object', properties, required });
const snapshot = object({ id, name: string, slug: string }, ['id', 'name']);
const article = {
  id,
  title: string,
  slug: string,
  excerpt: string,
  author: snapshot,
  category: snapshot,
  tags: { type: 'array', items: snapshot } as SchemaObject,
  seo: object({ title: string, description: string, canonicalUrl: string }),
  publishedAt: { ...date, nullable: true },
  updatedAt: date,
};
const thumbnail: SchemaObject = {
  ...object({ id, url: { type: 'string', format: 'uri' }, mimeType: string }),
  nullable: true,
};
export const responseSchemas: Record<string, SchemaObject> = {
  ResponseMeta: object({
    requestId: { type: 'string', format: 'uuid' },
    timestamp: date,
  }),
  ErrorResponse: object({
    success: { type: 'boolean', enum: [false] },
    error: object(
      {
        code: { type: 'string', example: 'VALIDATION_ERROR' },
        message: { type: 'string', example: 'Request validation failed' },
        details: { type: 'array', items: string },
      },
      ['code', 'message'],
    ),
    meta: ref('ResponseMeta'),
  }),
  Tokens: object({
    accessToken: string,
    refreshToken: string,
    tokenType: { type: 'string', enum: ['Bearer'] },
    expiresIn: { type: 'integer', example: 900 },
  }),
  CurrentUser: object({
    id,
    name: string,
    email: { type: 'string', format: 'email' },
    role: { type: 'string', enum: ['superadmin', 'admin', 'editor', 'writer'] },
  }),
  User: {
    allOf: [ref('CurrentUser'), object({ active: { type: 'boolean' } })],
  },
  Message: object({ message: { type: 'string', example: 'Logged out' } }),
  Taxonomy: object({ id, name: string, slug: string, description: string }),
  ArticleSummary: object({ ...article, thumbnail }),
  PublicArticle: object({ ...article, content: ref('ContentDto'), thumbnail }),
  AdminArticle: object({
    ...article,
    content: ref('ContentDto'),
    thumbnailId: { ...id, nullable: true },
    authorId: id,
    categoryId: id,
    status: {
      type: 'string',
      enum: ['draft', 'review', 'published', 'archived'],
    },
    revision: { type: 'integer', minimum: 1 },
    createdAt: date,
  }),
  Deleted: object({ id, deleted: { type: 'boolean', enum: [true] } }),
  Media: object({
    id,
    filename: string,
    mimeType: string,
    size: { type: 'integer' },
    status: { type: 'string', enum: ['pending', 'complete', 'deleted'] },
  }),
  UploadIntent: object({
    mediaId: id,
    method: { type: 'string', enum: ['POST'] },
    url: { type: 'string', format: 'uri' },
    fields: { type: 'object', additionalProperties: { type: 'string' } },
    expiresIn: { type: 'integer', example: 300 },
  }),
  DownloadUrl: object({
    url: { type: 'string', format: 'uri' },
    expiresIn: { type: 'integer', example: 900 },
  }),
  Liveness: object({ status: { type: 'string', enum: ['ok'] } }),
  Readiness: object({
    status: { type: 'string', enum: ['ok'] },
    checks: object({
      mongodb: { type: 'string', enum: ['up'] },
      redis: { type: 'string', enum: ['up'] },
      minio: { type: 'string', enum: ['up'] },
    }),
  }),
};
