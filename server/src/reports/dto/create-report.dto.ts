import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateReportDto {
  @ApiProperty({ enum: ['user', 'activity'], description: 'Frontend naming: "activity" = event.' })
  @IsEnum(['user', 'activity'])
  targetType!: 'user' | 'activity';

  @ApiProperty()
  @IsString()
  targetId!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(1000)
  reason!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  chatThreadId?: string;
}
