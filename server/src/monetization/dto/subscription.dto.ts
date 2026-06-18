import { IsEnum } from 'class-validator';

export class CheckoutDto {
  @IsEnum(['bronze', 'silver', 'gold'])
  planType!: 'bronze' | 'silver' | 'gold';
}

export class PremiumCheckoutDto {
  @IsEnum(['attendee'])
  planType!: 'attendee';
}
