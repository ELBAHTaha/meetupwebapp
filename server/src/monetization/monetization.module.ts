import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';
import { PlanGrantsService } from './plan-grants.service';
import { UpgradesService } from './upgrades.service';
import { AdminUpgradesController, UpgradesController } from './upgrades.controller';

// Plans, quotas and feature gating (Free vs Pro Host, venue sponsorships, pins)
// plus the manual upgrade flow: customers pay offline and an admin activates
// the plan (UpgradesService → PlanGrantsService). No payment gateway.
@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionController, BusinessController, UpgradesController, AdminUpgradesController],
  providers: [SubscriptionService, BusinessService, PlanGrantsService, UpgradesService],
  exports: [SubscriptionService, BusinessService, PlanGrantsService, UpgradesService],
})
export class MonetizationModule {}
