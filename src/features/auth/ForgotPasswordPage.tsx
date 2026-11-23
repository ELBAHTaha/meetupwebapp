import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, KeyRound, Mail, MailCheck } from 'lucide-react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Field';
import { forgotPassword } from '@/api';
import { AuthCardLayout } from './AuthCardLayout';

export function ForgotPasswordPage() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await forgotPassword(email.trim(), i18n.language);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('authFlow.genericError'));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthCardLayout
        icon={<MailCheck className="h-6 w-6" strokeWidth={1.6} />}
        title={t('authFlow.forgotSentTitle')}
        subtitle={t('authFlow.forgotSentBody', { email: email.trim() })}
      >
        <p className="text-meta text-ink-faint">{t('authFlow.forgotSentHint')}</p>
        <div className="mt-6 flex flex-col gap-3">
          <Button variant="outline" fullWidth onClick={() => setSent(false)}>
            {t('authFlow.tryAnotherEmail')}
          </Button>
          <Link to="/login" className="text-center text-meta font-semibold text-clay hover:text-clay-press">
            {t('authFlow.backToLogin')}
          </Link>
        </div>
      </AuthCardLayout>
    );
  }

  return (
    <AuthCardLayout
      icon={<KeyRound className="h-6 w-6" strokeWidth={1.6} />}
      title={t('authFlow.forgotTitle')}
      subtitle={t('authFlow.forgotSubtitle')}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Input
          type="email"
          label={t('auth.email')}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          leftIcon={<Mail className="h-5 w-5" />}
          autoComplete="email"
          required
        />
        {error && (
          <div className="flex items-center gap-2 rounded-input bg-clay-soft px-4 py-2.5 text-meta font-medium text-clay">
            <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
            {error}
          </div>
        )}
        <Button type="submit" size="lg" fullWidth loading={loading}>
          {t('authFlow.sendResetLink')}
        </Button>
      </form>
      <p className="mt-5 text-center text-meta text-ink-soft">
        <Link to="/login" className="font-semibold text-clay hover:text-clay-press">
          {t('authFlow.backToLogin')}
        </Link>
      </p>
    </AuthCardLayout>
  );
}
