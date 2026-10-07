import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { ApiError } from '../../common/http/api-error';
@Injectable()
export class CacheService implements OnModuleDestroy {
  readonly client: Redis;
  private readonly prefix: string;
  private readonly logger = new Logger(CacheService.name);
  constructor(config: ConfigService) {
    this.prefix = config.getOrThrow<string>('REDIS_PREFIX');
    this.client = new Redis(config.getOrThrow<string>('REDIS_CACHE_URL'), {
      connectTimeout: 2000,
      commandTimeout: 2000,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      retryStrategy: (n) => Math.min(n * 500, 5000),
    });
    this.client.on('error', () =>
      this.logger.warn(
        'Redis unavailable; cache bypassed, rate-limited endpoints fail closed',
      ),
    );
  }
  key(key: string) {
    return `${this.prefix}:${key}`;
  }
  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.client.get(this.key(key));
      return value ? (JSON.parse(value) as T) : null;
    } catch {
      return null;
    }
  }
  async set(key: string, value: unknown, ttl = 60) {
    try {
      await this.client.set(this.key(key), JSON.stringify(value), 'EX', ttl);
    } catch {
      /* cache is optional */
    }
  }
  async delete(key: string) {
    try {
      await this.client.del(this.key(key));
    } catch {
      /* TTL bounds stale data */
    }
  }
  async consume(key: string, limit: number, seconds: number) {
    try {
      const count = Number(
        await this.client.eval(
          "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
          1,
          this.key(`rate:${key}`),
          seconds,
        ),
      );
      if (count > limit)
        throw new ApiError(
          429,
          'RATE_LIMIT_EXCEEDED',
          'Too many requests, please try again later',
        );
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        503,
        'RATE_LIMIT_UNAVAILABLE',
        'Request protection is temporarily unavailable',
      );
    }
  }
  onModuleDestroy() {
    this.client.disconnect();
  }
}
