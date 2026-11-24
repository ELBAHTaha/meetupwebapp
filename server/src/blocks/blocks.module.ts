import { Global, Module } from '@nestjs/common';
import { BlocksService } from './blocks.service';

@Global()
@Module({
  providers: [BlocksService],
  exports: [BlocksService],
})
export class BlocksModule {}
