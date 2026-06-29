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
  // Paddle (Billing) — merchant-of-record checkout. The server creates a
  // transaction with a catalog price id; the frontend opens Paddle.js overlay;
  // Paddle posts signed webhooks back to fulfil the order.
  paddle: {
    apiKey?: string; // server-side API key (pdl_…) — never exposed to the browser
    environment: 'sandbox' | 'production';
    webhookSecret?: string; // signing secret used to verify webhook payloads
    // Catalog price ids (created in the Paddle dashboard).
    prices: {
      hostPro?: string; // recurring Pro Host (49 MAD/mo)
      extraPriority?: string; // one-time pinned extra activity (19.90 MAD)
      // Recurring business sponsorships, one price id per (tier × billing term).
      biz: Record<'starter' | 'bronze' | 'silver', Record<'monthly' | 'quarterly' | 'annual', string | undefined>>;
    };
    enabled: boolean; // true only when a real (non-placeholder) API key is set
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
    environment: process.env.PADDLE_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
    webhookSecret: process.env.PADDLE_WEBHOOK_SECRET || undefined,
    prices: {
      hostPro: process.env.PADDLE_HOST_PRO_PRICE_ID || undefined,
      extraPriority: process.env.PADDLE_EXTRA_PRIORITY_PRICE_ID || undefined,
      biz: {
        starter: {
          monthly: process.env.PADDLE_BIZ_STARTER_MONTHLY_PRICE_ID || undefined,
          quarterly: process.env.PADDLE_BIZ_STARTER_QUARTERLY_PRICE_ID || undefined,
          annual: process.env.PADDLE_BIZ_STARTER_ANNUAL_PRICE_ID || undefined,
        },
        bronze: {
          monthly: process.env.PADDLE_BIZ_BRONZE_MONTHLY_PRICE_ID || undefined,
          quarterly: process.env.PADDLE_BIZ_BRONZE_QUARTERLY_PRICE_ID || undefined,
          annual: process.env.PADDLE_BIZ_BRONZE_ANNUAL_PRICE_ID || undefined,
        },
        silver: {
          monthly: process.env.PADDLE_BIZ_SILVER_MONTHLY_PRICE_ID || undefined,
          quarterly: process.env.PADDLE_BIZ_SILVER_QUARTERLY_PRICE_ID || undefined,
          annual: process.env.PADDLE_BIZ_SILVER_ANNUAL_PRICE_ID || undefined,
        },
      },
    },
    // A real key is required for live checkout; placeholders ("xxx") fall back to
    // dev simulation so the flow stays testable without Paddle credentials.
    enabled: Boolean(process.env.PADDLE_API_KEY && !process.env.PADDLE_API_KEY.includes('xxx')),
  },
  turnstile: {
    secretKey: process.env.TURNSTILE_SECRET_KEY || undefined,
  },
  mail: {
    apiKey: process.env.RESEND_API_KEY || undefined,
    from: process.env.MAIL_FROM ?? 'hudlgo <onboarding@resend.dev>',
  },
});
