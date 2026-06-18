import { useEffect, useRef, useState } from 'react';
import { CheckoutEventNames, initializePaddle, type Paddle } from '@paddle/paddle-js';
import { Crown, Zap } from 'lucide-react';
import { createExpressPaymentIntent } from '@/api';
import { toast } from '@/store/toast';
import type { PriorityLevel } from '@/types';
import { cn } from '@/lib/cn';

const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined;
const environment = ((import.meta.env.VITE_PADDLE_ENV as string) || 'sandbox') as 'sandbox' | 'production';

type Opt = { id: PriorityLevel; title: string; copy: string; price: string };

// Free activity available: hosting is free; the paid option only buys a pin.
const FREE_OPTIONS: Opt[] = [
  { id: 'standard', title: 'Free', copy: 'Your free activity (1 every 3 days)', price: 'Free' },
  { id: 'express', title: 'Pinned', copy: 'Free activity, pinned to the top for visibility', price: '9.90 MAD' },
];

// Free activity already used: hosting another now requires payment.
const EXTRA_OPTIONS: Opt[] = [
  { id: 'express', title: 'Create activity', copy: 'Host another activity now', price: '9.90 MAD' },
  { id: 'priority', title: 'Create + Pinned', copy: 'Extra activity, pinned to the top', price: '29.90 MAD' },
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
  const [loading, setLoading] = useState(false);

  const paddleRef = useRef<Paddle>();
  const pendingRef = useRef<{ priority: PriorityLevel; txnId: string }>();
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Boot Paddle.js once (only when a real client token is configured). The
  // overlay confirms the one-time fee; the dev simulation path skips it.
  useEffect(() => {
    if (!token) return;
    let active = true;
    initializePaddle({
      environment,
      token,
      eventCallback: (event) => {
        if (event.name === CheckoutEventNames.CHECKOUT_COMPLETED && pendingRef.current) {
          onChangeRef.current(pendingRef.current.priority, pendingRef.current.txnId);
          toast('Extra-activity payment confirmed', 'success');
          paddleRef.current?.Checkout.close();
          pendingRef.current = undefined;
        }
      },
    }).then((instance) => {
      if (active) paddleRef.current = instance;
    });
    return () => {
      active = false;
    };
  }, []);

  async function choose(priority: PriorityLevel) {
    onChange(priority, priority === 'standard' ? undefined : paymentIntentId);
    if (priority === 'standard') return;
    setLoading(true);
    try {
      const intent = await createExpressPaymentIntent(priority);
      // Real Paddle returns a transactionId → open the overlay checkout.
      if (intent.transactionId && paddleRef.current) {
        pendingRef.current = { priority, txnId: intent.transactionId };
        paddleRef.current.Checkout.open({ transactionId: intent.transactionId });
      } else {
        // Dev simulation: mark the fee as paid with the mock reference.
        const ref = intent.clientSecret?.startsWith('mock_') ? intent.clientSecret : `mock_${priority}_payment_intent`;
        onChange(priority, ref);
        toast('Mock extra-activity payment marked ready', 'success');
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
      {loading && <p className="mt-2 text-[12px] text-ink-faint">Preparing secure payment...</p>}
      {value !== 'standard' && paymentIntentId && <p className="mt-2 text-[12px] font-medium text-olive">Extra-activity payment ready.</p>}
    </div>
  );
}
