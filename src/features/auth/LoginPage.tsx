import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Bike, Coffee, Dices, Lock, Mail, Mountain, Wand2, Waves } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/Button';
import { DevelopedBy } from '@/components/DevelopedBy';
import { Input } from '@/components/Field';
import { login } from '@/api';
import { useSession } from '@/store/session';
import { AuthBackdrop } from '@/components/AuthBackdrop';

const ACTIVITY_CHIPS: { icon: LucideIcon; label: string }[] = [
  { icon: Coffee, label: 'Coffee' },
  { icon: Waves, label: 'Surf' },
  { icon: Mountain, label: 'Hiking' },
  { icon: Dices, label: 'Board games' },
  { icon: Bike, label: 'Cycling' },
];

export function LoginPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setLogin = useSession((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login({ email, password });
      setLogin(user);
      useSession.getState().completeOnboarding();
      navigate('/discover');
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-[100dvh] bg-ink overflow-hidden">

      {/* Hero — photo mosaic of activities (meeting people IRL) */}
      <AuthBackdrop className="absolute inset-0" />

      {/* Content */}
      <div className="relative flex min-h-[100dvh] flex-col pb-10">

        {/* Top brand area */}
        <div className="mx-auto w-full max-w-app px-6 pt-12 animate-fade-in">
          <div className="flex items-center gap-2.5">
            <img src="/jmaa.svg" alt="hudlgo" className="h-9 w-9" />
            <span className="font-display text-h1 font-medium tracking-tight text-white">hudlgo</span>
          </div>

          <div className="mt-8">
            <span className="inline-block rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[12px] font-medium text-white/90 backdrop-blur-sm">
              {t('auth.badge')}
            </span>
            <h1 className="mt-3 font-display text-display font-medium leading-[1.05] text-white">
              Welcome back
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-white/75">
              People are gathering near you right now.
            </p>
          </div>

          {/* Activity chips */}
          <div className="mt-5 flex flex-wrap gap-2">
            {ACTIVITY_CHIPS.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] font-medium text-white/85 backdrop-blur-sm"
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Form card — slides up from bottom */}
        <div className="mx-auto mt-auto w-full max-w-app animate-[sheet-up_0.35s_cubic-bezier(0.16,1,0.3,1)_both]">
          <div className="rounded-[28px] bg-bg px-6 pb-10 pt-7 shadow-[0_-4px_40px_rgba(43,38,32,.18)]">

            <h2 className="font-display text-h1 font-medium text-ink">
              {t('auth.login')}
            </h2>
            <p className="mt-1 text-meta text-ink-faint">{t('auth.mockNote')}</p>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <Input
                type="email"
                label={t('auth.email')}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="h-5 w-5" />}
                required
              />
              <Input
                type="password"
                label={t('auth.password')}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="h-5 w-5" />}
                required
              />

              <button
                type="button"
                onClick={() => {
                  setEmail('you@jmaa.app');
                  setPassword('password123');
                  setError(null);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-input border border-dashed border-border bg-surface-sunk py-2.5 text-meta font-medium text-ink-soft cursor-pointer hover:border-clay hover:text-clay transition-colors"
              >
                <Wand2 className="h-4 w-4" strokeWidth={1.6} />
                Use demo account
              </button>

              {error && (
                <div className="flex items-center gap-2 rounded-input bg-clay-soft px-4 py-2.5 text-meta font-medium text-clay">
                  <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
                  {error}
                </div>
              )}

              <Button type="submit" size="lg" fullWidth loading={loading} className="!mt-6">
                {t('auth.login')}
              </Button>
            </form>

            <p className="mt-5 text-center text-meta text-ink-soft">
              {t('auth.noAccount')}{' '}
              <Link to="/signup" className="font-semibold text-clay hover:text-clay-press transition-colors">
                {t('auth.signup')}
              </Link>
            </p>

            <DevelopedBy className="mt-6" />
          </div>
        </div>

      </div>
    </div>
  );
}
