import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeClientService {
  readonly stripe: Stripe;

  constructor(config: ConfigService) {
    const key = config.get<string>('stripe.secretKey');
    this.stripe = new Stripe(key || 'sk_test_missing', {
      apiVersion: '2024-12-18.acacia' as Stripe.LatestApiVersion,
    });
  }
}
