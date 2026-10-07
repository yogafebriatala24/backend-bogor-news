import { ApiTags } from '@nestjs/swagger';
import { ApiEndpoint } from '../../common/swagger/api-endpoint';
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, Permissions } from '../../common/auth/security';
import type { Actor } from '../../common/auth/security';
import { ObjectIdPipe } from '../../common/http/object-id.pipe';
import { ListQueryDto } from '../../common/http/query.dto';
import { CreateUserDto, UpdateUserDto } from './users.dto';
import { UsersService } from './users.service';
@ApiTags('Admin • Users')
@Controller('admin/users')
@Permissions('user:manage')
export class UsersController {
  constructor(private readonly service: UsersService) {}
  @ApiEndpoint('Daftar users', 'User', {
    array: true,
    pagination: 'offset',
    description: 'Permission: user:manage.',
  })
  @Get()
  list(@Query() query: ListQueryDto) {
    return this.service.list(query.page, query.limit);
  }
  @ApiEndpoint('Buat user', 'User', {
    status: 201,
    description: 'Permission: user:manage.',
  })
  @Post()
  create(@Body() dto: CreateUserDto, @CurrentUser() actor: Actor) {
    return this.service.create(dto, actor);
  }
  @ApiEndpoint('Ubah nama, role atau status user', 'User', {
    description: 'Permission: user:manage.',
  })
  @Patch(':id')
  update(
    @Param('id', ObjectIdPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() actor: Actor,
  ) {
    return this.service.update(id, dto, actor);
  }
}
