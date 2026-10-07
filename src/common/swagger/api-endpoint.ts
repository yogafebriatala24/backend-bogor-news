import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';
import { ref } from './response-schemas';
interface EndpointOptions {
  status?: number;
  array?: boolean;
  pagination?: 'cursor' | 'offset';
  public?: boolean;
  unauthorized?: boolean;
  description?: string;
  health?: boolean;
}
export function ApiEndpoint(
  summary: string,
  model: string,
  options: EndpointOptions = {},
) {
  const meta: SchemaObject = { allOf: [ref('ResponseMeta')] };
  if (options.pagination)
    meta.allOf!.push({
      type: 'object',
      required:
        options.pagination === 'cursor'
          ? ['nextCursor']
          : ['page', 'limit', 'total'],
      properties:
        options.pagination === 'cursor'
          ? { nextCursor: { type: 'string', nullable: true } }
          : {
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
            },
    });
  const errors: Record<number, string> = options.health
    ? { 503: 'Dependency unavailable', 500: 'Unexpected internal error' }
    : {
        400: 'Invalid input or cursor',
        404: 'Resource not found',
        409: 'Duplicate resource, revision conflict or invalid state',
        413: 'JSON body exceeds 100 KiB',
        429: 'Rate limit exceeded',
        500: 'Unexpected internal error',
        503: 'Dependency unavailable',
      };
  if (!options.public || options.unauthorized) {
    errors[401] = 'Invalid credentials or expired token/session';
  }
  if (!options.public) errors[403] = 'Permission or ownership denied';
  return applyDecorators(
    ApiOperation({
      summary,
      description: options.description,
      security: options.public ? [] : [{ 'access-token': [] }],
    }),
    ApiResponse({
      status: options.status ?? 200,
      description: 'Successful response',
      headers: {
        'X-Request-ID': {
          description: 'Request correlation ID',
          schema: { type: 'string', format: 'uuid' },
        },
      },
      schema: {
        type: 'object',
        required: ['success', 'data', 'meta'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          data: options.array
            ? { type: 'array', items: ref(model) }
            : ref(model),
          meta,
        },
      },
    }),
    ...Object.entries(errors).map(([status, description]) =>
      ApiResponse({
        status: Number(status),
        description,
        schema: ref('ErrorResponse'),
      }),
    ),
  );
}
