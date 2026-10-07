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
} from '@nestjs/common';
import { Public, Permissions } from '../../common/auth/security';
import { ObjectIdPipe } from '../../common/http/object-id.pipe';
import { ListQueryDto } from '../../common/http/query.dto';
import { TaxonomyService } from './taxonomy.service';
import { CreateTaxonomyDto, UpdateTaxonomyDto } from './taxonomy.dto';
@ApiTags('Public • Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly service: TaxonomyService) {}
  @ApiEndpoint('Daftar kategori', 'Taxonomy', {
    public: true,
    array: true,
    pagination: 'offset',
  })
  @Public()
  @Get()
  list(@Query() q: ListQueryDto) {
    return this.service.list('category', q.page, q.limit);
  }
}
@ApiTags('Admin • Categories')
@Controller('admin/categories')
@Permissions('taxonomy:manage')
export class AdminCategoriesController {
  constructor(private readonly service: TaxonomyService) {}
  @ApiEndpoint('Buat kategori', 'Taxonomy', {
    status: 201,
    description: 'Permission: taxonomy:manage.',
  })
  @Post()
  create(@Body() dto: CreateTaxonomyDto) {
    return this.service.create('category', dto);
  }
  @ApiEndpoint('Ubah kategori', 'Taxonomy', {
    description: 'Permission: taxonomy:manage.',
  })
  @Patch(':id')
  update(
    @Param('id', ObjectIdPipe) id: string,
    @Body() dto: UpdateTaxonomyDto,
  ) {
    return this.service.update('category', id, dto);
  }
  @ApiEndpoint('Soft delete kategori', 'Taxonomy', {
    description: 'Permission: taxonomy:manage.',
  })
  @Delete(':id')
  delete(@Param('id', ObjectIdPipe) id: string) {
    return this.service.update('category', id, { deletedAt: new Date() });
  }
}
