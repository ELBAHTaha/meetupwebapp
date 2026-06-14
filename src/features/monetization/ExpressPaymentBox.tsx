import { useMemo, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Crown, Zap } from 'lucide-react';
import { Button } from '@/components/Button';
import { createExpressPaymentIntent } from '@/api';
import { toast } from '@/store/toast';
import type { PriorityLevel } from '@/types';
import { cn } from '@/lib/cn';

const key = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const stripePromise = key ? loadStripe(key) : null;

type Opt = { id: PriorityLevel; title: string; copy: string; price: string };

// First activity of the week: hosting is free; the paid option only buys a pin.
const FREE_OPTIONS: Opt[] = [
  { id: 'standard', title: 'Free', copy: 'Your free activity this week', price: '$0' },
  { id: 'express', title: 'Pinned', copy: 'Free activity, pinned to the top for visibility', price: '$0.99' },
];

// Free activity already used this week: hosting another now requires payment.
const EXTRA_OPTIONS: Opt[] = [
  { id: 'express', title: 'Create activity', copy: 'Host another activity this week', price: '$0.99' },
  { id: 'priority', title: 'Create + Pinned', copy: 'Extra activity, pinned to the top', price: '$2.99' },
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
  const options = freeAvailable ? FREE_OPTIONS : EXTRA_OPTIONS;
  const [clientSecret, setClientSecret] = useState<string>();
  const [loading, setLoading] = useState(false);

  async function choose(priority: PriorityLevel) {
    onChange(priority, priority === 'standard' ? undefined : paymentIntentId);
    setClientSecret(undefined);
    if (priority === 'standard') return;
    setLoading(true);
    try {
      const intent = await createExpressPaymentIntent(priority);
      if (!stripePromise || intent.clientSecret.startsWith('mock_')) {
        onChange(priority, `mock_${priority}_payment_intent`);
        toast('Mock extra-activity payment marked ready', 'success');
      } else {
        setClientSecret(intent.clientSecret);
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
      {clientSecret && stripePromise && (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <PaymentForm priority={value} onPaid={(id) => onChange(value, id)} />
        </Elements>
      )}
      {loading && <p className="mt-2 text-[12px] text-ink-faint">Preparing secure payment...</p>}
      {value !== 'standard' && paymentIntentId && <p className="mt-2 text-[12px] font-medium text-olive">Extra-activity payment ready.</p>}
    </div>
  );
}

function PaymentForm({ priority, onPaid }: { priority: PriorityLevel; onPaid: (paymentIntentId: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);
  const label = useMemo(() => (priority === 'priority' ? 'Pay $2.99' : 'Pay $0.99'), [priority]);

  async function pay() {
    if (!stripe || !elements) return;
    setPaying(true);
    const result = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: window.location.href },
    });
    setPaying(false);
    if (result.error) {
      toast(result.error.message ?? 'Payment failed', 'error');
      return;
    }
    if (result.paymentIntent?.id) {
      onPaid(result.paymentIntent.id);
      toast('Extra-activity payment confirmed', 'success');
    }
  }

  return (
    <div className="mt-4 rounded-input border border-border bg-bg p-3">
      <PaymentElement />
      <Button className="mt-3" fullWidth loading={paying} onClick={pay}>{label}</Button>
    </div>
  );
}
