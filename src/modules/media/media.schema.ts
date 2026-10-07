import { Schema, InferSchemaType } from 'mongoose';
export const MediaSchema = new Schema(
  {
    ownerId: { type: Schema.Types.ObjectId, required: true, index: true },
    filename: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    temporaryKey: { type: String, required: true },
    objectKey: { type: String },
    status: {
      type: String,
      enum: ['pending', 'complete', 'deleted'],
      default: 'pending',
      required: true,
    },
    expiresAt: { type: Date, required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'media' },
);
export type Media = InferSchemaType<typeof MediaSchema>;
