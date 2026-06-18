export interface AppConfig {
  nodeEnv: string;
  port: number;
  frontendUrl: string;
  publicUrl: string;
  uploadsDir: string;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
  };
  google: {
    clientId?: string;
    clientSecret?: string;
    callbackUrl: string;
    enabled: boolean;
  };
  throttle: {
    ttl: number;
    limit: number;
  };
  paddle: {
    apiKey?: string;
    webhookSecret?: string;
    environment: string;
    currency: string;
    // Host membership tiers (Bronze/Silver/Gold).
    hostBronzePriceId?: string;
    hostSilverPriceId?: string;
    hostGoldPriceId?: string;
    // Business venue sponsorship tiers (separate from host tiers).
    bronzePriceId?: string;
    silverPriceId?: string;
    goldPriceId?: string;
    expressPriceId?: string;
    priorityPriceId?: string;
  };
  turnstile: {
    secretKey?: string;
  };
  mail: {
    apiKey?: string;
    from: string;
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  publicUrl: process.env.PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? '4000'}`,
  uploadsDir: process.env.UPLOADS_DIR ?? 'uploads',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? 'dev-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET ?? 'dev-refresh-secret',
    accessTtl: process.env.JWT_ACCESS_TTL ?? '900s',
    refreshTtl: process.env.JWT_REFRESH_TTL ?? '30d',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || undefined,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || undefined,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL ?? 'http://localhost:4000/auth/google/callback',
    enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  },
  throttle: {
    ttl: parseInt(process.env.THROTTLE_TTL ?? '60000', 10),
    limit: parseInt(process.env.THROTTLE_LIMIT ?? '120', 10),
  },
  paddle: {
    apiKey: process.env.PADDLE_API_KEY || undefined,
    webhookSecret: process.env.PADDLE_WEBHOOK_SECRET || undefined,
    environment: process.env.PADDLE_ENVIRONMENT ?? 'sandbox',
    currency: process.env.PADDLE_CURRENCY ?? 'usd',
    hostBronzePriceId: process.env.PADDLE_HOST_BRONZE_PRICE_ID || undefined,
    hostSilverPriceId: process.env.PADDLE_HOST_SILVER_PRICE_ID || undefined,
    hostGoldPriceId: process.env.PADDLE_HOST_GOLD_PRICE_ID || undefined,
    bronzePriceId: process.env.PADDLE_BRONZE_PRICE_ID || undefined,
    silverPriceId: process.env.PADDLE_SILVER_PRICE_ID || undefined,
    goldPriceId: process.env.PADDLE_GOLD_PRICE_ID || undefined,
    expressPriceId: process.env.PADDLE_EXPRESS_PRICE_ID || undefined,
    priorityPriceId: process.env.PADDLE_PRIORITY_PRICE_ID || undefined,
  },
  turnstile: {
    secretKey: process.env.TURNSTILE_SECRET_KEY || undefined,
  },
  mail: {
    apiKey: process.env.RESEND_API_KEY || undefined,
    from: process.env.MAIL_FROM ?? 'hudlgo <onboarding@resend.dev>',
  },
});
