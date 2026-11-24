import { BillingInterval as PrismaBillingInterval, SponsorshipTier, UpgradeProduct } from '@prisma/client';

// Prices are in MAD, stored in cents (×100). Customers pay offline (bank
// transfer / CashPlus / cash); an admin then activates the plan by hand.

/** Sellable business venue sponsorship tiers, cheapest first. (GOLD is a dormant
 * legacy tier — still in the Prisma enum for existing rows, but no longer sold.) */
export type BizTier = 'starter' | 'bronze' | 'silver';
/** Billing term: one month, or a prepaid quarter/year. */
export type BillingInterval = 'monthly' | 'quarterly' | 'annual';

export const PRO_HOST_MONTHLY_CENTS = 4900;
export const PINNED_ACTIVITY_CENTS = 1990;
export const SPONSOR_MONTHLY_CENTS: Record<SponsorshipTier, number> = {
  STARTER: 19900,
  BRONZE: 49000,
  SILVER: 99000,
  GOLD: 199000, // legacy
};

/** Term length in months per interval. */
export const INTERVAL_MONTHS: Record<BillingInterval, number> = { monthly: 1, quarterly: 3, annual: 12 };
/** Discount off the monthly rate for prepaying a longer term. */
const INTERVAL_DISCOUNT: Record<BillingInterval, number> = { monthly: 0, quarterly: 0.1, annual: 0.15 };

/** Total (in cents) for a prepaid term, rounded to the nearest cent. */
export function billingTotalCents(monthlyCents: number, interval: BillingInterval): number {
  return Math.round(monthlyCents * INTERVAL_MONTHS[interval] * (1 - INTERVAL_DISCOUNT[interval]));
}

/** `start` + n calendar months. */
export function addMonths(start: Date, months: number): Date {
  const d = new Date(start);
  d.setMonth(d.getMonth() + months);
  return d;
}

export const SPONSOR_PRODUCT_TIER: Partial<Record<UpgradeProduct, SponsorshipTier>> = {
  SPONSORSHIP_STARTER: 'STARTER',
  SPONSORSHIP_BRONZE: 'BRONZE',
  SPONSORSHIP_SILVER: 'SILVER',
};

export const toPrismaInterval = (i: BillingInterval): PrismaBillingInterval => i.toUpperCase() as PrismaBillingInterval;
export const fromPrismaInterval = (i: PrismaBillingInterval | null | undefined): BillingInterval =>
  (i ?? 'MONTHLY').toLowerCase() as BillingInterval;

/** Amount due for a request (cents). */
export function requestAmountCents(product: UpgradeProduct, interval: BillingInterval): number {
  if (product === 'PRO_HOST') return billingTotalCents(PRO_HOST_MONTHLY_CENTS, interval);
  if (product === 'PINNED_ACTIVITY') return PINNED_ACTIVITY_CENTS;
  const tier = SPONSOR_PRODUCT_TIER[product];
  return tier ? billingTotalCents(SPONSOR_MONTHLY_CENTS[tier], interval) : 0;
}
