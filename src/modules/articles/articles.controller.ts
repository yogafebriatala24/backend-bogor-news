import { ApiTags } from '@nestjs/swagger';
import { ApiEndpoint } from '../../common/swagger/api-endpoint';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  HttpCode,
} from '@nestjs/common';
import { CurrentUser, Permissions, Public } from '../../common/auth/security';
import type { Actor } from '../../common/auth/security';
import { ObjectIdPipe } from '../../common/http/object-id.pipe';
import { ArticlesService } from './articles.service';
import {
  ArticleQueryDto,
  AdminArticleQueryDto,
  CreateArticleDto,
  UpdateArticleDto,
  TransitionDto,
} from './articles.dto';
@ApiTags('Public • Articles')
@Controller()
export class ArticlesController {
  constructor(private readonly service: ArticlesService) {}
  @ApiEndpoint('Daftar artikel published', 'ArticleSummary', {
    public: true,
    array: true,
    pagination: 'cursor',
  })
  @Public()
  @Get('articles')
  list(@Query() q: ArticleQueryDto) {
    return this.service.publicList(q);
  }
  @ApiEndpoint('Detail artikel published berdasarkan slug', 'PublicArticle', {
    public: true,
  })
  @Public()
  @Get('articles/:slug')
  detail(@Param('slug') slug: string) {
    return this.service.publicDetail(slug);
  }
  @ApiEndpoint(
    'Artikel published berdasarkan slug kategori',
    'ArticleSummary',
    { public: true, array: true, pagination: 'cursor' },
  )
  @Public()
  @Get('categories/:slug/articles')
  category(@Param('slug') slug: string, @Query() q: ArticleQueryDto) {
    return this.service.byTaxonomy('category', slug, q);
  }
  @ApiEndpoint('Artikel published berdasarkan slug tag', 'ArticleSummary', {
    public: true,
    array: true,
    pagination: 'cursor',
  })
  @Public()
  @Get('tags/:slug/articles')
  tag(@Param('slug') slug: string, @Query() q: ArticleQueryDto) {
    return this.service.byTaxonomy('tag', slug, q);
  }
}
@ApiTags('Admin • Articles')
@Controller('admin/articles')
export class AdminArticlesController {
  constructor(private readonly service: ArticlesService) {}
  @ApiEndpoint('Daftar artikel editorial', 'AdminArticle', {
    array: true,
    description:
      'Writer hanya melihat artikel sendiri. Pagination page/limit tanpa total count. Writer terbatas pada artikel sendiri; edit hanya saat draft. Semua mutasi artikel yang sudah ada memerlukan revision terbaru.',
  })
  @Get()
  list(@Query() q: AdminArticleQueryDto, @CurrentUser() actor: Actor) {
    return this.service.adminList(q, actor);
  }
  @ApiEndpoint('Detail artikel editorial', 'AdminArticle', {
    description:
      'Writer terbatas pada artikel sendiri; edit hanya saat draft. Semua mutasi artikel yang sudah ada memerlukan revision terbaru.',
  })
  @Get(':id')
  detail(@Param('id', ObjectIdPipe) id: string, @CurrentUser() actor: Actor) {
    return this.service.adminDetail(id, actor);
  }
  @ApiEndpoint('Buat draft artikel', 'AdminArticle', {
    status: 201,
    description:
      'Permission: article:create. Writer terbatas pada artikel sendiri; edit hanya saat draft. Semua mutasi artikel yang sudah ada memerlukan revision terbaru.',
  })
  @Post()
  @Permissions('article:create')
  create(@Body() dto: CreateArticleDto, @CurrentUser() actor: Actor) {
    return this.service.create(dto, actor);
  }
  @ApiEndpoint('Ubah artikel dengan kontrol revision', 'AdminArticle', {
    description:
      'Permission: article:update. Writer terbatas pada artikel sendiri; edit hanya saat draft. Semua mutasi artikel yang sudah ada memerlukan revision terbaru.',
  })
  @Patch(':id')
  @Permissions('article:update')
  update(
    @Param('id', ObjectIdPipe) id: string,
    @Body() dto: UpdateArticleDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.update(id, dto, actor);
  }
  @ApiEndpoint('Soft delete artikel', 'Deleted', {
    description:
      'Permission: article:delete. Writer terbatas pada artikel sendiri; edit hanya saat draft. Semua mutasi artikel yang sudah ada memerlukan revision terbaru.',
  })
  @Delete(':id')
  @Permissions('article:delete')
  delete(
    @Param('id', ObjectIdPipe) id: string,
    @Body() dto: TransitionDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.delete(id, dto.revision, actor);
  }
  @ApiEndpoint('Ajukan draft ke review', 'AdminArticle', {
    description:
      'Permission: article:review. Writer terbatas pada artikel sendiri; edit hanya saat draft. Semua mutasi artikel yang sudah ada memerlukan revision terbaru.',
  })
  @Post(':id/review')
  @HttpCode(200)
  @Permissions('article:review')
  review(
    @Param('id', ObjectIdPipe) id: string,
    @Body() dto: TransitionDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.transition(id, dto.revision, 'review', actor);
  }
  @ApiEndpoint('Kembalikan review ke draft', 'AdminArticle', {
    description:
      'Permission: article:publish. Writer terbatas pada artikel sendiri; edit hanya saat draft. Semua mutasi artikel yang sudah ada memerlukan revision terbaru.',
  })
  @Post(':id/reject')
  @HttpCode(200)
  @Permissions('article:publish')
  reject(
    @Param('id', ObjectIdPipe) id: string,
    @Body() dto: TransitionDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.transition(id, dto.revision, 'draft', actor);
  }
  @ApiEndpoint('Publikasikan artikel yang sudah review', 'AdminArticle', {
    description:
      'Permission: article:publish. Writer terbatas pada artikel sendiri; edit hanya saat draft. Semua mutasi artikel yang sudah ada memerlukan revision terbaru.',
  })
  @Post(':id/publish')
  @HttpCode(200)
  @Permissions('article:publish')
  publish(
    @Param('id', ObjectIdPipe) id: string,
    @Body() dto: TransitionDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.transition(id, dto.revision, 'published', actor);
  }
  @ApiEndpoint('Arsipkan artikel published', 'AdminArticle', {
    description:
      'Permission: article:publish. Writer terbatas pada artikel sendiri; edit hanya saat draft. Semua mutasi artikel yang sudah ada memerlukan revision terbaru.',
  })
  @Post(':id/archive')
  @HttpCode(200)
  @Permissions('article:publish')
  archive(
    @Param('id', ObjectIdPipe) id: string,
    @Body() dto: TransitionDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.transition(id, dto.revision, 'archived', actor);
  }
}
