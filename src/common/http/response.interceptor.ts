import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { map } from 'rxjs/operators';
import type { Response } from 'express';
export class Page<T> {
  constructor(
    public data: T[],
    public meta: {
      nextCursor?: string | null;
      total?: number;
      page?: number;
      limit?: number;
    },
  ) {}
}
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const response = context.switchToHttp().getResponse<Response>();
    return next.handle().pipe(
      map((value: unknown) => ({
        success: true,
        data: value instanceof Page ? value.data : (value ?? null),
        meta: {
          ...(value instanceof Page ? value.meta : {}),
          requestId: String(response.locals.requestId),
          timestamp: new Date().toISOString(),
        },
      })),
    );
  }
}
