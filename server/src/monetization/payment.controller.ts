import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { CreateExpressIntentDto, VerifyExpressPaymentDto } from './dto/payment.dto';
import { ExpressPaymentService } from './express-payment.service';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentController {
  constructor(private readonly expressPayments: ExpressPaymentService) {}

  @Post('express-intent')
  createExpressIntent(@CurrentUser() user: AuthUser, @Body() dto: CreateExpressIntentDto) {
    return this.expressPayments.createPaymentIntent(user.id, dto.priorityLevel);
  }

  @Post('verify-express')
  verifyExpress(@CurrentUser() user: AuthUser, @Body() dto: VerifyExpressPaymentDto) {
    return this.expressPayments.verifyPaymentIntent(dto.paymentIntentId, user.id, dto.priorityLevel);
  }
}
