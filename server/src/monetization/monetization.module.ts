import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsModule } from '../payments/payments.module';
import { SubscriptionService } from './subscription.service';
import { SubscriptionController } from './subscription.controller';
import { ExpressPaymentService } from './express-payment.service';
import { PaymentController } from './payment.controller';
import { BusinessService } from './business.service';
import { BusinessController } from './business.controller';

@Module({
  imports: [PrismaModule, PaymentsModule],
  controllers: [SubscriptionController, PaymentController, BusinessController],
  providers: [SubscriptionService, ExpressPaymentService, BusinessService],
  exports: [SubscriptionService, ExpressPaymentService, BusinessService],
})
export class MonetizationModule {}
