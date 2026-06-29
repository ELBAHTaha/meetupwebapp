import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { PaymentsService } from './payments.service';

@ApiExcludeController()
@Controller('payments/paddle')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  /**
   * Paddle server-to-server webhook. The signature is verified against the raw
   * request body (enabled via `rawBody: true` in main.ts), then the event is
   * dispatched to fulfil the matching order. Always acks 200 so Paddle doesn't
   * retry on our own processing errors.
   */
  @Public()
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('paddle-signature') signature: string) {
    const raw = req.rawBody?.toString('utf8') ?? '';
    let applied = false;
    try {
      applied = await this.payments.handleWebhook(raw, signature ?? '');
    } catch {
      applied = false;
    }
    return { received: true, applied };
  }
}
