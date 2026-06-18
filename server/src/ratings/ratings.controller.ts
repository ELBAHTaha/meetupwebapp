import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RatingsService } from './ratings.service';
import { CreateRatingDto } from './dto/create-rating.dto';
import { Public } from '../common/decorators/public.decorator';
import { ConsumerGuard } from '../common/guards/consumer.guard';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';

// Rating fellow attendees is consumer-only — not available to business accounts.
@ApiTags('ratings')
@ApiBearerAuth()
@UseGuards(ConsumerGuard)
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

/** Public written reviews shown on a user's profile. */
@ApiTags('reviews')
@Controller('users/:id/reviews')
export class ReviewsController {
  constructor(private readonly ratings: RatingsService) {}

  @Public()
  @Get()
  reviews(@Param('id') id: string) {
    return this.ratings.reviewsFor(id);
  }
}
