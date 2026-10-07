import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getConnectionToken } from '@nestjs/mongoose';
import { Test } from '@nestjs/testing';
import type { OpenAPIObject } from '@nestjs/swagger';
import type {
  SchemaObject,
  ReferenceObject,
  ResponseObject,
  RequestBodyObject,
  ParameterObject,
} from '@nestjs/swagger';
import { AuthController } from '../../modules/auth/auth.controller';
import { AuthService } from '../../modules/auth/auth.service';
import { UsersController } from '../../modules/users/users.controller';
import { UsersService } from '../../modules/users/users.service';
import {
  CategoriesController,
  AdminCategoriesController,
} from '../../modules/taxonomy/categories.controller';
import {
  TagsController,
  AdminTagsController,
} from '../../modules/taxonomy/tags.controller';
import { TaxonomyService } from '../../modules/taxonomy/taxonomy.service';
import {
  ArticlesController,
  AdminArticlesController,
} from '../../modules/articles/articles.controller';
import { ArticlesService } from '../../modules/articles/articles.service';
import { MediaController } from '../../modules/media/media.controller';
import { MediaService } from '../../modules/media/media.service';
import { HealthController } from '../../modules/health/health.controller';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { ObjectStorage } from '../../infrastructure/storage/object-storage';
import { setupHttp } from '../http/setup';
import { createApiDocument } from './setup-swagger';
describe('OpenAPI document', () => {
  let app: INestApplication;
  let doc: OpenAPIObject;
  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      controllers: [
        AuthController,
        UsersController,
        CategoriesController,
        AdminCategoriesController,
        TagsController,
        AdminTagsController,
        ArticlesController,
        AdminArticlesController,
        MediaController,
        HealthController,
      ],
      providers: [
        ...[
          AuthService,
          UsersService,
          TaxonomyService,
          ArticlesService,
          MediaService,
          CacheService,
          ObjectStorage,
        ].map((provide) => ({ provide, useValue: {} })),
        { provide: getConnectionToken(), useValue: {} },
        {
          provide: ConfigService,
          useValue: new ConfigService({
            CORS_ORIGINS: 'http://localhost:3000',
          }),
        },
      ],
    }).compile();
    app = fixture.createNestApplication();
    app.useLogger(false);
    setupHttp(app);
    doc = createApiDocument(app);
  });
  afterAll(async () => {
    await app.close();
  });
  it('documents all 35 operations and keeps health paths outside the API prefix', () => {
    const operations = Object.values(doc.paths).flatMap((path) =>
      Object.entries(path).filter(([key]) =>
        ['get', 'post', 'patch', 'delete'].includes(key),
      ),
    );
    expect(operations).toHaveLength(35);
    expect(doc.paths['/health/ready'].get?.summary).toBeDefined();
    expect(doc.paths['/api/v1/health/ready']).toBeUndefined();
    for (const [, operation] of operations)
      expect(operation).toHaveProperty('summary');
  });
  it('distinguishes public endpoints from bearer-protected routes', () => {
    expect(doc.paths['/api/v1/auth/login'].post?.security).toEqual([]);
    expect(doc.paths['/api/v1/articles'].get?.security).toEqual([]);
    expect(doc.paths['/api/v1/admin/articles'].post?.security).toEqual([
      { 'access-token': [] },
    ]);
    expect(doc.components?.securitySchemes?.['access-token']).toMatchObject({
      scheme: 'bearer',
    });
  });
  it('preserves required fields, nested DTOs, limits and optional PATCH fields', () => {
    const create = doc.components?.schemas?.CreateArticleDto as SchemaObject;
    const update = doc.components?.schemas?.UpdateArticleDto as SchemaObject;
    expect(create.required).toEqual(
      expect.arrayContaining(['title', 'slug', 'categoryId', 'content']),
    );
    expect(update.required).toEqual(['revision']);
    expect(create.properties?.title).toMatchObject({
      minLength: 5,
      maxLength: 250,
    });
    expect(create.properties?.content).toEqual({
      $ref: '#/components/schemas/ContentDto',
    });
    expect(doc.components?.schemas?.ContentDto).toHaveProperty(
      'properties.blocks',
    );
  });
  it('describes wrapped success and error responses with actual status codes', () => {
    const response = doc.paths['/api/v1/admin/articles'].post?.responses[
      '201'
    ] as ResponseObject;
    expect(response.content?.['application/json'].schema).toMatchObject({
      required: ['success', 'data', 'meta'],
      properties: { data: { $ref: '#/components/schemas/AdminArticle' } },
    });
    const error = doc.paths['/api/v1/admin/articles'].post?.responses[
      '400'
    ] as ResponseObject;
    expect(error.content?.['application/json'].schema).toEqual({
      $ref: '#/components/schemas/ErrorResponse',
    });
    expect(
      doc.paths['/api/v1/admin/articles/{id}/publish'].post?.responses['200'],
    ).toBeDefined();
    expect(
      doc.paths['/api/v1/admin/media/complete'].post?.responses['201'],
    ).toBeDefined();
  });
  it('includes DELETE request body and inherited query pagination', () => {
    const body = doc.paths['/api/v1/admin/articles/{id}'].delete
      ?.requestBody as RequestBodyObject;
    expect(body.content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/TransitionDto',
    });
    const parameters = doc.paths['/api/v1/articles'].get
      ?.parameters as ParameterObject[];
    expect(parameters.map((p) => p.name)).toEqual(
      expect.arrayContaining([
        'limit',
        'cursor',
        'categoryId',
        'authorId',
        'tagId',
      ]),
    );
  });
  it('has no dangling schema references', () => {
    function visit(value: unknown) {
      if (!value || typeof value !== 'object') return;
      if ('$ref' in value) {
        const reference = (value as ReferenceObject).$ref;
        if (reference.startsWith('#/components/schemas/'))
          expect(doc.components?.schemas).toHaveProperty(
            reference.slice('#/components/schemas/'.length),
          );
      }
      for (const child of Object.values(value)) visit(child);
    }
    visit(doc);
  });
});
