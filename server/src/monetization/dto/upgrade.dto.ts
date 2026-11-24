import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

const PRODUCTS = ['pro_host', 'sponsorship_starter', 'sponsorship_bronze', 'sponsorship_silver', 'pinned_activity'] as const;
const INTERVALS = ['monthly', 'quarterly', 'annual'] as const;

export class CreateUpgradeRequestDto {
  @ApiProperty({ enum: PRODUCTS })
  @IsEnum(PRODUCTS)
  product!: (typeof PRODUCTS)[number];

  @ApiPropertyOptional({ enum: INTERVALS })
  @IsOptional()
  @IsEnum(INTERVALS)
  interval?: (typeof INTERVALS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(191)
  businessId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(191)
  venueId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(191)
  eventId?: string;

  @ApiPropertyOptional({ description: 'Optional message to the admin (e.g. how you paid).' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional({ enum: ['en', 'fr', 'ar'] })
  @IsOptional()
  @IsIn(['en', 'fr', 'ar'])
  locale?: string;
}

export class ApproveUpgradeDto {
  @ApiPropertyOptional({ description: 'Explicit end date (ISO). Overrides months.' })
  @IsOptional()
  @IsDateString()
  until?: string;

  @ApiPropertyOptional({ description: 'Months to grant (defaults to the requested term: 1/3/12).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  months?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}

export class RejectUpgradeDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNote?: string;
}

export class AdminPlanDto {
  @ApiProperty({ enum: ['grant', 'extend', 'revoke'] })
  @IsEnum(['grant', 'extend', 'revoke'])
  action!: 'grant' | 'extend' | 'revoke';

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  until?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  months?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class AdminSponsorshipDto extends AdminPlanDto {
  @ApiPropertyOptional({ enum: ['starter', 'bronze', 'silver'] })
  @IsOptional()
  @IsEnum(['starter', 'bronze', 'silver'])
  tier?: 'starter' | 'bronze' | 'silver';

  @ApiPropertyOptional({ enum: INTERVALS })
  @IsOptional()
  @IsEnum(INTERVALS)
  interval?: (typeof INTERVALS)[number];
}
