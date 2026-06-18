import { Module } from '@nestjs/common';
import { BusinessAccessService } from './business-access.service';
import { BusinessOrgService } from './business-org.service';
import { BusinessOrgController } from './business-org.controller';
import { VenueService } from './venue.service';
import { VenueController } from './venue.controller';

// Business-side foundation: org + members/roles + verification, and first-class
// venues + claim/review. PrismaService, StorageService and NotificationsService
// come from their @Global modules. NOTE: this module must be imported AFTER
// MonetizationModule in AppModule so monetization's static `/businesses/mine`,
// `/businesses/sponsored-venues` and `/businesses/register` routes register
// before this module's `GET /businesses/:id`.
@Module({
  controllers: [BusinessOrgController, VenueController],
  providers: [BusinessAccessService, BusinessOrgService, VenueService],
  exports: [BusinessAccessService],
})
export class BusinessModule {}
