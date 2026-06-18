import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { SubscriptionService } from './subscription.service';
import { PaddleClientService } from './paddle-client.service';
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

@ApiTags('paddle')
@Controller('paddle')
export class PaddleWebhookController {
  constructor(
    private readonly subscriptions: SubscriptionService,
    private readonly paddleClient: PaddleClientService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('webhook')
  async webhook(@Req() req: Request & { rawBody?: Buffer }) {
    const signature = req.headers['paddle-signature'];
    const secret = this.config.get<string>('paddle.webhookSecret');
    if (!signature || typeof signature !== 'string' || !secret || secret.includes('xxx')) return { received: false };
    const rawBody = (req.rawBody ?? Buffer.from(JSON.stringify(req.body))).toString('utf8');
    const event = await this.paddleClient.paddle.webhooks.unmarshal(rawBody, secret, signature);
    if (event) await this.subscriptions.handleWebhook(event);
    return { received: true };
  }
}
