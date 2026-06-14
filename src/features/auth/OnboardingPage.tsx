import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, Heart, MapPin, Plane, Users } from 'lucide-react';
import { Button } from '@/components/Button';
import { ActivityIcon } from '@/components/ActivityIcon';
import { CITIES, SEED_ACTIVITIES } from '@/api/catalog';
import { updateProfile } from '@/api';
import { useSession } from '@/store/session';
import type { LookingFor } from '@/types';
import { cn } from '@/lib/cn';

export function OnboardingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Business owners arrive here via /onboarding with this flag and skip the
  // consumer-only questions ("what are you here for" and "visiting Morocco?").
  const isBusiness = !!(useLocation().state as { business?: boolean } | null)?.business;
  const { setCity, setUser, completeOnboarding } = useSession();
  const user = useSession((s) => s.user);

  const [step, setStep] = useState(0);
  const [city, setCityLocal] = useState(user?.city ?? 'Casablanca');
  const [lookingFor, setLookingFor] = useState<LookingFor | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [traveler, setTraveler] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const toggleActivity = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  async function finish() {
    setSaving(true);
    setCity(city);
    const updated = await updateProfile({
      city,
      isTraveler: traveler ?? false,
      lookingFor: lookingFor ?? 'both',
      activities: picked.map((id) => ({ activityId: id, level: 'any' as const })),
    });
    setUser(updated);
    completeOnboarding();
    navigate('/discover');
  }

  const lfOptions: { key: LookingFor; icon: typeof Users; label: string; hint: string }[] = [
    { key: 'partners', icon: Heart, label: t('onboarding.lfPartners'), hint: t('onboarding.lfPartnersHint') },
    { key: 'friends', icon: Users, label: t('onboarding.lfFriends'), hint: t('onboarding.lfFriendsHint') },
    { key: 'both', icon: Check, label: t('onboarding.lfBoth'), hint: t('onboarding.lfBothHint') },
  ];

  const steps = [
    // 0 — city
    <div key="city">
      <h1 className="font-display text-h1 font-medium">{t('onboarding.cityTitle')}</h1>
      <p className="mt-1 text-meta text-ink-soft">{t('onboarding.citySubtitle')}</p>
      <div className="mt-6 grid grid-cols-2 gap-2.5">
        {CITIES.map((c) => (
          <button key={c.id} onClick={() => setCityLocal(c.name)} className={cn('flex items-center gap-2 rounded-input border p-3.5 text-left font-medium transition-colors cursor-pointer', city === c.name ? 'border-clay bg-clay-soft text-clay' : 'border-border bg-surface text-ink-soft hover:border-ink/25')}>
            <MapPin className="h-4 w-4 shrink-0" strokeWidth={1.6} />
            <span className="truncate">{c.name}</span>
          </button>
        ))}
      </div>
    </div>,

    // 1 — looking for
    <div key="lf">
      <h1 className="font-display text-h1 font-medium">{t('onboarding.lfTitle')}</h1>
      <p className="mt-1 text-meta text-ink-soft">{t('onboarding.lfSubtitle')}</p>
      <div className="mt-6 space-y-3">
        {lfOptions.map((o) => {
          const on = lookingFor === o.key;
          return (
            <button key={o.key} onClick={() => setLookingFor(o.key)} className={cn('flex w-full items-center gap-3 rounded-card border p-4 text-left transition-colors cursor-pointer', on ? 'border-clay bg-clay-soft' : 'border-border bg-surface hover:border-ink/25')}>
              <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-[10px]', on ? 'bg-clay text-white' : 'bg-surface-sunk text-ink-soft')}>
                <o.icon className="h-5 w-5" strokeWidth={1.6} />
              </span>
              <div>
                <p className="font-display text-h3 font-medium text-ink">{o.label}</p>
                <p className="text-[12px] text-ink-soft">{o.hint}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>,

    // 2 — activities
    <div key="acts">
      <h1 className="font-display text-h1 font-medium">{t('onboarding.activitiesTitle')}</h1>
      <p className="mt-1 text-meta text-ink-soft">{t('onboarding.activitiesSubtitle')}</p>
      <div className="mt-6 grid grid-cols-3 gap-2.5">
        {SEED_ACTIVITIES.map((a) => {
          const on = picked.includes(a.id);
          return (
            <button key={a.id} onClick={() => toggleActivity(a.id)} className={cn('relative flex flex-col items-center gap-2 rounded-card border p-3 transition-colors cursor-pointer', on ? 'border-clay bg-clay-soft' : 'border-border bg-surface hover:border-ink/20')}>
              {on && <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-clay text-white"><Check className="h-3 w-3" strokeWidth={2.4} /></span>}
              <ActivityIcon activity={a} size="md" tile />
              <span className="text-center text-[12px] font-medium leading-tight text-ink-soft">{a.name}</span>
            </button>
          );
        })}
      </div>
    </div>,

    // 3 — traveler
    <div key="traveler">
      <h1 className="font-display text-h1 font-medium">{t('onboarding.travelerQuestion')}</h1>
      <div className="mt-6 space-y-3">
        <button onClick={() => setTraveler(true)} className={cn('flex w-full items-center gap-3 rounded-card border p-4 text-left transition-colors cursor-pointer', traveler === true ? 'border-clay bg-clay-soft' : 'border-border bg-surface hover:border-ink/25')}>
          <span className="grid h-11 w-11 place-items-center rounded-[10px] bg-majorelle-soft text-majorelle"><Plane className="h-5 w-5" strokeWidth={1.6} /></span>
          <span className="font-display text-h3 font-medium">{t('onboarding.travelerYes')}</span>
        </button>
        <button onClick={() => setTraveler(false)} className={cn('flex w-full items-center gap-3 rounded-card border p-4 text-left transition-colors cursor-pointer', traveler === false ? 'border-clay bg-clay-soft' : 'border-border bg-surface hover:border-ink/25')}>
          <span className="grid h-11 w-11 place-items-center rounded-[10px] bg-clay-soft text-clay"><MapPin className="h-5 w-5" strokeWidth={1.6} /></span>
          <span className="font-display text-h3 font-medium">{t('onboarding.travelerNo')}</span>
        </button>
      </div>
    </div>,
  ];

  // `order` maps the visible step index → the real step in `steps`; business
  // signups omit step 1 (looking for) and step 3 (traveler).
  const order = isBusiness ? [0, 2] : [0, 1, 2, 3];
  const actual = order[step];
  const canNext = actual === 0 ? !!city : actual === 1 ? !!lookingFor : actual === 2 ? picked.length > 0 : actual === 3 ? traveler !== null : true;
  const isLast = step === order.length - 1;

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <div className="mx-auto flex w-full max-w-app flex-1 flex-col px-6 py-6">
        <div className="mb-8 flex gap-1.5">
          {order.map((_, i) => (
            <div key={i} className={cn('h-1 flex-1 rounded-full transition-colors duration-300', i <= step ? 'bg-clay' : 'bg-border')} />
          ))}
        </div>

        <div className="flex-1 animate-fade-in" key={step}>{steps[actual]}</div>

        {actual === 2 && picked.length === 0 && (
          <p className="mt-3 text-center text-[12px] font-medium text-clay">{t('onboarding.selectAtLeastOne')}</p>
        )}

        <div className="mt-6 flex gap-3">
          {step > 0 && <Button variant="outline" size="lg" onClick={() => setStep((s) => s - 1)}>{t('create.back')}</Button>}
          <Button size="lg" fullWidth disabled={!canNext} loading={saving} onClick={() => (isLast ? finish() : setStep((s) => s + 1))}>
            {isLast ? t('onboarding.finish') : t('onboarding.next')}
          </Button>
        </div>
      </div>
    </div>
  );
}
