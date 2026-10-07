import { Schema, InferSchemaType } from 'mongoose';
export const TaxonomySchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);
export type Taxonomy = InferSchemaType<typeof TaxonomySchema>;
export type TaxonomyKind = 'category' | 'tag';
