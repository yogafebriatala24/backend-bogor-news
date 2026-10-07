import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ContentDto } from '../../modules/articles/articles.dto';
import { responseSchemas } from './response-schemas';
export function createApiDocument(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('Backend News API')
    .setVersion('1.0.0')
    .setDescription(
      'REST API media massa. Login melalui /api/v1/auth/login, salin accessToken, lalu klik Authorize. Request JSON maksimal 100 KiB. Upload binary langsung ke MinIO menggunakan presigned POST. Semua response API memakai envelope success/data/error/meta.',
    )
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Masukkan accessToken tanpa awalan Bearer.',
      },
      'access-token',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config, {
    extraModels: [ContentDto],
    autoTagControllers: false,
  });
  document.components = {
    ...document.components,
    schemas: { ...document.components?.schemas, ...responseSchemas },
  };
  return document;
}
export function setupSwagger(app: INestApplication) {
  // Local HTTP docs must not upgrade their own assets to HTTPS.
  app.use(
    '/docs',
    helmet({
      contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } },
    }),
  );
  const document = createApiDocument(app);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    yamlDocumentUrl: 'docs-yaml',
    customSiteTitle: 'Backend News API Docs',
    swaggerOptions: {
      persistAuthorization: false,
      displayRequestDuration: true,
      docExpansion: 'none',
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
  return document;
}
