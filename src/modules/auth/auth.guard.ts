import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthService } from './auth.service';
import { ROLE_PERMISSIONS } from '../../common/auth/security';
import type { AuthRequest } from '../../common/auth/security';
import { ApiError } from '../../common/http/api-error';
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}
  async canActivate(context: ExecutionContext) {
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>('public', targets))
      return true;
    const req = context.switchToHttp().getRequest<AuthRequest>();
    const match = /^Bearer ([^ ]+)$/i.exec(req.headers.authorization ?? '');
    if (!match)
      throw new ApiError(
        401,
        'AUTHENTICATION_REQUIRED',
        'A Bearer access token is required',
      );
    req.actor = await this.auth.authenticate(match[1]);
    const permissions =
      this.reflector.getAllAndOverride<string[]>('permissions', targets) ?? [];
    const granted = ROLE_PERMISSIONS[req.actor.role];
    if (
      !granted.includes('*') &&
      !permissions.every((p) => granted.includes(p))
    )
      throw new ApiError(403, 'PERMISSION_DENIED', 'Insufficient permission');
    return true;
  }
}
