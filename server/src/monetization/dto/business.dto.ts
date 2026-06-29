import { Type } from 'class-transformer';
import { IsEmail, IsEnum, IsLatitude, IsLongitude, IsOptional, IsString, MaxLength } from 'class-validator';

export class RegisterBusinessDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @MaxLength(240)
  address!: string;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;

  @IsEmail()
  contactEmail!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}

export class SponsorshipCheckoutDto {
  @IsEnum(['starter', 'bronze', 'silver'])
  tier!: 'starter' | 'bronze' | 'silver';

  @IsOptional()
  @IsEnum(['monthly', 'quarterly', 'annual'])
  interval?: 'monthly' | 'quarterly' | 'annual';
}

export class RemovePhotoDto {
  @IsString()
  @MaxLength(500)
  url!: string;
}

export class UpdateBusinessDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;
}
