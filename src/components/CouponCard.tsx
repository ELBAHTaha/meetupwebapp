import { useTranslation } from 'react-i18next';
import { CheckCircle2, Ticket } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { EventCoupon } from '@/types';

/**
 * The attendee's personal coupon for a Silver-sponsored venue, shown large and
 * high-contrast so staff can read it off the phone and type it in.
 */
export function CouponCard({ coupon }: { coupon: EventCoupon }) {
  const { t } = useTranslation();
  const redeemed = !!coupon.redeemedAt;
  return (
    <section
      className={cn(
        'rounded-card border-2 border-dashed p-4',
        redeemed ? 'border-border bg-surface-sunk' : 'border-majorelle/50 bg-majorelle-soft',
      )}
    >
      <div className="flex items-center gap-2">
        <Ticket className="h-5 w-5 text-majorelle" strokeWidth={1.7} />
        <p className="font-display text-h3 font-medium text-ink">{coupon.offer || t('coupon.defaultOffer')}</p>
      </div>
      <p className="mt-0.5 text-[12px] text-ink-soft">{t('coupon.at', { venue: coupon.venueName })}</p>

      <p
        dir="ltr"
        aria-label={t('coupon.codeLabel')}
        className={cn(
          'mt-3 select-all rounded-input bg-surface px-3 py-3 text-center font-mono text-[22px] font-bold tracking-[0.12em] text-ink',
          redeemed && 'line-through opacity-60',
        )}
      >
        {coupon.code}
      </p>

      {redeemed ? (
        <p className="mt-2 flex items-center gap-1.5 text-meta font-medium text-olive">
          <CheckCircle2 className="h-4 w-4" strokeWidth={1.8} />
          {t('coupon.redeemedOn', { date: new Date(coupon.redeemedAt!).toLocaleString() })}
        </p>
      ) : (
        <p className="mt-2 text-[12px] text-ink-soft">{coupon.redeemable ? t('coupon.showStaff') : t('coupon.notYet')}</p>
      )}
    </section>
  );
}
