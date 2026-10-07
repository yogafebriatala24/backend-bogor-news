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
@ApiTags('Public • Tags')
@Controller('tags')
export class TagsController {
  constructor(private readonly service: TaxonomyService) {}
  @ApiEndpoint('Daftar tag', 'Taxonomy', {
    public: true,
    array: true,
    pagination: 'offset',
  })
  @Public()
  @Get()
  list(@Query() q: ListQueryDto) {
    return this.service.list('tag', q.page, q.limit);
  }
}
@ApiTags('Admin • Tags')
@Controller('admin/tags')
@Permissions('taxonomy:manage')
export class AdminTagsController {
  constructor(private readonly service: TaxonomyService) {}
  @ApiEndpoint('Buat tag', 'Taxonomy', {
    status: 201,
    description: 'Permission: taxonomy:manage.',
  })
  @Post()
  create(@Body() dto: CreateTaxonomyDto) {
    return this.service.create('tag', dto);
  }
  @ApiEndpoint('Ubah tag', 'Taxonomy', {
    description: 'Permission: taxonomy:manage.',
  })
  @Patch(':id')
  update(
    @Param('id', ObjectIdPipe) id: string,
    @Body() dto: UpdateTaxonomyDto,
  ) {
    return this.service.update('tag', id, dto);
  }
  @ApiEndpoint('Soft delete tag', 'Taxonomy', {
    description: 'Permission: taxonomy:manage.',
  })
  @Delete(':id')
  delete(@Param('id', ObjectIdPipe) id: string) {
    return this.service.update('tag', id, { deletedAt: new Date() });
  }
}
