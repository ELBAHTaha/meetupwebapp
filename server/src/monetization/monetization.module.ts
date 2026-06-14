import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StripeClientService } from './stripe-client.service';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController, StripeWebhookController } from './subscription.controller';
import { ExpressPaymentService } from './express-payment.service';
import { PaymentController } from './payment.controller';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';

@Module({
  imports: [PrismaModule],
  controllers: [SubscriptionController, StripeWebhookController, PaymentController, BusinessController],
  providers: [StripeClientService, SubscriptionService, ExpressPaymentService, BusinessService],
  exports: [SubscriptionService, ExpressPaymentService, BusinessService],
})
export class MonetizationModule {}
