import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, Bike, Building2, Camera, Coffee, Dices, Lock, Mail, MapPin, Mountain, Phone, User as UserIcon, Waves } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/Button';
import { DevelopedBy } from '@/components/DevelopedBy';
import { Input } from '@/components/Field';
import { Turnstile, isTurnstileEnabled } from '@/components/Turnstile';
import { signup } from '@/api';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { AuthBackdrop } from '@/components/AuthBackdrop';
import { cn } from '@/lib/cn';

const ACTIVITY_CHIPS: { icon: LucideIcon; label: string }[] = [
  { icon: Coffee, label: 'Coffee' },
  { icon: Waves, label: 'Surf' },
  { icon: Mountain, label: 'Hiking' },
  { icon: Dices, label: 'Board games' },
  { icon: Bike, label: 'Cycling' },
];

function ageFrom(birthday: string): number {
  const b = new Date(birthday);
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}

export function SignupPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const setLogin = useSession((s) => s.login);
  const fileRef = useRef<HTMLInputElement>(null);

  // Capture a referral code from the invite link (?ref=...) and remember it, so
  // it survives navigating between login/signup before the account is created.
  const [searchParams] = useSearchParams();
  const refFromUrl = searchParams.get('ref');
  useEffect(() => {
    if (refFromUrl) localStorage.setItem('jmaa-ref', refFromUrl);
  }, [refFromUrl]);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [neighborhood, setNeighborhood] = useState('');
  const [zip, setZip] = useState('');
  const [birthday, setBirthday] = useState('');
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | null>(null);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [loading, setLoading] = useState(false);

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhoto(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function submit(e: React.FormEvent, google = false) {
    e.preventDefault();
    setError(null);
    if (!google && !photo) return setError(t('auth.photoError'));
    if (!google && password.length < 8) return setError('Password must be at least 8 characters.');
    if (!google && !gender) return setError('Please select your gender.');
    if (birthday && ageFrom(birthday) < 18) return setError(t('auth.ageError'));
    if (isTurnstileEnabled() && !turnstileToken) return setError(t('auth.captchaError'));
    setLoading(true);
    try {
      const user = await signup({
        name: name || (google ? 'Google user' : 'You'),
        email,
        password: google ? undefined : password,
        google,
        avatar: photo ?? undefined,
        neighborhood: neighborhood || undefined,
        zip: zip || undefined,
        birthday: birthday || undefined,
        gender: gender ?? undefined,
        phone: phone || undefined,
        turnstileToken: turnstileToken || undefined,
        referralCode: refFromUrl || localStorage.getItem('jmaa-ref') || undefined,
      });
      localStorage.removeItem('jmaa-ref');
      setLogin(user);
      toast(t('auth.activeNote'), 'success');
      navigate('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen">

      {/* Fixed photo-mosaic background — stays in place while the form scrolls */}
      <AuthBackdrop className="fixed inset-0 -z-10" />

      <div className="flex min-h-screen flex-col pb-10">

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
              Join the crew
            </h1>
            <p className="mt-2 text-[15px] leading-relaxed text-white/75">
              Free forever. No approval needed.
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

        {/* Form card */}
        <div className="mx-auto mt-6 w-full max-w-app px-4 animate-[sheet-up_0.35s_cubic-bezier(0.16,1,0.3,1)_both]">
          <div className="rounded-[28px] bg-bg px-6 pb-10 pt-7 shadow-[0_-4px_40px_rgba(43,38,32,.18)]">

            <h2 className="font-display text-h1 font-medium text-ink">{t('auth.signup')}</h2>
            <p className="mt-1 text-meta text-ink-faint">{t('auth.activeNote')}</p>

            {/* Business sign-up — venues register & sponsor without a user account */}
            <Button
              type="button"
              variant="outline"
              fullWidth
              className="mt-4"
              leftIcon={<Building2 className="h-5 w-5" strokeWidth={1.6} />}
              onClick={() => navigate('/business')}
            >
              {t('auth.businessSignup')}
            </Button>

            {/* Photo upload */}
            <div className="mt-6 flex flex-col items-center">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="relative grid h-24 w-24 place-items-center overflow-hidden rounded-full border-2 border-dashed border-border bg-surface-sunk cursor-pointer hover:border-clay transition-colors"
                aria-label={t('auth.photo')}
              >
                {photo ? (
                  <img src={photo} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-7 w-7 text-ink-faint" strokeWidth={1.5} />
                )}
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={onPhoto} />
              <p className="mt-2 text-[12px] text-ink-faint">{t('auth.addPhoto')} · required</p>
            </div>

            {/* Google button */}
            <button
              type="button"
              onClick={(e) => submit(e, true)}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-input border border-border bg-surface py-3 text-[15px] font-medium text-ink cursor-pointer hover:border-ink/25 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
              </svg>
              {t('auth.google')}
            </button>

            <div className="my-5 flex items-center gap-3 text-[12px] text-ink-faint">
              <span className="h-px flex-1 bg-border" /> {t('auth.or')} <span className="h-px flex-1 bg-border" />
            </div>

            <form onSubmit={(e) => submit(e)} className="space-y-4">
              <Input label={t('auth.name')} placeholder="Salim" value={name} onChange={(e) => setName(e.target.value)} leftIcon={<UserIcon className="h-5 w-5" strokeWidth={1.6} />} required />
              <Input type="email" label={t('auth.email')} placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} leftIcon={<Mail className="h-5 w-5" strokeWidth={1.6} />} required />
              <Input type="password" label={t('auth.password')} hint="At least 8 characters" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} leftIcon={<Lock className="h-5 w-5" strokeWidth={1.6} />} minLength={8} required />
              <div className="grid grid-cols-2 gap-3">
                <Input label={t('auth.neighborhood')} placeholder="Maârif" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} leftIcon={<MapPin className="h-5 w-5" strokeWidth={1.6} />} required />
                <Input label={t('auth.zip')} placeholder="20330" value={zip} onChange={(e) => setZip(e.target.value)} required />
              </div>
              <Input type="date" label={t('auth.birthday')} value={birthday} onChange={(e) => setBirthday(e.target.value)} required />
              <div>
                <span className="mb-1.5 block text-meta font-medium text-ink-soft">Gender</span>
                <div className="grid grid-cols-2 gap-3">
                  {(['MALE', 'FEMALE'] as const).map((g) => (
                    <button
                      type="button"
                      key={g}
                      onClick={() => setGender(g)}
                      className={cn(
                        'rounded-input border py-3 text-[15px] font-medium transition-colors cursor-pointer',
                        gender === g ? 'border-clay bg-clay-soft text-clay' : 'border-border bg-surface text-ink-soft hover:border-ink/25',
                      )}
                    >
                      {g === 'MALE' ? 'Male' : 'Female'}
                    </button>
                  ))}
                </div>
              </div>
              <Input type="tel" label={t('auth.phone')} hint={t('auth.phoneHint')} placeholder="+212…" value={phone} onChange={(e) => setPhone(e.target.value)} leftIcon={<Phone className="h-5 w-5" strokeWidth={1.6} />} />

              <Turnstile onToken={setTurnstileToken} />

              {error && (
                <div className="flex items-center gap-2 rounded-input bg-clay-soft px-4 py-2.5 text-meta font-medium text-clay">
                  <AlertCircle className="h-4 w-4 shrink-0" strokeWidth={2} />
                  {error}
                </div>
              )}

              <Button type="submit" size="lg" fullWidth loading={loading} className="!mt-6">
                {t('auth.continue')}
              </Button>
            </form>

            <p className="mt-5 text-center text-meta text-ink-soft">
              {t('auth.haveAccount')}{' '}
              <Link to="/login" className="font-semibold text-clay hover:text-clay-press transition-colors">
                {t('auth.login')}
              </Link>
            </p>

            <DevelopedBy className="mt-6" />
          </div>
        </div>

      </div>
    </div>
  );
}
