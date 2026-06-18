import { Module } from '@nestjs/common';
import { RatingsController, ReviewsController } from './ratings.controller';
import { RatingsService } from './ratings.service';

@Module({
  controllers: [RatingsController, ReviewsController],
  providers: [RatingsService],
  exports: [RatingsService],
})
export class RatingsModule {}
