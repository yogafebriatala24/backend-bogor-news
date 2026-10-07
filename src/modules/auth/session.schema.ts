import { Schema, InferSchemaType } from 'mongoose';
export const SessionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    refreshHash: { type: String, required: true, select: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true, collection: 'sessions' },
);
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export type Session = InferSchemaType<typeof SessionSchema>;
