import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { MediaSchema } from './media.schema';
import { MediaRepository } from './media.repository';
import { MediaService } from './media.service';
import { MediaController } from './media.controller';
@Module({
  imports: [
    StorageModule,
    MongooseModule.forFeature([{ name: 'Media', schema: MediaSchema }]),
  ],
  providers: [MediaRepository, MediaService],
  controllers: [MediaController],
  exports: [MediaService],
})
export class MediaModule {}
