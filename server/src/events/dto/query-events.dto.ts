import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBooleanString, IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class QueryEventsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ['today', 'tomorrow', 'weekend', 'all'] })
  @IsOptional()
  @IsEnum(['today', 'tomorrow', 'weekend', 'all'])
  when?: 'today' | 'tomorrow' | 'weekend' | 'all';

  @ApiPropertyOptional({ description: 'ActivityType slug or id.' })
  @IsOptional()
  @IsString()
  typeId?: string;

  @ApiPropertyOptional({ enum: ['sport', 'outdoor', 'social'] })
  @IsOptional()
  @IsEnum(['sport', 'outdoor', 'social'])
  category?: 'sport' | 'outdoor' | 'social';

  @ApiPropertyOptional({ enum: ['chill', 'active'] })
  @IsOptional()
  @IsEnum(['chill', 'active'])
  vibe?: 'chill' | 'active';

  @ApiPropertyOptional({ enum: ['any', 'beginner', 'intermediate', 'advanced'] })
  @IsOptional()
  @IsString()
  skillLevel?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  openOnly?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBooleanString()
  travelersWelcome?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'City name to scope/centre the feed.' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ enum: ['soonest', 'distance'], default: 'soonest' })
  @IsOptional()
  @IsEnum(['soonest', 'distance'])
  sort?: 'soonest' | 'distance';

  @ApiPropertyOptional({ description: 'ZIP used to centre the distance sort.' })
  @IsOptional()
  @IsString()
  zip?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => (value === '' ? undefined : value))
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => (value === '' ? undefined : value))
  lng?: number;
}
