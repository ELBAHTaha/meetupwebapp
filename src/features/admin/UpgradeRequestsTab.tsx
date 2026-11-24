import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Receipt, X } from 'lucide-react';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Chip';
import { approveUpgradeRequest, listUpgradeRequestsAdmin, rejectUpgradeRequest } from '@/api';
import { useAsync } from '@/hooks/useAsync';
import { toast } from '@/store/toast';
import { cn } from '@/lib/cn';
import { formatRelative } from '@/lib/format';
import { formatMad } from '@/features/monetization/pricing';
import type { UpgradeRequest } from '@/types';

const DEFAULT_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, annual: 12 };

/** Admin: pending upgrade requests first — confirm the offline payment, then approve. */
export function UpgradeRequestsTab({ onChanged }: { onChanged: () => void }) {
  const { t } = useTranslation();
  const list = useAsync(() => listUpgradeRequestsAdmin(), []);
  const [showDecided, setShowDecided] = useState(false);

  if (list.loading) return <Skeleton className="h-40 w-full rounded-card" />;
  const rows = list.data ?? [];
  const pending = rows.filter((r) => r.status === 'pending');
  const decided = rows.filter((r) => r.status !== 'pending');

  return (
    <div className="space-y-3">
      <p className="text-meta text-ink-soft">{t('adminUpgrades.intro')}</p>
      {pending.length === 0 ? (
        <EmptyState icon={Receipt} title={t('adminUpgrades.none')} />
      ) : (
        pending.map((r) => (
          <PendingCard
            key={r.id}
            r={r}
            onDone={() => {
              list.reload();
              onChanged();
            }}
          />
        ))
      )}
      {decided.length > 0 && (
        <button onClick={() => setShowDecided((v) => !v)} className="text-meta font-medium text-clay hover:underline cursor-pointer">
          {showDecided ? t('adminUpgrades.hideHistory') : t('adminUpgrades.showHistory', { count: decided.length })}
        </button>
      )}
      {showDecided &&
        decided.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface p-3">
            <div className="min-w-0">
              <p className="truncate text-meta font-medium text-ink">
                {r.reference} · {t(`upgrades.product.${r.product}`)} · {r.user?.name}
              </p>
              <p className="text-[12px] text-ink-soft">
                {formatMad(r.amountCents, true)}
                {r.grantedUntil && ` · ${t('upgrades.activeUntil', { date: new Date(r.grantedUntil).toLocaleDateString() })}`}
                {r.adminNote && ` · ${r.adminNote}`}
              </p>
            </div>
            <Tag className={cn('shrink-0', r.status === 'approved' ? 'bg-olive-soft text-olive' : 'bg-surface-sunk text-ink-soft')}>
              {t(`upgrades.status.${r.status}`)}
            </Tag>
          </div>
        ))}
    </div>
  );
}

function PendingCard({ r, onDone }: { r: UpgradeRequest; onDone: () => void }) {
  const { t } = useTranslation();
  const isPin = r.product === 'pinned_activity';
  const [months, setMonths] = useState<number>(DEFAULT_MONTHS[r.billingInterval ?? 'monthly'] ?? 1);
  const [until, setUntil] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  async function decide(kind: 'approve' | 'reject') {
    if (kind === 'reject' && !window.confirm(t('adminUpgrades.confirmReject', { ref: r.reference }))) return;
    setBusy(kind);
    try {
      if (kind === 'approve') {
        await approveUpgradeRequest(r.id, isPin ? { adminNote: note || undefined } : { months, until: until || undefined, adminNote: note || undefined });
        toast(t('adminUpgrades.approved', { ref: r.reference }), 'success');
      } else {
        await rejectUpgradeRequest(r.id, note || undefined);
        toast(t('adminUpgrades.rejected', { ref: r.reference }), 'info');
      }
      onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('authFlow.genericError'), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-card border border-saffron/40 bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p dir="ltr" className="font-mono text-[17px] font-semibold tracking-wider text-ink">{r.reference}</p>
          <p className="text-meta text-ink">
            {t(`upgrades.product.${r.product}`)}
            {r.billingInterval && !isPin && ` · ${t(`upgrades.interval.${r.billingInterval}`)}`}
            {' · '}
            <span className="font-semibold">{formatMad(r.amountCents, true)}</span>
          </p>
          <p className="text-[12px] text-ink-soft">
            {r.user?.name} · {r.user?.email}
            {r.businessName && ` · ${r.businessName}`}
            {r.eventTitle && ` · “${r.eventTitle}”`}
          </p>
          {r.note && <p className="mt-1 text-[12px] italic text-ink-soft">“{r.note}”</p>}
        </div>
        <span className="text-[12px] text-ink-faint">{formatRelative(r.createdAt)}</span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {isPin ? (
          <p className="text-[12px] text-ink-soft sm:col-span-2">{t('adminUpgrades.pinNote')}</p>
        ) : (
          <>
            <label className="text-[12px] text-ink-soft">
              {t('adminUpgrades.months')}
              <select
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                className="mt-1 w-full rounded-input border border-border bg-bg px-2 py-2 text-meta text-ink"
              >
                {[1, 2, 3, 6, 12].map((m) => (
                  <option key={m} value={m}>{t('adminUpgrades.monthsCount', { count: m })}</option>
                ))}
              </select>
            </label>
            <label className="text-[12px] text-ink-soft">
              {t('adminUpgrades.orUntil')}
              <input
                type="date"
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                className="mt-1 w-full rounded-input border border-border bg-bg px-2 py-2 text-meta text-ink"
              />
            </label>
          </>
        )}
        <label className="text-[12px] text-ink-soft">
          {t('adminUpgrades.note')}
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={1000}
            className="mt-1 w-full rounded-input border border-border bg-bg px-2 py-2 text-meta text-ink"
          />
        </label>
      </div>

      <div className="mt-3 flex gap-2">
        <Button size="sm" loading={busy === 'approve'} disabled={!!busy} leftIcon={<Check className="h-4 w-4" />} onClick={() => decide('approve')}>
          {t('adminUpgrades.approve')}
        </Button>
        <Button size="sm" variant="danger" loading={busy === 'reject'} disabled={!!busy} leftIcon={<X className="h-4 w-4" />} onClick={() => decide('reject')}>
          {t('adminUpgrades.reject')}
        </Button>
      </div>
    </div>
  );
}
