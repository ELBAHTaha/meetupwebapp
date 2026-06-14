import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { MonetizationModule } from '../monetization/monetization.module';

@Module({
  imports: [MonetizationModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
