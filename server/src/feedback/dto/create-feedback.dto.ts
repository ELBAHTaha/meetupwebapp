import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export const FEEDBACK_CATEGORIES = ['idea', 'bug', 'praise', 'other'] as const;
export type FeedbackCategorySlug = (typeof FEEDBACK_CATEGORIES)[number];

export class CreateFeedbackDto {
  @ApiProperty({ enum: FEEDBACK_CATEGORIES })
  @IsEnum(FEEDBACK_CATEGORIES)
  category!: FeedbackCategorySlug;

  @ApiProperty()
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  message!: string;

  @ApiPropertyOptional({ description: 'App route the feedback was sent from.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  path?: string;
}
