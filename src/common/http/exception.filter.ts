import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();
    let status = 500;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details: string[] | undefined;
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      const data =
        typeof body === 'string'
          ? { message: body }
          : (body as { code?: string; message?: string | string[] });
      code =
        data.code ??
        {
          400: 'BAD_REQUEST',
          401: 'UNAUTHORIZED',
          403: 'FORBIDDEN',
          404: 'NOT_FOUND',
          409: 'CONFLICT',
          413: 'PAYLOAD_TOO_LARGE',
          429: 'RATE_LIMIT_EXCEEDED',
          503: 'SERVICE_UNAVAILABLE',
        }[status] ??
        'HTTP_ERROR';
      if (Array.isArray(data.message)) {
        code = 'VALIDATION_ERROR';
        message = 'Request validation failed';
        details = data.message;
      } else message = data.message ?? message;
    } else if (typeof exception === 'object' && exception !== null) {
      const error = exception as {
        code?: number;
        name?: string;
        type?: string;
      };
      if (error.type === 'entity.too.large') {
        status = 413;
        code = 'PAYLOAD_TOO_LARGE';
        message = 'Request body exceeds the allowed size';
      } else if (error.code === 11000) {
        status = 409;
        code = 'DUPLICATE_RESOURCE';
        message = 'A resource with that unique value already exists';
      } else if (
        error.name === 'CastError' ||
        error.name === 'ValidationError'
      ) {
        status = 400;
        code = 'INVALID_DATA';
        message = 'Invalid resource data';
      } else if (
        [
          'MongoNetworkError',
          'MongoServerSelectionError',
          'MongooseServerSelectionError',
          'MongoOperationTimeoutError',
        ].includes(error.name ?? '')
      ) {
        status = 503;
        code = 'DATABASE_UNAVAILABLE';
        message = 'Database is temporarily unavailable';
      }
    }
    if (status >= 500)
      this.logger.error({
        requestId: String(res.locals.requestId),
        method: req.method,
        path: req.path,
        errorType: exception instanceof Error ? exception.name : 'UnknownError',
      });
    res.status(status).json({
      success: false,
      error: { code, message, ...(details ? { details } : {}) },
      meta: {
        requestId: String(res.locals.requestId),
        timestamp: new Date().toISOString(),
      },
    });
  }
}
