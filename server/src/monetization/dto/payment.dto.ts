import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateExpressIntentDto {
  @IsEnum(['express', 'priority'])
  priorityLevel!: 'express' | 'priority';
}

export class VerifyExpressPaymentDto {
  @IsString()
  paymentIntentId!: string;

  @IsOptional()
  @IsEnum(['express', 'priority'])
  priorityLevel?: 'express' | 'priority';
}
