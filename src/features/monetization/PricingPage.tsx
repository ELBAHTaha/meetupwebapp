import { useNavigate } from 'react-router-dom';
import { Building2, Check, Crown, Zap } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Tag } from '@/components/Chip';
import { useAsync } from '@/hooks/useAsync';
import { createSubscriptionCheckout, getSubscriptionSummary } from '@/api';
import { toast } from '@/store/toast';
import { cn } from '@/lib/cn';

const hostPlans = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    sub: '1 activity per week',
    points: ['1 free activity per week', '$0.99 per extra activity ($2.99 featured)', 'Join unlimited activities'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$4.99',
    sub: 'Unlimited hosting',
    points: ['Unlimited activities', 'Pinned to top for 2 hours', 'Better visibility after publishing'],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '$9.99',
    sub: 'Priority host growth',
    points: ['Everything in Pro', 'Featured host badge', 'Featured placement on every activity'],
  },
] as const;

export function PricingPage() {
  const navigate = useNavigate();
  const summary = useAsync(() => getSubscriptionSummary(), []);

  async function checkout(plan: 'pro' | 'premium') {
    try {
      const { url } = await createSubscriptionCheckout(plan);
      if (url.startsWith('/')) navigate(url);
      else window.location.href = url;
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not start checkout', 'error');
    }
  }

  return (
    <div>
      <PageHeader back title="Pricing" onBack={() => navigate('/profile')} />
      <div className="px-5 pb-10 pt-3 md:px-0">
        <div className="rounded-card border border-border bg-surface p-4">
          <p className="text-meta font-semibold uppercase text-ink-faint">Current host plan</p>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div>
              <p className="font-display text-h2 font-medium capitalize">{summary.data?.plan ?? 'free'}</p>
              <p className="text-meta text-ink-soft">
                Remaining free activities: {summary.data?.remaining ?? '...'}
              </p>
            </div>
            <Tag className="bg-olive-soft text-olive">{summary.data?.status ?? 'inactive'}</Tag>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {hostPlans.map((plan) => (
            <div key={plan.id} className={cn('flex flex-col rounded-card border bg-surface p-4', plan.id === 'pro' ? 'border-clay' : 'border-border')}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-display text-h2 font-medium">{plan.name}</p>
                    {plan.id === 'pro' && <Tag className="bg-clay-soft text-clay">Popular</Tag>}
                  </div>
                  <p className="mt-1 text-meta text-ink-soft">{plan.sub}</p>
                </div>
                <p className="font-display text-h1 font-medium">{plan.price}<span className="text-meta text-ink-soft">/mo</span></p>
              </div>
              <div className="mt-4 flex-1 space-y-2">
                {plan.points.map((point) => (
                  <p key={point} className="flex items-center gap-2 text-meta text-ink-soft">
                    <Check className="h-4 w-4 text-olive" strokeWidth={1.8} /> {point}
                  </p>
                ))}
              </div>
              <Button
                className="mt-4"
                fullWidth
                variant={plan.id === 'free' ? 'outline' : 'primary'}
                disabled={plan.id === 'free'}
                leftIcon={plan.id === 'premium' ? <Crown className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                onClick={() => plan.id !== 'free' && checkout(plan.id)}
              >
                {plan.id === 'free' ? 'Included' : `Upgrade to ${plan.name}`}
              </Button>
            </div>
          ))}
        </div>

        <div className="mt-5">
          <div className="rounded-card border border-border bg-surface p-4">
            <Building2 className="h-5 w-5 text-majorelle" strokeWidth={1.7} />
            <p className="mt-2 font-display text-h2 font-medium">Sponsor venues</p>
            <p className="mt-1 text-meta text-ink-soft">Bronze, Silver, and Gold venue sponsorships for local businesses.</p>
            <Button className="mt-4" fullWidth variant="outline" onClick={() => navigate('/business')}>Business signup</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
