import { Module } from '@nestjs/common';
import { ShareController } from './share.controller';

// PrismaService (global) and ConfigService (global) are injected directly, so
// this module only needs to declare the controller.
@Module({ controllers: [ShareController] })
export class ShareModule {}
