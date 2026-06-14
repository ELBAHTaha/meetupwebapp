import { IsEnum } from 'class-validator';

export class CheckoutDto {
  @IsEnum(['pro', 'premium'])
  planType!: 'pro' | 'premium';
}

export class PremiumCheckoutDto {
  @IsEnum(['attendee'])
  planType!: 'attendee';
}
