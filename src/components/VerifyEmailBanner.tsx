import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MailWarning, X } from 'lucide-react';
import { resendVerification, getCurrentUser } from '@/api';
import { EMAIL_NOT_VERIFIED_EVENT } from '@/api/http';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';

const DISMISS_KEY = 'hudlgo-verify-banner-dismissed';

function readDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Dismissible nudge for accounts that haven't confirmed their email yet. Dismissal
 * lasts for the browser session; it re-appears whenever the backend rejects an
 * action with EMAIL_NOT_VERIFIED.
 */
export function VerifyEmailBanner() {
  const { t } = useTranslation();
  const user = useSession((s) => s.user);
  const [dismissed, setDismissed] = useState(readDismissed);
  const [sending, setSending] = useState(false);

  // The persisted session can be stale (user verified in another tab/device):
  // refresh once on mount while unverified.
  useEffect(() => {
    if (user?.emailVerified !== false) return;
    getCurrentUser()
      .then((fresh) => useSession.getState().setUser(fresh))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const show = () => {
      setDismissed(false);
      try {
        sessionStorage.removeItem(DISMISS_KEY);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener(EMAIL_NOT_VERIFIED_EVENT, show);
    return () => window.removeEventListener(EMAIL_NOT_VERIFIED_EVENT, show);
  }, []);

  if (!user || user.emailVerified !== false || dismissed) return null;

  async function resend() {
    setSending(true);
    try {
      const res = await resendVerification();
      if (res.alreadyVerified) {
        useSession.getState().setUser(await getCurrentUser());
        toast(t('authFlow.alreadyVerified'), 'success');
      } else {
        toast(t('authFlow.verificationResent'), 'success');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : t('authFlow.genericError'), 'error');
    } finally {
      setSending(false);
    }
  }

  function dismiss() {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
  }

  return (
    <div role="status" className="border-b border-saffron/30 bg-saffron/10">
      <div className="mx-auto flex max-w-shell items-center gap-3 px-5 py-2.5 md:px-6">
        <MailWarning className="h-4 w-4 shrink-0 text-ink-soft" strokeWidth={1.8} />
        <p className="flex-1 text-meta text-ink">
          {t('authFlow.bannerText')}{' '}
          <button
            onClick={resend}
            disabled={sending}
            className="font-semibold text-clay underline-offset-2 hover:underline disabled:opacity-60 cursor-pointer"
          >
            {sending ? t('authFlow.sending') : t('authFlow.resend')}
          </button>
        </p>
        <button
          onClick={dismiss}
          aria-label={t('authFlow.dismiss')}
          className="grid h-7 w-7 place-items-center rounded-full text-ink-soft hover:bg-surface-sunk cursor-pointer"
        >
          <X className="h-4 w-4" strokeWidth={1.8} />
        </button>
      </div>
    </div>
  );
}
