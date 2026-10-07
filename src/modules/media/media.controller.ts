import { ApiTags } from '@nestjs/swagger';
import { ApiEndpoint } from '../../common/swagger/api-endpoint';
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser, Permissions } from '../../common/auth/security';
import type { Actor } from '../../common/auth/security';
import { ObjectIdPipe } from '../../common/http/object-id.pipe';
import { ListQueryDto } from '../../common/http/query.dto';
import { UploadIntentDto, CompleteUploadDto } from './media.dto';
import { MediaService } from './media.service';
@ApiTags('Admin • Media')
@Controller('admin/media')
@Permissions('media:upload')
export class MediaController {
  constructor(private readonly service: MediaService) {}
  @ApiEndpoint('Daftar metadata media', 'Media', {
    array: true,
    description:
      'Writer hanya melihat media sendiri. Pagination page/limit tanpa total count. Permission: media:upload.',
  })
  @Get()
  list(@Query() q: ListQueryDto, @CurrentUser() actor: Actor) {
    return this.service.list(actor, q.page, q.limit);
  }
  @ApiEndpoint('Buat presigned POST upload intent', 'UploadIntent', {
    status: 201,
    description:
      'Upload file langsung ke URL MinIO memakai semua fields sebagai multipart form dan file terakhir. Intent berlaku 5 menit. Permission: media:upload.',
  })
  @Post('upload-url')
  upload(@Body() dto: UploadIntentDto, @CurrentUser() actor: Actor) {
    return this.service.intent(dto, actor);
  }
  @ApiEndpoint('Verifikasi dan selesaikan upload', 'Media', {
    status: 201,
    description:
      'Verifikasi size, MIME dan magic bytes. Pemanggilan ulang untuk media complete mengembalikan metadata yang sama. Permission: media:upload.',
  })
  @Post('complete')
  complete(@Body() dto: CompleteUploadDto, @CurrentUser() actor: Actor) {
    return this.service.complete(dto.mediaId, actor);
  }
  @ApiEndpoint('Buat URL download sementara', 'DownloadUrl', {
    description:
      'URL berlaku 15 menit. Writer hanya dapat mengakses media sendiri. Permission: media:upload.',
  })
  @Get(':id/download-url')
  download(@Param('id', ObjectIdPipe) id: string, @CurrentUser() actor: Actor) {
    return this.service.download(id, actor);
  }
  @ApiEndpoint('Soft delete metadata media', 'Deleted', {
    description: 'Permission: media:upload.',
  })
  @Delete(':id')
  delete(@Param('id', ObjectIdPipe) id: string, @CurrentUser() actor: Actor) {
    return this.service.delete(id, actor);
  }
}
