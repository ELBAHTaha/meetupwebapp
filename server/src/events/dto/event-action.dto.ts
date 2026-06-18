import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class StartEventDto {
  @ApiPropertyOptional({ description: 'How attendees can spot you.' })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  hostSpotNote?: string;
}

export class JoinEventDto {
  // §7: opt-in to share the attendee's contact with the hosting business.
  @ApiPropertyOptional({ description: 'Share my contact with the hosting business.' })
  @IsOptional()
  @IsBoolean()
  shareContactWithHostBusiness?: boolean;
}
