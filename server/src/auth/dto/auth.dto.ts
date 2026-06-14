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
