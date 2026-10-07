import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { Agent as HttpAgent } from 'node:http';
import { Agent as HttpsAgent } from 'node:https';
import { ObjectStorage } from './object-storage';
import { ApiError } from '../../common/http/api-error';
@Injectable()
export class MinioStorage
  extends ObjectStorage
  implements OnModuleInit, OnModuleDestroy
{
  private readonly client: Client;
  private readonly bucket: string;
  private readonly agent: HttpAgent | HttpsAgent;
  private readonly logger = new Logger(MinioStorage.name);
  constructor(config: ConfigService) {
    super();
    const ssl = config.get<string>('MINIO_USE_SSL') === 'true';
    this.agent = ssl
      ? new HttpsAgent({ keepAlive: true, timeout: 5000 })
      : new HttpAgent({ keepAlive: true, timeout: 5000 });
    this.client = new Client({
      endPoint: config.getOrThrow<string>('MINIO_ENDPOINT'),
      port: config.getOrThrow<number>('MINIO_PORT'),
      useSSL: ssl,
      accessKey: config.getOrThrow<string>('MINIO_ACCESS_KEY'),
      secretKey: config.getOrThrow<string>('MINIO_SECRET_KEY'),
      transportAgent: this.agent,
    });
    this.bucket = config.getOrThrow<string>('MINIO_BUCKET');
  }
  async onModuleInit() {
    try {
      await this.ensureBucket();
    } catch {
      this.logger.warn(
        'MinIO bucket unavailable; uploads return a controlled error until storage is ready',
      );
    }
  }
  onModuleDestroy() {
    this.agent.destroy();
  }
  private async call<T>(operation: Promise<T>): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    try {
      return await Promise.race([
        operation,
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('StorageTimeout')), 5000);
        }),
      ]);
    } catch {
      throw new ApiError(
        503,
        'STORAGE_UNAVAILABLE',
        'Object storage operation failed',
      );
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
  async ensureBucket() {
    if (!(await this.call(this.client.bucketExists(this.bucket)))) {
      try {
        await this.call(this.client.makeBucket(this.bucket));
      } catch (error) {
        if (!(await this.health())) throw error;
      }
    }
  }
  health() {
    return this.call(this.client.bucketExists(this.bucket));
  }
  async uploadForm(key: string, mimeType: string, size: number) {
    await this.ensureBucket();
    const policy = this.client.newPostPolicy();
    policy.setBucket(this.bucket);
    policy.setKey(key);
    policy.setContentType(mimeType);
    policy.setContentLengthRange(size, size);
    policy.setExpires(new Date(Date.now() + 300000));
    return this.call(this.client.presignedPostPolicy(policy));
  }
  async stat(key: string) {
    const stat = await this.call(this.client.statObject(this.bucket, key));
    return {
      size: stat.size,
      mimeType: String(stat.metaData['content-type'] ?? ''),
    };
  }
  async read(key: string, maxBytes: number) {
    const stream = await this.call(this.client.getObject(this.bucket, key));
    const timer = setTimeout(
      () => stream.destroy(new Error('StorageReadTimeout')),
      5000,
    );
    try {
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of stream) {
        const buffer = Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(chunk as Uint8Array);
        size += buffer.length;
        if (size > maxBytes)
          throw new ApiError(
            400,
            'INVALID_UPLOAD',
            'Uploaded file exceeds declared size',
          );
        chunks.push(buffer);
      }
      return Buffer.concat(chunks);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(
        503,
        'STORAGE_UNAVAILABLE',
        'Cannot read uploaded object',
      );
    } finally {
      clearTimeout(timer);
      stream.destroy();
    }
  }
  async put(key: string, body: Buffer, mimeType: string) {
    await this.call(
      this.client.putObject(this.bucket, key, body, body.length, {
        'Content-Type': mimeType,
      }),
    );
  }
  downloadUrl(key: string) {
    return this.call(this.client.presignedGetObject(this.bucket, key, 900));
  }
  async delete(key: string) {
    await this.call(this.client.removeObject(this.bucket, key));
  }
}
