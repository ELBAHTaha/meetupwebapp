import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SignupDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiProperty({ description: 'ISO date (YYYY-MM-DD). Must be 18+.' })
  @IsDateString()
  birthday!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  neighborhood!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(12)
  zip!: string;

  @ApiPropertyOptional({ enum: ['MALE', 'FEMALE', 'OTHER'] })
  @IsOptional()
  @IsEnum(['MALE', 'FEMALE', 'OTHER'])
  gender?: 'MALE' | 'FEMALE' | 'OTHER';

  @ApiPropertyOptional({ description: 'Optional and never verified — no SMS.' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ enum: ['partners', 'friends', 'both'] })
  @IsOptional()
  @IsEnum(['partners', 'friends', 'both'])
  lookingFor?: 'partners' | 'friends' | 'both';

  @ApiPropertyOptional({ description: 'Cloudflare Turnstile token (verified when configured).' })
  @IsOptional()
  @IsString()
  turnstileToken?: string;

  @ApiPropertyOptional({ description: 'Referral code from an invite link (?ref=...).' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  referralCode?: string;
}

/**
 * Sign up a venue/business account. Distinct from consumer SignupDto — no
 * birthday/18+ gate, no dating fields. Creates a user with role BUSINESS.
 */
export class BusinessSignupDto {
  @ApiProperty()
  @IsString()
  @MaxLength(80)
  name!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiPropertyOptional({ description: 'Optional contact phone — never verified.' })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({ description: 'Cloudflare Turnstile token (verified when configured).' })
  @IsOptional()
  @IsString()
  turnstileToken?: string;
}

export class LoginDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  password!: string;
}

export class RefreshDto {
  @ApiProperty()
  @IsString()
  refreshToken!: string;
}
