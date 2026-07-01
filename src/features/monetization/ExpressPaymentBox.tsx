import { useState } from 'react';
import { Crown, Zap } from 'lucide-react';
import { createExpressPaymentIntent } from '@/api';
import { settleCheckout, paymentsEnabled } from '@/lib/paddle';
import { toast } from '@/store/toast';
import type { PriorityLevel } from '@/types';
import { cn } from '@/lib/cn';

type Opt = { id: PriorityLevel; title: string; copy: string; price: string };

// Free activity available: hosting is free; the paid option pins it to the top.
const FREE_OPTIONS: Opt[] = [
  { id: 'standard', title: 'Free', copy: 'Your free activity (1 every day)', price: 'Free' },
  { id: 'priority', title: 'Pinned', copy: 'Pin your activity to the top for visibility', price: '19.90 MAD' },
];

// Free activity already used: hosting another now costs a one-off fee (pinned).
const EXTRA_OPTIONS: Opt[] = [
  { id: 'priority', title: 'Create + Pinned', copy: 'Host an extra activity, pinned to the top', price: '19.90 MAD' },
];

export function ExpressPaymentBox({
  value,
  paymentIntentId,
  freeAvailable,
  onChange,
}: {
  value: PriorityLevel;
  paymentIntentId?: string;
  /** True when the host still has their free weekly activity available. */
  freeAvailable: boolean;
  onChange: (priority: PriorityLevel, paymentIntentId?: string) => void;
}) {
  // While payments are disabled, only the free/standard option is offered.
  const options = (freeAvailable ? FREE_OPTIONS : EXTRA_OPTIONS).filter(
    (item) => paymentsEnabled || item.id === 'standard',
  );
  const [loading, setLoading] = useState(false);

  async function choose(priority: PriorityLevel) {
    if (priority === 'standard') {
      onChange('standard', undefined);
      return;
    }
    // Already paid for this priority — just keep the selection.
    if (value === priority && paymentIntentId) {
      onChange(priority, paymentIntentId);
      return;
    }
    setLoading(true);
    try {
      const session = await createExpressPaymentIntent(priority);
      const ok = await settleCheckout(session);
      if (ok) {
        // The paid order id is carried back to createEvent as the payment ref.
        onChange(priority, session.ref);
        toast('Extra-activity payment confirmed', 'success');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not start payment', 'error');
    } finally {
      setLoading(false);
    }
  }

  const selected = options.find((item) => item.id === value);

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-h3 font-medium">{freeAvailable ? 'Activity visibility' : 'Extra activity'}</p>
          <p className="text-meta text-ink-soft">{selected?.copy ?? 'Choose an option to continue'}</p>
        </div>
        {value === 'priority' ? <Crown className="h-5 w-5 text-saffron" /> : <Zap className="h-5 w-5 text-clay" />}
      </div>
      <div className="mt-3 grid gap-2">
        {options.map((item) => (
          <button
            key={item.id}
            onClick={() => choose(item.id)}
            className={cn('flex items-center justify-between rounded-input border px-3 py-2.5 text-left transition-colors', value === item.id ? 'border-clay bg-clay-soft' : 'border-border bg-bg')}
          >
            <span>
              <span className="block text-meta font-semibold text-ink">{item.title}</span>
              <span className="block text-[12px] text-ink-soft">{item.copy}</span>
            </span>
            <span className="text-meta font-semibold text-ink">{item.price}</span>
          </button>
        ))}
      </div>
      {!paymentsEnabled && (
        <p className="mt-2 text-[12px] text-ink-faint">
          {freeAvailable
            ? 'Paid pinning is coming soon — your free activity works as normal.'
            : 'You’ve used today’s free activity. Extra paid activities are coming soon — try again tomorrow.'}
        </p>
      )}
      {loading && <p className="mt-2 text-[12px] text-ink-faint">Opening secure checkout...</p>}
      {value !== 'standard' && paymentIntentId && <p className="mt-2 text-[12px] font-medium text-olive">Extra-activity payment ready.</p>}
    </div>
  );
}
