import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReferralService } from './referral.service';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('referral')
@Controller('referral')
export class ReferralController {
  constructor(private readonly referral: ReferralService) {}

  /** The current user's invite link, friends-joined count, and reward. */
  @ApiBearerAuth()
  @Get()
  summary(@CurrentUser() user: AuthUser) {
    return this.referral.summary(user.id);
  }
}
