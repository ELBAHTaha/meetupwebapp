import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateReportDto {
  @ApiProperty({ enum: ['user', 'activity'], description: 'Frontend naming: "activity" = event.' })
  @IsEnum(['user', 'activity'])
  targetType!: 'user' | 'activity';

  @ApiProperty()
  @IsString()
  targetId!: string;

  @ApiPropertyOptional({ enum: ['fake_activity', 'inappropriate', 'no_show_host', 'suspicious_user', 'other'] })
  @IsOptional()
  @IsEnum(['fake_activity', 'inappropriate', 'no_show_host', 'suspicious_user', 'other'])
  category?: 'fake_activity' | 'inappropriate' | 'no_show_host' | 'suspicious_user' | 'other';

  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chatThreadId?: string;
}
