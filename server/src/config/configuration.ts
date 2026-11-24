export interface AppConfig {
  nodeEnv: string;
  port: number;
  frontendUrl: string;
  /** Canonical frontend base URL used in email links (single origin). */
  appUrl: string;
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
  turnstile: {
    secretKey?: string;
  };
  mail: {
    apiKey?: string;
    from: string;
  };
  // Manual (offline) payments: the instructions shown with every upgrade
  // request. Supports {amount} and {reference} placeholders and literal "\n".
  payments: {
    instructions: { en?: string; fr?: string; ar?: string };
  };
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  // FRONTEND_URL may be a comma-separated CORS allow-list, so links in emails use
  // APP_URL (falls back to the first FRONTEND_URL origin).
  appUrl: (
    process.env.APP_URL ||
    (process.env.FRONTEND_URL ?? 'http://localhost:5173').split(',')[0].trim()
  ).replace(/\/$/, ''),
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
  turnstile: {
    secretKey: process.env.TURNSTILE_SECRET_KEY || undefined,
  },
  mail: {
    apiKey: process.env.RESEND_API_KEY || undefined,
    from: process.env.MAIL_FROM ?? 'hudlgo <onboarding@resend.dev>',
  },
  payments: {
    instructions: {
      en: process.env.PAYMENT_INSTRUCTIONS_EN || undefined,
      fr: process.env.PAYMENT_INSTRUCTIONS_FR || undefined,
      ar: process.env.PAYMENT_INSTRUCTIONS_AR || undefined,
    },
  },
});
