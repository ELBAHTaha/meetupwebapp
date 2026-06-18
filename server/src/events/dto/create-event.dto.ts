import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateEventDto {
  @ApiProperty({ description: 'ActivityType slug or id.' })
  @IsString()
  activityId!: string;

  @ApiProperty({ maxLength: 60 })
  @IsString()
  @MaxLength(60)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(160)
  locationLabel!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(240)
  address!: string;

  @ApiPropertyOptional({ description: 'General area shown before joining (e.g. "Maârif").' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  areaLabel?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsLatitude()
  lat!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsLongitude()
  lng!: number;

  @ApiProperty({ description: 'Must be true — public places only.' })
  @IsBoolean()
  isPublicPlace!: boolean;

  @ApiPropertyOptional({ description: 'Online (virtual) activity — no physical venue.' })
  @IsOptional()
  @IsBoolean()
  isOnline?: boolean;

  @ApiPropertyOptional({ description: 'Meeting link for online activities (revealed after joining).' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  meetingUrl?: string;

  @ApiProperty()
  @IsDateString()
  startsAt!: string;

  @ApiProperty()
  @IsDateString()
  endsAt!: string;

  @ApiProperty({ minimum: 4, maximum: 12 })
  @Type(() => Number)
  @IsNumber()
  @Min(4)
  @Max(12)
  maxAttendees!: number;

  @ApiPropertyOptional({ default: 4, minimum: 4 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(4)
  minPlayers?: number;

  @ApiPropertyOptional({ enum: ['any', 'beginner', 'intermediate', 'advanced'] })
  @IsOptional()
  @IsEnum(['any', 'beginner', 'intermediate', 'advanced'])
  skillLevel?: string;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  travelersWelcome?: boolean;

  @ApiPropertyOptional({ enum: ['any', 'women', 'men'], default: 'any' })
  @IsOptional()
  @IsEnum(['any', 'women', 'men'])
  genderPreference?: 'any' | 'women' | 'men';

  @ApiPropertyOptional({ enum: ['public', 'invite'], default: 'public' })
  @IsOptional()
  @IsEnum(['public', 'invite'])
  visibility?: 'public' | 'invite';

  @ApiPropertyOptional({ enum: ['standard', 'express', 'priority'], default: 'standard' })
  @IsOptional()
  @IsEnum(['standard', 'express', 'priority'])
  priorityLevel?: 'standard' | 'express' | 'priority';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expressPaymentIntentId?: string;

  @ApiPropertyOptional({ description: 'Approved sponsored business venue id.' })
  @IsOptional()
  @IsString()
  businessId?: string;
}
