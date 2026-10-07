import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { Article } from './article.schema';
import { ArticleQueryDto, AdminArticleQueryDto } from './articles.dto';
import { decodeCursor } from './cursor';
@Injectable()
export class ArticlesRepository {
  constructor(@InjectModel('Article') private readonly model: Model<Article>) {}
  create(data: Record<string, unknown>) {
    return this.model.create(data);
  }
  find(id: string) {
    return this.model.findOne({ _id: id, deletedAt: null }).exec();
  }
  visible(slug: string) {
    return this.model
      .findOne({
        slug,
        status: 'published',
        deletedAt: null,
        publishedAt: { $lte: new Date() },
      })
      .select('_id revision')
      .lean()
      .exec();
  }
  publicDetail(id: string, revision: number) {
    return this.model
      .findOne({
        _id: id,
        revision,
        status: 'published',
        deletedAt: null,
        publishedAt: { $lte: new Date() },
      })
      .lean()
      .exec();
  }
  publicList(query: ArticleQueryDto) {
    const cursor = query.cursor ? decodeCursor(query.cursor) : undefined;
    return this.model
      .find({
        status: 'published',
        deletedAt: null,
        publishedAt: { $lte: new Date() },
        ...(query.categoryId
          ? { categoryId: new Types.ObjectId(query.categoryId) }
          : {}),
        ...(query.authorId
          ? { authorId: new Types.ObjectId(query.authorId) }
          : {}),
        ...(query.tagId ? { 'tags.id': query.tagId } : {}),
        ...(cursor
          ? {
              $or: [
                { publishedAt: { $lt: cursor.date } },
                { publishedAt: cursor.date, _id: { $lt: cursor.id } },
              ],
            }
          : {}),
      })
      .select('-content')
      .sort({ publishedAt: -1, _id: -1 })
      .limit(query.limit + 1)
      .lean()
      .exec();
  }
  adminList(query: AdminArticleQueryDto, ownerId?: string) {
    return this.model
      .find({
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(ownerId ? { authorId: ownerId } : {}),
      })
      .sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .exec();
  }
  update(id: string, revision: number, data: Record<string, unknown>) {
    return this.model
      .findOneAndUpdate(
        { _id: id, revision, deletedAt: null },
        { $set: data, $inc: { revision: 1 } },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();
  }
}
