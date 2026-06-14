import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { SubscriptionService } from './subscription.service';
import { StripeClientService } from './stripe-client.service';
import { CheckoutDto, PremiumCheckoutDto } from './dto/subscription.dto';

@ApiTags('subscriptions')
@ApiBearerAuth()
@Controller('subscriptions')
export class SubscriptionController {
  constructor(private readonly subscriptions: SubscriptionService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.subscriptions.remainingFreeActivities(user.id);
  }

  @Post('checkout')
  checkout(@CurrentUser() user: AuthUser, @Body() dto: CheckoutDto) {
    return this.subscriptions.createCheckoutSession(user.id, dto.planType);
  }

  @Post('premium-checkout')
  premiumCheckout(@CurrentUser() user: AuthUser, @Body() _dto: PremiumCheckoutDto) {
    return this.subscriptions.createAttendeePremiumCheckout(user.id);
  }

  @Post('cancel')
  cancel(@CurrentUser() user: AuthUser) {
    return this.subscriptions.cancel(user.id);
  }
}

@ApiTags('stripe')
@Controller('stripe')
export class StripeWebhookController {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly stripeClient: StripeClientService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('webhook')
  async webhook(@Req() req: Request & { rawBody?: Buffer }) {
    const signature = req.headers['stripe-signature'];
    const secret = this.config.get<string>('stripe.webhookSecret');
    if (!signature || !secret) return { received: false };
    const event = this.stripeClient.stripe.webhooks.constructEvent(req.rawBody ?? Buffer.from(JSON.stringify(req.body)), signature, secret);
    await this.subscriptions.handleWebhook(event);
    return { received: true };
  }
}
