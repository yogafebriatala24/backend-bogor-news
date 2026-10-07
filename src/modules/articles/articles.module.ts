import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ArticleSchema } from './article.schema';
import { ArticlesRepository } from './articles.repository';
import { ArticlesService } from './articles.service';
import {
  ArticlesController,
  AdminArticlesController,
} from './articles.controller';
import { TaxonomyModule } from '../taxonomy/taxonomy.module';
import { MediaModule } from '../media/media.module';
@Module({
  imports: [
    TaxonomyModule,
    MediaModule,
    MongooseModule.forFeature([{ name: 'Article', schema: ArticleSchema }]),
  ],
  providers: [ArticlesRepository, ArticlesService],
  controllers: [ArticlesController, AdminArticlesController],
})
export class ArticlesModule {}
