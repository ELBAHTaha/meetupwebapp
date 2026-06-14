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
  stripe: {
    secretKey?: string;
    webhookSecret?: string;
    currency: string;
    proPriceId?: string;
    premiumPriceId?: string;
    attendeePremiumPriceId?: string;
    bronzePriceId?: string;
    silverPriceId?: string;
    goldPriceId?: string;
  };
  turnstile: {
    secretKey?: string;
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
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY || undefined,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || undefined,
    currency: process.env.STRIPE_CURRENCY ?? 'usd',
    proPriceId: process.env.STRIPE_PRO_PRICE_ID || undefined,
    premiumPriceId: process.env.STRIPE_PREMIUM_PRICE_ID || undefined,
    attendeePremiumPriceId: process.env.STRIPE_ATTENDEE_PREMIUM_PRICE_ID || undefined,
    bronzePriceId: process.env.STRIPE_BRONZE_PRICE_ID || undefined,
    silverPriceId: process.env.STRIPE_SILVER_PRICE_ID || undefined,
    goldPriceId: process.env.STRIPE_GOLD_PRICE_ID || undefined,
  },
  turnstile: {
    secretKey: process.env.TURNSTILE_SECRET_KEY || undefined,
  },
});
