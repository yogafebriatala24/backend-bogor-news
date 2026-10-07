import { Injectable } from '@nestjs/common';
import { TaxonomyRepository } from './taxonomy.repository';
import type { TaxonomyKind } from './taxonomy.schema';
import { CreateTaxonomyDto, UpdateTaxonomyDto } from './taxonomy.dto';
import { ApiError } from '../../common/http/api-error';
import { Page } from '../../common/http/response.interceptor';
@Injectable()
export class TaxonomyService {
  constructor(private readonly repository: TaxonomyRepository) {}
  async list(kind: TaxonomyKind, page: number, limit: number) {
    const [items, total] = await Promise.all([
      this.repository.list(kind, page, limit),
      this.repository.count(kind),
    ]);
    return new Page(
      items.map((item) => this.present(item)),
      { page, limit, total },
    );
  }
  async create(kind: TaxonomyKind, dto: CreateTaxonomyDto) {
    return this.present(await this.repository.create(kind, dto));
  }
  async update(
    kind: TaxonomyKind,
    id: string,
    dto: UpdateTaxonomyDto | { deletedAt: Date },
  ) {
    const item = await this.repository.update(kind, id, dto);
    if (!item)
      throw new ApiError(
        404,
        'TAXONOMY_NOT_FOUND',
        'Category or tag not found',
      );
    return this.present(item);
  }
  async resolve(kind: TaxonomyKind, id: string) {
    const item = await this.repository.findById(kind, id);
    if (!item)
      throw new ApiError(
        404,
        'TAXONOMY_NOT_FOUND',
        'Category or tag not found',
      );
    return { id: item.id, name: item.name, slug: item.slug };
  }
  async bySlug(kind: TaxonomyKind, slug: string) {
    const item = await this.repository.findBySlug(kind, slug);
    if (!item)
      throw new ApiError(
        404,
        'TAXONOMY_NOT_FOUND',
        'Category or tag not found',
      );
    return item.id;
  }
  private present(item: {
    _id: unknown;
    name: string;
    slug: string;
    description: string;
  }) {
    return {
      id: String(item._id),
      name: item.name,
      slug: item.slug,
      description: item.description,
    };
  }
}
