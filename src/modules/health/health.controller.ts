import { ApiTags } from '@nestjs/swagger';
import { ApiEndpoint } from '../../common/swagger/api-endpoint';
import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { Public } from '../../common/auth/security';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { ObjectStorage } from '../../infrastructure/storage/object-storage';
import { ApiError } from '../../common/http/api-error';
@ApiTags('Health')
@Controller('health')
@Public()
export class HealthController {
  constructor(
    @InjectConnection() private readonly db: Connection,
    private readonly cache: CacheService,
    private readonly storage: ObjectStorage,
  ) {}
  @ApiEndpoint('Periksa proses API', 'Liveness', { public: true, health: true })
  @Get('live')
  live() {
    return { status: 'ok' };
  }
  @ApiEndpoint('Periksa MongoDB, Redis dan MinIO', 'Readiness', {
    public: true,
    health: true,
  })
  @Get('ready')
  async ready() {
    const results = await Promise.allSettled([
      this.db.db?.admin().ping({ maxTimeMS: 2000 }) ??
        Promise.reject(new Error('Disconnected')),
      this.cache.client.ping(),
      this.storage.health().then((exists) => {
        if (!exists) throw new Error('Bucket missing');
      }),
    ]);
    if (results.some((result) => result.status === 'rejected'))
      throw new ApiError(
        503,
        'DEPENDENCIES_UNAVAILABLE',
        'One or more required dependencies are unavailable',
      );
    return {
      status: 'ok',
      checks: { mongodb: 'up', redis: 'up', minio: 'up' },
    };
  }
}
