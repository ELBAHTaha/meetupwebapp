import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Loader2, MailCheck } from 'lucide-react';
import { Button } from '@/components/Button';
import { getCurrentUser, resendVerification, verifyEmail } from '@/api';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { AuthCardLayout } from './AuthCardLayout';

type State = 'working' | 'done' | 'error';

export function VerifyEmailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const isAuthed = useSession((s) => s.isAuthed);
  const [state, setState] = useState<State>(token ? 'working' : 'error');
  const [error, setError] = useState<string | null>(token ? null : t('authFlow.invalidVerifyLink'));
  const [resending, setResending] = useState(false);
  // Tokens are single-use: guard against React StrictMode's double effect run.
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verifyEmail(token)
      .then(async () => {
        setState('done');
        if (useSession.getState().isAuthed) {
          try {
            useSession.getState().setUser(await getCurrentUser());
          } catch {
            /* the banner refreshes on next load anyway */
          }
        }
      })
      .catch((err) => {
        setState('error');
        setError(err instanceof Error ? err.message : t('authFlow.invalidVerifyLink'));
      });
  }, [token, t]);

  async function resend() {
    setResending(true);
    try {
      const res = await resendVerification();
      toast(res.alreadyVerified ? t('authFlow.alreadyVerified') : t('authFlow.verificationResent'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : t('authFlow.genericError'), 'error');
    } finally {
      setResending(false);
    }
  }

  if (state === 'working') {
    return (
      <AuthCardLayout icon={<Loader2 className="h-6 w-6 animate-spin" strokeWidth={1.6} />} title={t('authFlow.verifying')}>
        <div />
      </AuthCardLayout>
    );
  }

  if (state === 'done') {
    return (
      <AuthCardLayout
        icon={<MailCheck className="h-6 w-6" strokeWidth={1.6} />}
        title={t('authFlow.verifiedTitle')}
        subtitle={t('authFlow.verifiedBody')}
      >
        <Button size="lg" fullWidth onClick={() => navigate(isAuthed ? '/discover' : '/login')}>
          {isAuthed ? t('authFlow.continue') : t('auth.login')}
        </Button>
      </AuthCardLayout>
    );
  }

  return (
    <AuthCardLayout
      icon={<AlertCircle className="h-6 w-6" strokeWidth={1.6} />}
      title={t('authFlow.invalidLinkTitle')}
      subtitle={error ?? t('authFlow.invalidVerifyLink')}
    >
      {isAuthed ? (
        <Button fullWidth loading={resending} onClick={resend}>
          {t('authFlow.resendVerification')}
        </Button>
      ) : (
        <Button fullWidth onClick={() => navigate('/login')}>
          {t('authFlow.loginToResend')}
        </Button>
      )}
    </AuthCardLayout>
  );
}
