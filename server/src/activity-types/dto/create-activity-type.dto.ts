import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateActivityTypeDto {
  @ApiProperty()
  @IsString()
  @MaxLength(40)
  name!: string;

  @ApiProperty({ description: 'lucide icon key, e.g. "Coffee".' })
  @IsString()
  @MaxLength(40)
  lucideIcon!: string;

  @ApiProperty({ enum: ['sport', 'outdoor', 'social'] })
  @IsEnum(['sport', 'outdoor', 'social'])
  group!: 'sport' | 'outdoor' | 'social';

  @ApiProperty({ enum: ['chill', 'active'] })
  @IsEnum(['chill', 'active'])
  vibe!: 'chill' | 'active';

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  outdoor?: boolean;
}
