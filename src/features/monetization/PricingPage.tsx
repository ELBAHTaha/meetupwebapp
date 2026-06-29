import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Check, Crown } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Tag } from '@/components/Chip';
import { useAsync } from '@/hooks/useAsync';
import { createSubscriptionCheckout, getSubscriptionSummary } from '@/api';
import { settleCheckout } from '@/lib/paddle';
import { toast } from '@/store/toast';
import { cn } from '@/lib/cn';

type Tier = 'pro';

const hostPlans = [
  {
    id: 'free',
    name: 'Free',
    price: 'Free',
    sub: '1 activity every day',
    points: ['1 free activity every day', '19.90 MAD per extra activity (pinned to the top)', 'Join unlimited activities'],
  },
  {
    id: 'pro',
    name: 'Pro Host',
    price: '49 MAD',
    sub: 'Unlimited hosting',
    popular: true,
    points: ['Host unlimited activities', '7 pinned activities per week', 'Priority visibility & top placement'],
  },
] as const;

export function PricingPage() {
  const navigate = useNavigate();
  const summary = useAsync(() => getSubscriptionSummary(), []);
  const [busy, setBusy] = useState(false);

  async function checkout(plan: Tier) {
    setBusy(true);
    try {
      const session = await createSubscriptionCheckout(plan);
      const ok = await settleCheckout(session);
      if (ok) {
        toast('You’re on Pro Host — enjoy unlimited hosting!', 'success');
        summary.reload();
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not start checkout', 'error');
    } finally {
      setBusy(false);
    }
  }

  const remaining = summary.data?.remaining;

  return (
    <div>
      <PageHeader back title="Pricing" onBack={() => navigate('/profile')} />
      <div className="px-5 pb-10 pt-3 md:max-w-shell md:px-0">
        <div className="rounded-card border border-border bg-surface p-4">
          <p className="text-meta font-semibold uppercase text-ink-faint">Current plan</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-h2 font-medium capitalize">{summary.data?.plan ?? 'free'}</p>
              <p className="text-meta text-ink-soft">
                {remaining === 'unlimited' ? 'Unlimited hosting' : `Remaining free activities: ${remaining ?? '...'}`}
              </p>
            </div>
            <Tag className="bg-olive-soft text-olive">{summary.data?.status ?? 'inactive'}</Tag>
          </div>
        </div>

        <h2 className="mt-6 font-display text-h1 font-medium">Membership tiers</h2>
        <p className="mt-1 text-meta text-ink-soft">Host more often and pin your activities to the top.</p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {hostPlans.map((plan) => {
            const isCurrent = (summary.data?.plan ?? 'free') === plan.id;
            const popular = 'popular' in plan && plan.popular;
            return (
              <div key={plan.id} className={cn('relative flex flex-col rounded-card border bg-surface p-4', popular ? 'border-clay ring-1 ring-clay' : 'border-border')}>
                {popular && <Tag className="absolute -top-2.5 left-4 bg-clay text-white shadow-sm">Most popular</Tag>}
                <div>
                  <p className="font-display text-h2 font-medium">{plan.name}</p>
                  <p className="mt-0.5 text-meta text-ink-soft">{plan.sub}</p>
                  <p className="mt-2 font-display text-h1 font-medium">
                    {plan.price}
                    <span className="text-meta font-normal text-ink-soft">/mo</span>
                  </p>
                </div>
                <div className="mt-3 flex-1 space-y-2 border-t border-border pt-3">
                  {plan.points.map((point) => (
                    <p key={point} className="flex items-start gap-2 text-[12px] leading-snug text-ink-soft">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-olive" strokeWidth={1.8} /> {point}
                    </p>
                  ))}
                </div>
                <Button
                  className="mt-4"
                  fullWidth
                  loading={busy && plan.id === 'pro' && !isCurrent}
                  variant={plan.id === 'free' || isCurrent ? 'outline' : 'primary'}
                  disabled={plan.id === 'free' || isCurrent || busy}
                  leftIcon={plan.id === 'pro' ? <Crown className="h-4 w-4" /> : undefined}
                  onClick={() => plan.id !== 'free' && !isCurrent && checkout(plan.id as Tier)}
                >
                  {isCurrent ? 'Current plan' : plan.id === 'free' ? 'Included' : `Get ${plan.name}`}
                </Button>
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-card border border-border bg-surface p-4">
          <Building2 className="h-5 w-5 text-majorelle" strokeWidth={1.7} />
          <p className="mt-2 font-display text-h2 font-medium">Sponsor venues</p>
          <p className="mt-1 text-meta text-ink-soft">Starter, Bronze, and Silver venue sponsorships for local businesses.</p>
          <Button className="mt-4" variant="outline" onClick={() => navigate('/business')}>Business signup</Button>
        </div>
      </div>
    </div>
  );
}
