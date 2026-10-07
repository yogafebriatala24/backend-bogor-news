import { Schema, InferSchemaType } from 'mongoose';
export const ARTICLE_STATUSES = [
  'draft',
  'review',
  'published',
  'archived',
] as const;
const snapshot = new Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    slug: { type: String },
  },
  { _id: false },
);
const block = new Schema(
  {
    type: {
      type: String,
      enum: ['paragraph', 'heading', 'quote'],
      required: true,
    },
    text: { type: String, required: true },
  },
  { _id: false },
);
export const ArticleSchema = new Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    excerpt: { type: String, default: '' },
    content: {
      version: { type: Number, default: 1, required: true },
      blocks: { type: [block], default: [], required: true },
    },
    status: {
      type: String,
      enum: ARTICLE_STATUSES,
      required: true,
      default: 'draft',
    },
    authorId: { type: Schema.Types.ObjectId, required: true },
    categoryId: { type: Schema.Types.ObjectId, required: true },
    authorSnapshot: { type: snapshot, required: true },
    categorySnapshot: { type: snapshot, required: true },
    tags: { type: [snapshot], default: [] },
    thumbnailId: { type: String, default: null },
    seo: {
      title: { type: String, default: '' },
      description: { type: String, default: '' },
      canonicalUrl: { type: String, default: '' },
    },
    revision: { type: Number, required: true, default: 1 },
    publishedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, default: null },
  },
  { timestamps: true, collection: 'articles' },
);
ArticleSchema.index({ status: 1, deletedAt: 1, publishedAt: -1, _id: -1 });
ArticleSchema.index({
  categoryId: 1,
  status: 1,
  deletedAt: 1,
  publishedAt: -1,
  _id: -1,
});
ArticleSchema.index({
  authorId: 1,
  status: 1,
  deletedAt: 1,
  publishedAt: -1,
  _id: -1,
});
ArticleSchema.index({
  'tags.id': 1,
  status: 1,
  deletedAt: 1,
  publishedAt: -1,
  _id: -1,
});
export type Article = InferSchemaType<typeof ArticleSchema>;
