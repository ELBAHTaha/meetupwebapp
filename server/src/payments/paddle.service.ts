import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment, EventEntity, Paddle } from '@paddle/paddle-node-sdk';

/**
 * Thin wrapper around the Paddle (Billing) Node SDK.
 *
 * Paddle is a merchant-of-record, hosted checkout: we never touch card data.
 * The server opens a transaction against a catalog price id, the frontend
 * completes it in the Paddle.js overlay, and Paddle posts signed webhooks which
 * we verify here before fulfilling the order.
 *
 * `configured` is false until a real (non-placeholder) API key is set, in which
 * case the payment services fall back to a dev simulation.
 */
@Injectable()
export class PaddleService {
  private readonly logger = new Logger(PaddleService.name);
  readonly paddle: Paddle;

  constructor(private readonly config: ConfigService) {
    const key = config.get<string>('paddle.apiKey');
    const environment =
      config.get<string>('paddle.environment') === 'production' ? Environment.production : Environment.sandbox;
    this.paddle = new Paddle(key || 'pdl_placeholder', { environment });
  }

  /** True only when a real (non-placeholder) API key is configured. */
  get configured(): boolean {
    return !!this.config.get<boolean>('paddle.enabled');
  }

  /** Find-or-create a Paddle customer for an email (idempotent on Paddle's side). */
  async ensureCustomer(email: string, name?: string): Promise<string> {
    // Paddle rejects creating a second customer with the same email, so reuse one.
    const existing = this.paddle.customers.list({ email: [email] });
    const page = await existing.next();
    if (page.length > 0) return page[0].id;
    const customer = await this.paddle.customers.create({ email, name: name || undefined });
    return customer.id;
  }

  /** Open a transaction for a single catalog price; returns the transaction id. */
  async createTransaction(priceId: string, customerId: string, customData: Record<string, unknown>): Promise<string> {
    const txn = await this.paddle.transactions.create({
      items: [{ priceId, quantity: 1 }],
      customerId,
      customData,
    });
    return txn.id;
  }

  /** Cancel every active subscription for a customer at the end of the period. */
  async cancelActiveSubscriptions(customerId: string): Promise<number> {
    const collection = this.paddle.subscriptions.list({ customerId: [customerId], status: ['active'] });
    const subs = await collection.next();
    await Promise.all(subs.map((sub) => this.paddle.subscriptions.cancel(sub.id, { effectiveFrom: 'next_billing_period' })));
    return subs.length;
  }

  /** Verify a webhook signature and return the parsed event (or null if invalid). */
  async unmarshalWebhook(rawBody: string, signature: string): Promise<EventEntity | null> {
    const secret = this.config.get<string>('paddle.webhookSecret');
    if (!secret) {
      this.logger.warn('PADDLE_WEBHOOK_SECRET is not set — rejecting webhook.');
      return null;
    }
    try {
      return await this.paddle.webhooks.unmarshal(rawBody, secret, signature);
    } catch (err) {
      this.logger.warn(`Paddle webhook signature verification failed: ${(err as Error).message}`);
      return null;
    }
  }
}
