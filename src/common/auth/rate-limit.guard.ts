import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { CacheService } from '../../infrastructure/cache/cache.service';
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(private readonly cache: CacheService) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.path === '/health/live' || req.path === '/health/ready')
      return true;
    const sensitive =
      req.path.endsWith('/auth/login') || req.path.endsWith('/auth/refresh');
    await this.cache.consume(
      `${sensitive ? 'auth' : 'api'}:${req.ip}`,
      sensitive ? 10 : 300,
      60,
    );
    return true;
  }
}
