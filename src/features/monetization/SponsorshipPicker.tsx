import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import type { BillingInterval } from '@/types';
import { SPONSOR_MONTHLY_MAD, formatMad, termTotalMad } from './pricing';

export type SellableTier = keyof typeof SPONSOR_MONTHLY_MAD;
const TIERS: SellableTier[] = ['starter', 'bronze', 'silver'];
const INTERVALS: BillingInterval[] = ['monthly', 'quarterly', 'annual'];

/** Compact tier + prepaid-term selector with the total due for the term. */
export function SponsorshipPicker({
  tier,
  interval,
  onTier,
  onInterval,
}: {
  tier: SellableTier;
  interval: BillingInterval;
  onTier: (t: SellableTier) => void;
  onInterval: (i: BillingInterval) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {TIERS.map((id) => (
          <button
            key={id}
            onClick={() => onTier(id)}
            className={cn(
              'rounded-input border px-3 py-2.5 text-start transition-colors cursor-pointer',
              tier === id ? 'border-clay bg-clay-soft' : 'border-border bg-bg hover:border-ink/20',
            )}
          >
            <span className="block text-meta font-semibold text-ink">{t(`sponsor.tier.${id}`)}</span>
            <span className="block text-[12px] text-ink-soft">{formatMad(SPONSOR_MONTHLY_MAD[id])}{t('pricing.perMonth')}</span>
            <span className="block text-[11px] text-ink-faint">{t(`sponsor.limit.${id}`)}</span>
          </button>
        ))}
      </div>
      <div className="flex gap-1 rounded-full border border-border bg-surface p-1">
        {INTERVALS.map((id) => (
          <button
            key={id}
            onClick={() => onInterval(id)}
            className={cn(
              'flex-1 rounded-full px-2 py-1.5 text-[12px] font-medium transition-colors cursor-pointer',
              interval === id ? 'bg-ink text-bg' : 'text-ink-soft',
            )}
          >
            {t(`upgrades.interval.${id}`)}
            {id !== 'monthly' && <span className="ms-1 opacity-70">{t(`sponsor.save.${id}`)}</span>}
          </button>
        ))}
      </div>
      <p className="text-meta text-ink">
        {t('sponsor.totalDue', {
          amount: formatMad(termTotalMad(SPONSOR_MONTHLY_MAD[tier], interval)),
          term: t(`upgrades.interval.${interval}`).toLowerCase(),
        })}
      </p>
    </div>
  );
}
