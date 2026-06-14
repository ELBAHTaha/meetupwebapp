import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class StartEventDto {
  @ApiPropertyOptional({ description: 'How attendees can spot you.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  hostSpotNote?: string;
}
