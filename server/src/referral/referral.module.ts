import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';

// PrismaService + ConfigService are global; NotificationsModule is imported for
// the reward notifications. ReferralService is exported so AuthModule can credit
// referrals during signup.
@Module({
  imports: [NotificationsModule],
  controllers: [ReferralController],
  providers: [ReferralService],
  exports: [ReferralService],
})
export class ReferralModule {}
