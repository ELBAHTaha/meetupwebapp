import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { MonetizationModule } from '../monetization/monetization.module';

@Module({
  imports: [MonetizationModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}
