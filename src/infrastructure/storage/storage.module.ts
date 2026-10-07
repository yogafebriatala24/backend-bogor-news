import { Module } from '@nestjs/common';
import { ObjectStorage } from './object-storage';
import { MinioStorage } from './minio-storage';
@Module({
  providers: [{ provide: ObjectStorage, useClass: MinioStorage }],
  exports: [ObjectStorage],
})
export class StorageModule {}
