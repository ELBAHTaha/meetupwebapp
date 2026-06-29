import { IsEnum } from 'class-validator';

export class CheckoutDto {
  @IsEnum(['pro'])
  planType!: 'pro';
}
