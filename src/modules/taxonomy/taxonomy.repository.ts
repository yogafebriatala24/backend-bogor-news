import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { Taxonomy, TaxonomyKind } from './taxonomy.schema';
import { CreateTaxonomyDto, UpdateTaxonomyDto } from './taxonomy.dto';
@Injectable()
export class TaxonomyRepository {
  constructor(
    @InjectModel('Category') private readonly categories: Model<Taxonomy>,
    @InjectModel('Tag') private readonly tags: Model<Taxonomy>,
  ) {}
  private model(kind: TaxonomyKind) {
    return kind === 'category' ? this.categories : this.tags;
  }
  findById(kind: TaxonomyKind, id: string) {
    return this.model(kind).findOne({ _id: id, deletedAt: null }).exec();
  }
  findBySlug(kind: TaxonomyKind, slug: string) {
    return this.model(kind).findOne({ slug, deletedAt: null }).exec();
  }
  list(kind: TaxonomyKind, page: number, limit: number) {
    return this.model(kind)
      .find({ deletedAt: null })
      .sort({ name: 1, _id: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();
  }
  count(kind: TaxonomyKind) {
    return this.model(kind).countDocuments({ deletedAt: null }).exec();
  }
  create(kind: TaxonomyKind, dto: CreateTaxonomyDto) {
    return this.model(kind).create(dto);
  }
  update(
    kind: TaxonomyKind,
    id: string,
    dto: UpdateTaxonomyDto | { deletedAt: Date },
  ) {
    return this.model(kind)
      .findOneAndUpdate(
        { _id: id, deletedAt: null },
        { $set: dto },
        { returnDocument: 'after', runValidators: true },
      )
      .exec();
  }
}
