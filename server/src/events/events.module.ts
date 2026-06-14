import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { ActivityTypesModule } from '../activity-types/activity-types.module';
import { MonetizationModule } from '../monetization/monetization.module';

@Module({
  imports: [ActivityTypesModule, MonetizationModule],
  controllers: [EventsController],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
