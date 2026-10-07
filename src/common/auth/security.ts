import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import type { Request } from 'express';
export const ROLES = ['superadmin', 'admin', 'editor', 'writer'] as const;
export type Role = (typeof ROLES)[number];
export interface Actor {
  id: string;
  name: string;
  email: string;
  role: Role;
  sessionId: string;
}
export interface AuthRequest extends Request {
  actor: Actor;
}
export const Public = () => SetMetadata('public', true);
export const Permissions = (...permissions: string[]) =>
  SetMetadata('permissions', permissions);
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Actor =>
    ctx.switchToHttp().getRequest<AuthRequest>().actor,
);
export const ROLE_PERMISSIONS: Record<Role, string[]> = {
  superadmin: ['*'],
  admin: [
    'article:create',
    'article:update',
    'article:review',
    'article:publish',
    'article:delete',
    'taxonomy:manage',
    'media:upload',
    'user:manage',
  ],
  editor: [
    'article:create',
    'article:update',
    'article:review',
    'article:publish',
    'article:delete',
    'taxonomy:manage',
    'media:upload',
  ],
  writer: [
    'article:create',
    'article:update',
    'article:review',
    'media:upload',
  ],
};
