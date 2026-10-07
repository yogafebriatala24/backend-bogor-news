import { Schema, InferSchemaType } from 'mongoose';
import { ROLES } from '../../common/auth/security';
export const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'writer' },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'users' },
);
export type User = InferSchemaType<typeof UserSchema>;
