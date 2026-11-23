import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Lock, LockKeyhole } from 'lucide-react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Field';
import { resetPassword } from '@/api';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { AuthCardLayout } from './AuthCardLayout';

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError(t('authFlow.passwordTooShort'));
    if (password !== confirm) return setError(t('authFlow.passwordMismatch'));
    setLoading(true);
    try {
      await resetPassword(token, password);
      // Every session (including this one) was revoked server-side — start fresh.
      if (useSession.getState().isAuthed) useSession.getState().logout();
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authFlow.genericError'));
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <AuthCardLayout
        icon={<AlertCircle className="h-6 w-6" strokeWidth={1.6} />}
        title={t('authFlow.invalidLinkTitle')}
        subtitle={t('authFlow.invalidResetLink')}
      >
        <Button fullWidth onClick={() => navigate('/forgot-password')}>
          {t('authFlow.requestNewLink')}
        </Button>
      </AuthCardLayout>
    );
  }

  if (done) {
    return (
      <AuthCardLayout
        icon={<CheckCircle2 className="h-6 w-6" strokeWidth={1.6} />}
        title={t('authFlow.resetDoneTitle')}
        subtitle={t('authFlow.resetDoneBody')}
      >
        <Button
          size="lg"
          fullWidth
          onClick={() => {
            toast(t('authFlow.resetDoneToast'), 'success');
            navigate('/login');
          }}
        >
          {t('auth.login')}
        </Button>
      </AuthCardLayout>
    );
  }

  return (
    <AuthCardLayout
      icon={<LockKeyhole className="h-6 w-6" strokeWidth={1.6} />}
      title={t('authFlow.resetTitle')}
      subtitle={t('authFlow.resetSubtitle')}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          type="password"
          label={t('authFlow.newPassword')}
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          leftIcon={<Lock className="h-5 w-5" />}
          hint={t('authFlow.passwordRule')}
          autoComplete="new-password"
          minLength={8}
          maxLength={72}
          required
        />
        <Input
          type="password"
          label={t('authFlow.confirmPassword')}
          placeholder="••••••••"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          leftIcon={<Lock className="h-5 w-5" />}
          autoComplete="new-password"
          maxLength={72}
          required
        />
        {error && (
          <div className="flex items-start gap-2 rounded-input bg-clay-soft px-4 py-2.5 text-meta font-medium text-clay">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
            <span>
              {error}{' '}
              {/* Expired/used links can't be retried — offer a fresh one. */}
              <Link to="/forgot-password" className="underline">
                {t('authFlow.requestNewLink')}
              </Link>
            </span>
          </div>
        )}
        <Button type="submit" size="lg" fullWidth loading={loading}>
          {t('authFlow.savePassword')}
        </Button>
      </form>
    </AuthCardLayout>
  );
}
