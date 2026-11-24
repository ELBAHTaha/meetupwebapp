import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class ConditionsQueryDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng!: number;

  @ApiProperty({ description: 'ISO time of the activity.' })
  @IsDateString()
  at!: string;

  @ApiPropertyOptional({ description: 'Activity slug (e.g. "surfing") — water sports add sea conditions.' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  activity?: string;
}
