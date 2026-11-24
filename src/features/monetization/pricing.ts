import type { BillingInterval, SponsorshipTier, UpgradeProduct } from '@/types';

// Display prices (MAD). The backend is the source of truth for the amount due on
// each request; these mirror server/src/monetization/pricing.ts for the UI.
export const PRO_HOST_MONTHLY_MAD = 49;
export const PINNED_ACTIVITY_MAD = 19.9;
export const SPONSOR_MONTHLY_MAD: Record<Exclude<SponsorshipTier, 'gold'>, number> = { starter: 199, bronze: 490, silver: 990 };
export const INTERVAL_MONTHS: Record<BillingInterval, number> = { monthly: 1, quarterly: 3, annual: 12 };
export const INTERVAL_DISCOUNT: Record<BillingInterval, number> = { monthly: 0, quarterly: 0.1, annual: 0.15 };

export const termTotalMad = (monthlyMad: number, interval: BillingInterval): number =>
  Math.round(monthlyMad * INTERVAL_MONTHS[interval] * (1 - INTERVAL_DISCOUNT[interval]));

/** "49 MAD", "19.90 MAD", "2 673 MAD". */
export function formatMad(amount: number, fromCents = false): string {
  const v = fromCents ? amount / 100 : amount;
  const hasCents = Math.round(v * 100) % 100 !== 0;
  return `${v.toLocaleString('fr-MA', { minimumFractionDigits: hasCents ? 2 : 0, maximumFractionDigits: 2 })} MAD`;
}

export const SPONSOR_PRODUCT: Record<Exclude<SponsorshipTier, 'gold'>, UpgradeProduct> = {
  starter: 'sponsorship_starter',
  bronze: 'sponsorship_bronze',
  silver: 'sponsorship_silver',
};
