import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Crown, Receipt, Store } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { Textarea } from '@/components/Field';
import { useAsync } from '@/hooks/useAsync';
import { cancelUpgradeRequest, createUpgradeRequest, listMyUpgradeRequests } from '@/api';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import type { BillingInterval } from '@/types';
import { SPONSOR_PRODUCT } from './pricing';
import { SponsorshipPicker, type SellableTier } from './SponsorshipPicker';
import { UpgradeRequestCard } from './UpgradeRequestCard';

/**
 * The customer's upgrade requests (pending ones show payment instructions and
 * can be cancelled). Business accounts can also request / renew a sponsorship.
 * Mounted at /upgrades (consumer) and /business/upgrades (business).
 */
export function UpgradesPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const businessId = user?.businessId;
  const list = useAsync(() => listMyUpgradeRequests(), []);
  const [tier, setTier] = useState<SellableTier>('silver');
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);

  async function requestSponsorship() {
    if (!businessId) return;
    setSubmitting(true);
    try {
      await createUpgradeRequest({ product: SPONSOR_PRODUCT[tier], interval, businessId, note: note.trim() || undefined, locale: i18n.language });
      setNote('');
      toast(t('upgrades.requestSent'), 'success');
      list.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('authFlow.genericError'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function cancel(id: string) {
    setCancelling(id);
    try {
      await cancelUpgradeRequest(id);
      toast(t('upgrades.cancelled'), 'info');
      list.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('authFlow.genericError'), 'error');
    } finally {
      setCancelling(null);
    }
  }

  const requests = list.data ?? [];

  return (
    <div className={businessId ? 'mx-auto max-w-2xl' : undefined}>
      {businessId ? (
        <h1 className="mb-1 font-display text-h1 font-medium text-ink">{t('upgrades.title')}</h1>
      ) : (
        <PageHeader back title={t('upgrades.title')} onBack={() => navigate('/pricing')} />
      )}
      <div className={businessId ? 'space-y-4' : 'space-y-4 px-5 pb-10 pt-3 md:px-0'}>
        <p className="text-meta text-ink-soft">{t('upgrades.subtitle')}</p>

        {businessId ? (
          <section className="rounded-card border border-border bg-surface p-4">
            <div className="mb-3 flex items-center gap-2">
              <Store className="h-5 w-5 text-majorelle" strokeWidth={1.7} />
              <h2 className="font-display text-h2 font-medium">{t('upgrades.requestSponsorship')}</h2>
            </div>
            <SponsorshipPicker tier={tier} interval={interval} onTier={setTier} onInterval={setInterval} />
            <Textarea
              className="mt-3"
              rows={2}
              maxLength={1000}
              placeholder={t('upgrades.notePlaceholder')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button className="mt-3" fullWidth loading={submitting} onClick={requestSponsorship}>
              {t('pricing.requestUpgrade')}
            </Button>
          </section>
        ) : (
          <Link to="/pricing" className="flex items-center gap-3 rounded-card border border-border bg-surface p-4 transition-colors hover:border-clay/40">
            <Crown className="h-5 w-5 text-saffron" strokeWidth={1.7} />
            <span className="flex-1 text-meta text-ink">{t('upgrades.getPro')}</span>
          </Link>
        )}

        {list.loading ? (
          <Skeleton className="h-40 w-full rounded-card" />
        ) : requests.length === 0 ? (
          <EmptyState icon={Receipt} title={t('upgrades.empty')} hint={t('upgrades.emptyHint')} />
        ) : (
          <div className="space-y-3">
            {requests.map((r) => (
              <UpgradeRequestCard key={r.id} request={r} onCancel={() => cancel(r.id)} cancelling={cancelling === r.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
