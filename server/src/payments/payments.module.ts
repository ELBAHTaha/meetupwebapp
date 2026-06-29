import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PaddleService } from './paddle.service';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';

// Paddle (Billing) checkout behind a provider-agnostic service: the server opens
// a transaction against a catalog price id, the frontend completes it in the
// Paddle.js overlay, and signed webhooks fulfil the order. Falls back to a dev
// simulation when no Paddle API key is configured.
@Module({
  imports: [PrismaModule],
  controllers: [PaymentsController],
  providers: [PaddleService, PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
