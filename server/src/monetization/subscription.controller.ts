import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { SubscriptionService } from './subscription.service';

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptions: SubscriptionService) {}

  /** Current plan + remaining hosting/pin allowance. (Upgrades: see /upgrades.) */
  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.subscriptions.remainingFreeActivities(user.id);
  }
}
