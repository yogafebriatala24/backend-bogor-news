import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TaxonomySchema } from './taxonomy.schema';
import { TaxonomyRepository } from './taxonomy.repository';
import { TaxonomyService } from './taxonomy.service';
import {
  CategoriesController,
  AdminCategoriesController,
} from './categories.controller';
import { TagsController, AdminTagsController } from './tags.controller';
@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: 'Category',
        schema: TaxonomySchema.clone(),
        collection: 'categories',
      },
      { name: 'Tag', schema: TaxonomySchema.clone(), collection: 'tags' },
    ]),
  ],
  providers: [TaxonomyRepository, TaxonomyService],
  controllers: [
    CategoriesController,
    AdminCategoriesController,
    TagsController,
    AdminTagsController,
  ],
  exports: [TaxonomyService],
})
export class TaxonomyModule {}
