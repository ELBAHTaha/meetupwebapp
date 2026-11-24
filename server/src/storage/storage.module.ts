import { Global, Module } from '@nestjs/common';
import { StorageService } from './storage.service';
import { STORAGE_DRIVER } from './storage.driver';
import { LocalDiskDriver } from './local-disk.driver';

// To move uploads to S3-compatible storage later, add a driver implementing
// StorageDriver and select it here (e.g. from STORAGE_DRIVER=s3).
@Global()
@Module({
  providers: [{ provide: STORAGE_DRIVER, useClass: LocalDiskDriver }, StorageService],
  exports: [StorageService],
})
export class StorageModule {}
