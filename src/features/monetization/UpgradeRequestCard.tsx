import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Landmark } from 'lucide-react';
import { Button } from '@/components/Button';
import { Tag } from '@/components/Chip';
import { cn } from '@/lib/cn';
import { formatEventDate } from '@/lib/format';
import type { UpgradeRequest } from '@/types';
import { formatMad } from './pricing';

const STATUS_TONE: Record<UpgradeRequest['status'], string> = {
  pending: 'bg-saffron-soft text-ink',
  approved: 'bg-olive-soft text-olive',
  rejected: 'bg-clay-soft text-clay',
  cancelled: 'bg-surface-sunk text-ink-soft',
};

/**
 * One upgrade request: what it's for, the amount, the transfer reference (big,
 * copyable) and — while pending — the payment instructions to follow.
 */
export function UpgradeRequestCard({
  request,
  onCancel,
  cancelling,
  className,
}: {
  request: UpgradeRequest;
  onCancel?: () => void;
  cancelling?: boolean;
  className?: string;
}) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const pending = request.status === 'pending';

  async function copy() {
    try {
      await navigator.clipboard.writeText(request.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the code is visible anyway */
    }
  }

  return (
    <div className={cn('rounded-card border border-border bg-surface p-4', className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-h3 font-medium text-ink">{t(`upgrades.product.${request.product}`)}</p>
          <p className="text-[12px] text-ink-soft">
            {request.businessName ?? request.eventTitle ?? ''}
            {request.billingInterval && request.product !== 'pinned_activity' ? ` · ${t(`upgrades.interval.${request.billingInterval}`)}` : ''}
          </p>
        </div>
        <Tag className={cn('shrink-0', STATUS_TONE[request.status])}>{t(`upgrades.status.${request.status}`)}</Tag>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 rounded-input bg-surface-sunk px-3 py-2.5">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{t('upgrades.reference')}</p>
          <p dir="ltr" className="font-mono text-[20px] font-semibold tracking-wider text-ink">{request.reference}</p>
        </div>
        <div className="text-end">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{t('upgrades.amount')}</p>
          <p className="font-display text-h2 font-medium text-ink">{formatMad(request.amountCents, true)}</p>
        </div>
      </div>

      {pending && (
        <>
          <button
            onClick={copy}
            className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-clay hover:underline cursor-pointer"
          >
            {copied ? <Check className="h-3.5 w-3.5" strokeWidth={2} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.8} />}
            {copied ? t('upgrades.copied') : t('upgrades.copyReference')}
          </button>
          {request.instructions && (
            <div className="mt-3 flex gap-2.5 rounded-input border border-border bg-bg p-3">
              <Landmark className="mt-0.5 h-4 w-4 shrink-0 text-ink-soft" strokeWidth={1.7} />
              <p className="whitespace-pre-line text-meta leading-relaxed text-ink">{request.instructions}</p>
            </div>
          )}
          <p className="mt-2 text-[12px] text-ink-faint">{t('upgrades.pendingHint')}</p>
        </>
      )}

      {request.status === 'approved' && request.grantedUntil && (
        <p className="mt-3 text-meta text-olive">
          {request.product === 'pinned_activity'
            ? t('upgrades.pinnedUntil', { date: formatEventDate(request.grantedUntil) })
            : t('upgrades.activeUntil', { date: new Date(request.grantedUntil).toLocaleDateString() })}
        </p>
      )}
      {request.adminNote && request.status !== 'pending' && (
        <p className="mt-2 text-[12px] text-ink-soft">{t('upgrades.adminNote', { note: request.adminNote })}</p>
      )}

      {pending && onCancel && (
        <Button className="mt-3" size="sm" variant="ghost" loading={cancelling} onClick={onCancel}>
          {t('upgrades.cancel')}
        </Button>
      )}
    </div>
  );
}
