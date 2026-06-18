import { Module } from '@nestjs/common';
import { FeedbackService } from './feedback.service';
import { AdminFeedbackController, FeedbackController } from './feedback.controller';

@Module({
  controllers: [FeedbackController, AdminFeedbackController],
  providers: [FeedbackService],
})
export class FeedbackModule {}
