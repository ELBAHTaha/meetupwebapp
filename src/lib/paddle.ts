// ---------------------------------------------------------------------------
// Paddle.js overlay checkout.
//
// The backend opens a Paddle transaction and returns a CheckoutSession; here we
// open that transaction in Paddle's overlay and resolve once the shopper either
// completes or closes it. When the backend ran in dev-simulation (no Paddle
// keys) the session is already `simulated` and we resolve immediately.
// ---------------------------------------------------------------------------
import { initializePaddle, type Paddle } from '@paddle/paddle-js';
import type { CheckoutSession } from '@/types';

const TOKEN = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined;
const ENV = (import.meta.env.VITE_PADDLE_ENV as 'sandbox' | 'production' | undefined) ?? 'sandbox';

/** True when a Paddle client-side token is configured (live overlay available). */
export const paddleConfigured = Boolean(TOKEN);

let paddlePromise: Promise<Paddle | undefined> | null = null;
// Resolvers awaiting a given transaction's overlay outcome, keyed by txn id.
const pending = new Map<string, (completed: boolean) => void>();

function settle(transactionId: string | undefined, completed: boolean): void {
  if (!transactionId) return;
  const resolve = pending.get(transactionId);
  if (resolve) {
    pending.delete(transactionId);
    resolve(completed);
  }
}

async function getPaddle(): Promise<Paddle | undefined> {
  if (!TOKEN) return undefined;
  if (!paddlePromise) {
    paddlePromise = initializePaddle({
      token: TOKEN,
      environment: ENV,
      eventCallback: (event) => {
        const txnId = (event.data as { transaction_id?: string } | undefined)?.transaction_id;
        if (event.name === 'checkout.completed') settle(txnId, true);
        else if (event.name === 'checkout.closed') settle(txnId, false);
      },
    });
  }
  return paddlePromise;
}

/** Open a Paddle transaction in the overlay; resolves true once completed. */
async function openCheckout(transactionId: string): Promise<boolean> {
  const paddle = await getPaddle();
  if (!paddle) throw new Error('Payments are not available right now.');
  return new Promise<boolean>((resolve) => {
    pending.set(transactionId, resolve);
    paddle.Checkout.open({ transactionId, settings: { displayMode: 'overlay', theme: 'light' } });
  });
}

/**
 * Settle a checkout session: open the Paddle overlay for a live transaction, or
 * treat a dev-simulated session as already paid. Resolves true on success.
 */
export async function settleCheckout(session: CheckoutSession): Promise<boolean> {
  if (session.simulated) return true;
  if (!session.transactionId) throw new Error('No checkout to open.');
  return openCheckout(session.transactionId);
}
