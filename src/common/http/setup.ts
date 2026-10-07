import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import helmet from 'helmet';
import type { Request, Response, NextFunction } from 'express';
import { ApiExceptionFilter } from './exception.filter';
import { ResponseInterceptor } from './response.interceptor';
export function setupHttp(app: INestApplication) {
  const config = app.get(ConfigService);
  const logger = new Logger('HTTP');
  app.setGlobalPrefix('api/v1', { exclude: ['health/live', 'health/ready'] });
  app.use(helmet());
  app.enableCors({
    origin: config
      .getOrThrow<string>('CORS_ORIGINS')
      .split(',')
      .map((s) => s.trim()),
    exposedHeaders: ['X-Request-ID'],
  });
  app.use((req: Request, res: Response, next: NextFunction) => {
    const id = randomUUID();
    res.locals.requestId = id;
    res.setHeader('X-Request-ID', id);
    res.setHeader('Cache-Control', 'no-store');
    const start = Date.now();
    res.on('finish', () =>
      logger.log({
        requestId: id,
        method: req.method,
        path: req.path,
        status: res.statusCode,
        durationMs: Date.now() - start,
      }),
    );
    next();
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.enableShutdownHooks();
}
