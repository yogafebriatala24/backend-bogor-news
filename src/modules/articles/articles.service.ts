import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { ArticlesRepository } from './articles.repository';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import { MediaService } from '../media/media.service';
import { CacheService } from '../../infrastructure/cache/cache.service';
import { ApiError } from '../../common/http/api-error';
import { Page } from '../../common/http/response.interceptor';
import type { Actor } from '../../common/auth/security';
import {
  CreateArticleDto,
  UpdateArticleDto,
  ArticleQueryDto,
  AdminArticleQueryDto,
} from './articles.dto';
import { encodeCursor } from './cursor';
import type { Article } from './article.schema';
export function assertTransition(
  status: string,
  target: string,
  actorRole: string,
  isOwner: boolean,
) {
  const allowed: Record<string, string[]> = {
    review: ['draft'],
    draft: ['review'],
    published: ['review'],
    archived: ['published'],
  };
  if (actorRole === 'writer' && (target !== 'review' || !isOwner))
    throw new ApiError(
      403,
      'ARTICLE_FORBIDDEN',
      'Writer may only submit their own draft for review',
    );
  if (!allowed[target]?.includes(status))
    throw new ApiError(
      409,
      'INVALID_ARTICLE_TRANSITION',
      `Cannot transition article from ${status} to ${target}`,
    );
}
@Injectable()
export class ArticlesService {
  constructor(
    private readonly repository: ArticlesRepository,
    private readonly taxonomy: TaxonomyService,
    private readonly media: MediaService,
    private readonly cache: CacheService,
  ) {}
  async create(dto: CreateArticleDto, actor: Actor) {
    const relations = await this.relations(dto, actor);
    return this.adminPresent(
      await this.repository.create({
        title: dto.title,
        slug: dto.slug,
        excerpt: dto.excerpt,
        content: dto.content,
        seo: dto.seo,
        thumbnailId: dto.thumbnailId,
        ...relations,
        authorId: new Types.ObjectId(actor.id),
        authorSnapshot: { id: actor.id, name: actor.name },
      }),
    );
  }
  async update(id: string, dto: UpdateArticleDto, actor: Actor) {
    const article = await this.owned(id, actor);
    if (actor.role === 'writer' && article.status !== 'draft')
      throw new ApiError(
        403,
        'ARTICLE_LOCKED',
        'Writers may edit only their own drafts',
      );
    if (article.revision !== dto.revision)
      throw new ApiError(
        409,
        'REVISION_CONFLICT',
        'Article changed; reload before saving',
      );
    const { revision, tagIds, categoryId, ...fields } = dto;
    void tagIds;
    void categoryId;
    const relations = await this.relations(dto, actor);
    const updated = await this.repository.update(id, revision, {
      ...fields,
      ...relations,
    });
    if (!updated)
      throw new ApiError(
        409,
        'REVISION_CONFLICT',
        'Article changed; reload before saving',
      );
    await this.cache.delete(`article:${id}:v${revision}`);
    return this.adminPresent(updated);
  }
  async transition(
    id: string,
    revision: number,
    target: 'draft' | 'review' | 'published' | 'archived',
    actor: Actor,
  ) {
    const article = await this.owned(id, actor);
    assertTransition(
      article.status,
      target,
      actor.role,
      article.authorId.toString() === actor.id,
    );
    const updated = await this.repository.update(id, revision, {
      status: target,
      ...(target === 'published' ? { publishedAt: new Date() } : {}),
    });
    if (!updated)
      throw new ApiError(
        409,
        'REVISION_CONFLICT',
        'Article changed; reload before saving',
      );
    await this.cache.delete(`article:${id}:v${article.revision}`);
    return this.adminPresent(updated);
  }
  async delete(id: string, revision: number, actor: Actor) {
    const article = await this.owned(id, actor);
    const deleted = await this.repository.update(id, revision, {
      deletedAt: new Date(),
      deletedBy: new Types.ObjectId(actor.id),
    });
    if (!deleted)
      throw new ApiError(
        409,
        'REVISION_CONFLICT',
        'Article changed; reload before deleting',
      );
    await this.cache.delete(`article:${id}:v${article.revision}`);
    return { id, deleted: true };
  }
  async publicDetail(slug: string) {
    // Check visibility/version before cache lookup: archived or deleted content must not leak from stale cache.
    const visible = await this.repository.visible(slug);
    if (!visible)
      throw new ApiError(404, 'ARTICLE_NOT_FOUND', 'Article not found');
    const key = `article:${String(visible._id)}:v${visible.revision}`;
    let article = await this.cache.get<Record<string, unknown>>(key);
    if (!article) {
      const doc = await this.repository.publicDetail(
        String(visible._id),
        visible.revision,
      );
      if (!doc)
        throw new ApiError(404, 'ARTICLE_NOT_FOUND', 'Article not found');
      article = this.publicPresent(doc);
      await this.cache.set(key, article, 60);
    }
    const thumbnailId = article.thumbnailId as string | null;
    const { thumbnailId: _thumbnailId, ...response } = article;
    void _thumbnailId;
    return {
      ...response,
      thumbnail: thumbnailId ? await this.media.publicImage(thumbnailId) : null,
    };
  }
  async publicList(query: ArticleQueryDto) {
    const rows = await this.repository.publicList(query);
    const more = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    const last = items.at(-1);
    const data = await Promise.all(
      items.map(async (doc) => {
        const { thumbnailId, ...item } = this.publicPresent(doc);
        return {
          ...item,
          thumbnail: thumbnailId
            ? await this.media.publicImage(thumbnailId)
            : null,
        };
      }),
    );
    return new Page(data, {
      nextCursor:
        more && last ? encodeCursor(last.publishedAt!, last._id) : null,
    });
  }
  async byTaxonomy(
    kind: 'category' | 'tag',
    slug: string,
    query: ArticleQueryDto,
  ) {
    const id = await this.taxonomy.bySlug(kind, slug);
    return this.publicList({
      ...query,
      ...(kind === 'category' ? { categoryId: id } : { tagId: id }),
    });
  }
  async adminList(query: AdminArticleQueryDto, actor: Actor) {
    return (
      await this.repository.adminList(
        query,
        actor.role === 'writer' ? actor.id : undefined,
      )
    ).map((item) => this.adminPresent(item));
  }
  async adminDetail(id: string, actor: Actor) {
    return this.adminPresent(await this.owned(id, actor));
  }
  private async owned(id: string, actor: Actor) {
    const article = await this.repository.find(id);
    if (!article)
      throw new ApiError(404, 'ARTICLE_NOT_FOUND', 'Article not found');
    if (actor.role === 'writer' && article.authorId.toString() !== actor.id)
      throw new ApiError(
        403,
        'ARTICLE_FORBIDDEN',
        'Cannot access another writer’s article',
      );
    return article;
  }
  private async relations(
    dto: CreateArticleDto | UpdateArticleDto,
    actor: Actor,
  ) {
    const fields: Record<string, unknown> = {};
    if (dto.categoryId !== undefined) {
      fields.categorySnapshot = await this.taxonomy.resolve(
        'category',
        dto.categoryId,
      );
      fields.categoryId = new Types.ObjectId(dto.categoryId);
    }
    if (dto.tagIds !== undefined)
      fields.tags = await Promise.all(
        dto.tagIds.map((id) => this.taxonomy.resolve('tag', id)),
      );
    if (dto.thumbnailId)
      await this.media.imageForArticle(dto.thumbnailId, actor);
    return fields;
  }
  private publicPresent(article: Article & { _id: unknown }) {
    return {
      id: String(article._id),
      title: article.title,
      slug: article.slug,
      excerpt: article.excerpt,
      content: article.content,
      author: article.authorSnapshot,
      category: article.categorySnapshot,
      tags: article.tags,
      thumbnailId: article.thumbnailId,
      seo: article.seo,
      publishedAt: article.publishedAt,
      updatedAt: article.updatedAt,
    };
  }
  private adminPresent(article: Article & { _id: unknown }) {
    return {
      ...this.publicPresent(article),
      authorId: String(article.authorId),
      categoryId: String(article.categoryId),
      status: article.status,
      revision: article.revision,
      createdAt: article.createdAt,
    };
  }
}
