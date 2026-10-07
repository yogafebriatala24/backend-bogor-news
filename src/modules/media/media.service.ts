import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Types } from 'mongoose';
import { ObjectStorage } from '../../infrastructure/storage/object-storage';
import { MediaRepository } from './media.repository';
import { UploadIntentDto } from './media.dto';
import type { Actor } from '../../common/auth/security';
import { ApiError } from '../../common/http/api-error';
export function matchesMagic(body: Buffer, mime: string) {
  if (mime === 'image/jpeg')
    return (
      body.length >= 3 && body[0] === 255 && body[1] === 216 && body[2] === 255
    );
  if (mime === 'image/png')
    return body
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mime === 'image/webp')
    return (
      body.length >= 12 &&
      body.toString('ascii', 0, 4) === 'RIFF' &&
      body.toString('ascii', 8, 12) === 'WEBP'
    );
  return mime === 'application/pdf' && body.toString('ascii', 0, 5) === '%PDF-';
}
@Injectable()
export class MediaService {
  private readonly logger = new Logger(MediaService.name);
  constructor(
    private readonly repository: MediaRepository,
    private readonly storage: ObjectStorage,
    private readonly config: ConfigService,
  ) {}
  async intent(dto: UploadIntentDto, actor: Actor) {
    if (dto.size > this.config.getOrThrow<number>('MAX_UPLOAD_BYTES'))
      throw new ApiError(
        400,
        'FILE_TOO_LARGE',
        'File exceeds configured upload limit',
      );
    const temporaryKey = `temporary/${actor.id}/${randomUUID()}`;
    const upload = await this.storage.uploadForm(
      temporaryKey,
      dto.mimeType,
      dto.size,
    );
    const media = await this.repository.create({
      ...dto,
      ownerId: new Types.ObjectId(actor.id),
      temporaryKey,
      expiresAt: new Date(Date.now() + 300000),
    });
    return {
      mediaId: media.id,
      method: 'POST',
      url: upload.postURL,
      fields: upload.formData,
      expiresIn: 300,
    };
  }
  async complete(id: string, actor: Actor) {
    const media = await this.owned(id, actor);
    if (media.status === 'complete') return this.present(media);
    if (media.expiresAt.getTime() < Date.now())
      throw new ApiError(409, 'UPLOAD_EXPIRED', 'Upload intent has expired');
    const stat = await this.storage.stat(media.temporaryKey);
    if (stat.size !== media.size || stat.mimeType !== media.mimeType)
      throw new ApiError(
        400,
        'INVALID_UPLOAD',
        'Uploaded size or MIME type does not match upload intent',
      );
    const body = await this.storage.read(media.temporaryKey, media.size);
    if (body.length !== media.size || !matchesMagic(body, media.mimeType))
      throw new ApiError(
        400,
        'INVALID_UPLOAD',
        'File signature does not match declared MIME type',
      );
    const key = `media/${actor.id}/${media.id}/${randomUUID()}`;
    await this.storage.put(key, body, media.mimeType);
    const completed = await this.repository.complete(id, key);
    if (!completed) {
      await this.storage.delete(key);
      return this.present(await this.owned(id, actor));
    }
    try {
      await this.storage.delete(media.temporaryKey);
    } catch {
      this.logger.warn('Temporary upload cleanup deferred');
    }
    return this.present(completed);
  }
  async imageForArticle(id: string, actor: Actor) {
    const media = await this.owned(id, actor);
    if (media.status !== 'complete' || !media.mimeType.startsWith('image/'))
      throw new ApiError(
        400,
        'INVALID_THUMBNAIL',
        'Thumbnail must be a completed image',
      );
    return id;
  }
  async publicImage(id: string) {
    const media = await this.repository.find(id);
    if (!media?.objectKey || media.status !== 'complete') return null;
    try {
      return {
        id: media.id,
        url: await this.storage.downloadUrl(media.objectKey),
        mimeType: media.mimeType,
      };
    } catch (error) {
      if (!(error instanceof ApiError) || error.getStatus() !== 503)
        throw error;
      this.logger.warn('Thumbnail unavailable; article remains readable');
      return null;
    }
  }
  async download(id: string, actor: Actor) {
    const media = await this.owned(id, actor);
    if (media.status !== 'complete' || !media.objectKey)
      throw new ApiError(409, 'UPLOAD_INCOMPLETE', 'Upload is not complete');
    return {
      url: await this.storage.downloadUrl(media.objectKey),
      expiresIn: 900,
    };
  }
  async list(actor: Actor, page: number, limit: number) {
    return (
      await this.repository.list(
        actor.role === 'writer' ? actor.id : undefined,
        page,
        limit,
      )
    ).map((media) => this.present(media));
  }
  async delete(id: string, actor: Actor) {
    await this.owned(id, actor);
    await this.repository.delete(id);
    return { id, deleted: true };
  }
  private async owned(id: string, actor: Actor) {
    const media = await this.repository.find(id);
    if (!media) throw new ApiError(404, 'MEDIA_NOT_FOUND', 'Media not found');
    if (actor.role === 'writer' && media.ownerId.toString() !== actor.id)
      throw new ApiError(
        403,
        'MEDIA_FORBIDDEN',
        'Cannot access another writer’s media',
      );
    return media;
  }
  private present(media: {
    _id: unknown;
    filename: string;
    mimeType: string;
    size: number;
    status: string;
  }) {
    return {
      id: String(media._id),
      filename: media.filename,
      mimeType: media.mimeType,
      size: media.size,
      status: media.status,
    };
  }
}
