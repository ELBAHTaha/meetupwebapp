// Provider-agnostic checkout contract. Paddle (Billing) is the implementation:
// the server opens a transaction against a catalog price id, the frontend
// completes it in Paddle.js overlay, and signed webhooks fulfil the order.

/** Single paid host plan. */
export type HostTier = 'pro';
/** Sellable business venue sponsorship tiers, cheapest first. (GOLD is a dormant
 * legacy tier — still in the Prisma enum for existing rows, but no longer sold.) */
export type BizTier = 'starter' | 'bronze' | 'silver';
/** Billing term: monthly recurring, or a prepaid quarter/year. */
export type BillingInterval = 'monthly' | 'quarterly' | 'annual';
/** One-off paid extra-activity level (pinned). `express` is legacy. */
export type ExtraLevel = 'express' | 'priority';

export type CheckoutPurpose =
  | { kind: 'host_subscription'; tier: HostTier }
  | { kind: 'business_sponsorship'; tier: BizTier; businessId: string; interval: BillingInterval }
  | { kind: 'extra_event'; level: ExtraLevel };

export interface CheckoutOrder {
  oid: string; // our unique order id (passed to Paddle as custom_data.oid)
  userId?: string; // payer, when known
  email: string;
  amountCents: number; // MAD, in cents (e.g. 49000 = 490.00 MAD) — display only
  purpose: CheckoutPurpose;
  transactionId?: string; // Paddle transaction id (absent in dev simulation)
}

/**
 * Returned when a checkout is started. Either a Paddle transaction the frontend
 * opens in the overlay (`transactionId`), or — when Paddle isn't configured — an
 * already-applied dev simulation (`simulated`). `ref` is our order id (equal to
 * the Paddle transaction id when live) used later to verify one-off purchases.
 */
export interface CheckoutSession {
  ref: string;
  amountCents: number; // for display only — Paddle charges the catalog price
  transactionId?: string; // present when a live Paddle overlay should open
  simulated?: boolean; // dev: already applied, no overlay needed
}

// --- Prepaid-term pricing -------------------------------------------------

/** Term length in months per interval. */
export const INTERVAL_MONTHS: Record<BillingInterval, number> = { monthly: 1, quarterly: 3, annual: 12 };
/** Discount off the monthly rate for prepaying a longer term. */
const INTERVAL_DISCOUNT: Record<BillingInterval, number> = { monthly: 0, quarterly: 0.1, annual: 0.15 };

/** Total charge (in cents) for a prepaid term, rounded to the nearest cent. */
export function billingTotalCents(monthlyCents: number, interval: BillingInterval): number {
  return Math.round(monthlyCents * INTERVAL_MONTHS[interval] * (1 - INTERVAL_DISCOUNT[interval]));
}

/** End date of a prepaid term measured from a start date. */
export function intervalEndDate(start: Date, interval: BillingInterval): Date {
  const d = new Date(start);
  d.setMonth(d.getMonth() + INTERVAL_MONTHS[interval]);
  return d;
}
