import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, Check, Crown, Receipt } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Tag } from '@/components/Chip';
import { Sheet } from '@/components/Sheet';
import { useAsync } from '@/hooks/useAsync';
import { createUpgradeRequest, getSubscriptionSummary, listMyUpgradeRequests } from '@/api';
import { toast } from '@/store/toast';
import { cn } from '@/lib/cn';
import type { UpgradeRequest } from '@/types';
import { PINNED_ACTIVITY_MAD, PRO_HOST_MONTHLY_MAD, formatMad } from './pricing';
import { UpgradeRequestCard } from './UpgradeRequestCard';

export function PricingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const summary = useAsync(() => getSubscriptionSummary(), []);
  const requests = useAsync(() => listMyUpgradeRequests(), []);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<UpgradeRequest | null>(null);

  const plan = summary.data?.plan ?? 'free';
  const isPro = plan === 'pro';
  const remaining = summary.data?.remaining;
  const pendingPro = requests.data?.find((r) => r.product === 'pro_host' && r.status === 'pending');

  async function requestPro() {
    if (pendingPro) {
      setShown(pendingPro);
      return;
    }
    setBusy(true);
    try {
      const req = await createUpgradeRequest({ product: 'pro_host', interval: 'monthly', locale: i18n.language });
      setShown(req);
      requests.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('authFlow.genericError'), 'error');
    } finally {
      setBusy(false);
    }
  }

  const hostPlans = [
    {
      id: 'free',
      name: t('pricing.freeName'),
      price: t('pin.free'),
      sub: t('pricing.freeSub'),
      points: [t('pricing.freeP1'), t('pricing.freeP2', { price: formatMad(PINNED_ACTIVITY_MAD) }), t('pricing.freeP3')],
    },
    {
      id: 'pro',
      name: t('pricing.proName'),
      price: formatMad(PRO_HOST_MONTHLY_MAD),
      sub: t('pricing.proSub'),
      popular: true,
      points: [t('pricing.proP1'), t('pricing.proP2'), t('pricing.proP3')],
    },
  ];

  return (
    <div>
      <PageHeader back title={t('pricing.title')} onBack={() => navigate('/profile')} />
      <div className="px-5 pb-10 pt-3 md:max-w-shell md:px-0">
        <div className="rounded-card border border-border bg-surface p-4">
          <p className="text-meta font-semibold uppercase text-ink-faint">{t('pricing.currentPlan')}</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-h2 font-medium">{isPro ? t('pricing.proName') : t('pricing.freeName')}</p>
              <p className="text-meta text-ink-soft">
                {remaining === 'unlimited'
                  ? t('pricing.unlimited')
                  : t('pricing.remainingFree', { count: typeof remaining === 'number' ? remaining : 0 })}
              </p>
              {isPro && summary.data?.endsAt && (
                <p className="mt-0.5 text-[12px] text-ink-faint">
                  {t('pricing.activeUntil', { date: new Date(summary.data.endsAt).toLocaleDateString() })}
                </p>
              )}
            </div>
            <Tag className={isPro ? 'bg-olive-soft text-olive' : 'bg-surface-sunk text-ink-soft'}>
              {isPro ? t('upgrades.status.approved') : t('pricing.freeName')}
            </Tag>
          </div>
        </div>

        <h2 className="mt-6 font-display text-h1 font-medium">{t('pricing.tiersTitle')}</h2>
        <p className="mt-1 text-meta text-ink-soft">{t('pricing.tiersSubtitle')}</p>
        <p className="mt-3 rounded-card border border-border bg-saffron-soft px-4 py-3 text-meta text-ink-soft">
          {t('pricing.manualNote')}
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {hostPlans.map((p) => {
            const isCurrent = (p.id === 'pro') === isPro;
            return (
              <div key={p.id} className={cn('relative flex flex-col rounded-card border bg-surface p-4', p.popular ? 'border-clay ring-1 ring-clay' : 'border-border')}>
                {p.popular && <Tag className="absolute -top-2.5 start-4 bg-clay text-white shadow-sm">{t('pricing.popular')}</Tag>}
                <div>
                  <p className="font-display text-h2 font-medium">{p.name}</p>
                  <p className="mt-0.5 text-meta text-ink-soft">{p.sub}</p>
                  <p className="mt-2 font-display text-h1 font-medium">
                    {p.price}
                    {p.id === 'pro' && <span className="text-meta font-normal text-ink-soft">{t('pricing.perMonth')}</span>}
                  </p>
                </div>
                <div className="mt-3 flex-1 space-y-2 border-t border-border pt-3">
                  {p.points.map((point) => (
                    <p key={point} className="flex items-start gap-2 text-[12px] leading-snug text-ink-soft">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-olive" strokeWidth={1.8} /> {point}
                    </p>
                  ))}
                </div>
                {p.id === 'free' ? (
                  <Button className="mt-4" fullWidth variant="outline" disabled>
                    {isCurrent ? t('pricing.current') : t('pricing.included')}
                  </Button>
                ) : (
                  <Button
                    className="mt-4"
                    fullWidth
                    loading={busy}
                    variant={pendingPro ? 'outline' : 'primary'}
                    leftIcon={<Crown className="h-4 w-4" />}
                    onClick={requestPro}
                  >
                    {pendingPro ? t('pricing.viewPending') : isPro ? t('pricing.renew') : t('pricing.requestUpgrade')}
                  </Button>
                )}
              </div>
            );
          })}
        </div>

        <Link to="/upgrades" className="mt-4 inline-flex items-center gap-1.5 text-meta font-medium text-clay hover:underline">
          <Receipt className="h-4 w-4" strokeWidth={1.7} /> {t('upgrades.myRequests')}
        </Link>

        <div className="mt-6 rounded-card border border-border bg-surface p-4">
          <Building2 className="h-5 w-5 text-majorelle" strokeWidth={1.7} />
          <p className="mt-2 font-display text-h2 font-medium">{t('pricing.sponsorTitle')}</p>
          <p className="mt-1 text-meta text-ink-soft">{t('pricing.sponsorBody')}</p>
          <Button className="mt-4" variant="outline" onClick={() => navigate('/business')}>{t('pricing.businessSignup')}</Button>
        </div>
      </div>

      <Sheet open={!!shown} onClose={() => setShown(null)} title={t('upgrades.instructionsTitle')}>
        {shown && (
          <div className="space-y-3 pb-2">
            <p className="text-meta text-ink-soft">{t('upgrades.instructionsIntro')}</p>
            <UpgradeRequestCard request={shown} />
            <Button fullWidth variant="outline" onClick={() => navigate('/upgrades')}>{t('upgrades.myRequests')}</Button>
          </div>
        )}
      </Sheet>
    </div>
  );
}
