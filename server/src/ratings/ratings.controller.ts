import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('ratings')
@ApiBearerAuth()
@Controller('events/:id/ratings')
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @Post()
  submit(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() dto: CreateRatingDto) {
    return this.ratings.submit(id, user.id, dto);
  }

  @Get('pending')
  pending(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.ratings.pending(id, user.id);
  }
}
