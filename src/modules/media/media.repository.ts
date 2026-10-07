import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Media } from './media.schema';
@Injectable()
export class MediaRepository {
  constructor(@InjectModel('Media') private readonly model: Model<Media>) {}
  create(
    data: Pick<
      Media,
      | 'ownerId'
      | 'filename'
      | 'mimeType'
      | 'size'
      | 'temporaryKey'
      | 'expiresAt'
    >,
  ) {
    return this.model.create(data);
  }
  find(id: string) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }
  complete(id: string, key: string) {
    return this.model
      .findOneAndUpdate(
        { _id: id, status: 'pending', deletedAt: null },
        { $set: { objectKey: key, status: 'complete' } },
        { returnDocument: 'after' },
      )
      .exec();
  }
  delete(id: string) {
    return this.model
      .findOneAndUpdate(
        { _id: id, deletedAt: null },
        { $set: { status: 'deleted', deletedAt: new Date() } },
        { returnDocument: 'after' },
      )
      .exec();
  }
  list(ownerId: string | undefined, page: number, limit: number) {
    const filter = { deletedAt: null, ...(ownerId ? { ownerId } : {}) };
    return this.model
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();
  }
}
