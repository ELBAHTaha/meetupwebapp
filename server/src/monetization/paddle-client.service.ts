import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment, Paddle } from '@paddle/paddle-node-sdk';

@Injectable()
export class PaddleClientService {
  readonly paddle: Paddle;
  /** True only when a real (non-placeholder) API key is configured. */
  readonly configured: boolean;

  constructor(config: ConfigService) {
    const key = config.get<string>('paddle.apiKey');
    this.configured = !!key && !key.includes('xxx');
    const environment =
      config.get<string>('paddle.environment') === 'production' ? Environment.production : Environment.sandbox;
    this.paddle = new Paddle(key || 'apikey_placeholder', { environment });
  }
}
