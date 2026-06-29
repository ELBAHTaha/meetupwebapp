import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Compass,
  Globe,
  Handshake,
  MapPin,
  Moon,
  ShieldCheck,
  Sparkles,
  Store,
  Sun,
  Video,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/Button';
import { AuthBackdrop } from '@/components/AuthBackdrop';
import { DevelopedBy } from '@/components/DevelopedBy';
import { SmartImage } from '@/components/SmartImage';
import { ActivityIcon, resolveIcon } from '@/components/ActivityIcon';
import { Skeleton } from '@/components/Skeleton';
import { eventImage } from '@/lib/imagery';
import { useAsync } from '@/hooks/useAsync';
import { listPreviewEvents } from '@/api';
import { CITIES, GROUP_LABELS, SEED_ACTIVITIES } from '@/api/catalog';
import { LANGUAGES, setLanguage } from '@/i18n';
import { useTheme } from '@/store/theme';
import { formatEventDate } from '@/lib/format';
import { cn } from '@/lib/cn';
import type { ActivityGroup, EnrichedEvent } from '@/types';

export function LandingPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const preview = useAsync(() => listPreviewEvents(4), []);
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggle);

  const groups: ActivityGroup[] = ['sport', 'outdoor', 'social'];

  return (
    <div className="min-h-[100dvh] bg-bg">
      {/* ---------- Hero (always dark, independent of theme) ---------- */}
      <header className="relative isolate overflow-hidden bg-[#171410]">
        <AuthBackdrop className="absolute inset-0" />
        <div className="absolute -right-32 -top-32 h-96 w-96 rounded-full bg-clay/30 blur-[120px]" aria-hidden="true" />
        <div className="absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-majorelle/25 blur-[120px]" aria-hidden="true" />
        <div className="relative mx-auto flex min-h-[88dvh] max-w-shell flex-col px-6 py-6 text-white">
          {/* Top nav */}
          <nav className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <img src="/jmaa.svg" alt="" className="h-9 w-9" />
              <span className="font-display text-h1 font-medium tracking-tight">hudlgo</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="me-1 hidden items-center gap-0.5 rounded-full bg-white/10 p-0.5 backdrop-blur-sm sm:flex">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    onClick={() => setLanguage(l.code)}
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[12px] font-medium uppercase transition-colors cursor-pointer',
                      i18n.language === l.code ? 'bg-white text-[#171410]' : 'text-white/80 hover:text-white',
                    )}
                  >
                    {l.code}
                  </button>
                ))}
              </div>
              <button
                onClick={toggleTheme}
                aria-label="Toggle dark mode"
                className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 cursor-pointer transition-colors"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" strokeWidth={1.8} /> : <Moon className="h-4 w-4" strokeWidth={1.8} />}
              </button>
              <button
                onClick={() => navigate('/login')}
                className="rounded-full px-4 py-2 text-meta font-semibold text-white/90 hover:text-white cursor-pointer"
              >
                {t('landing.login')}
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="rounded-full bg-white px-4 py-2 text-meta font-semibold text-[#171410] hover:bg-white/90 cursor-pointer transition-colors"
              >
                {t('landing.signup')}
              </button>
            </div>
          </nav>

          {/* Hero content */}
          <div className="mt-auto max-w-2xl pb-4">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-medium backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.8} /> {t('landing.heroBadge')}
            </span>
            <h1 className="mt-4 font-display text-[2.75rem] font-medium leading-[1.02] sm:text-[3.5rem]">
              {t('landing.heroTitle')}
            </h1>
            <p className="mt-4 max-w-lg text-[16px] leading-relaxed text-white/85">{t('landing.heroSubtitle')}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button size="lg" rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2} />} onClick={() => navigate('/signup')}>
                {t('landing.ctaJoin')}
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="!bg-white/10 !text-white backdrop-blur-sm hover:!bg-white/20"
                leftIcon={<Building2 className="h-4 w-4" strokeWidth={1.8} />}
                onClick={() => navigate('/business')}
              >
                {t('landing.ctaBusiness')}
              </Button>
            </div>
            <p className="mt-4 text-[13px] text-white/80">
              {t('landing.haveAccount')}{' '}
              <Link to="/login" className="font-semibold text-white underline underline-offset-2">{t('landing.login')}</Link>
            </p>

            {/* Stats */}
            <div className="mt-8 grid max-w-md grid-cols-3 gap-3 border-t border-white/15 pt-5">
              <Stat value={`${CITIES.length}+`} label={t('landing.statCities')} />
              <Stat value={`${SEED_ACTIVITIES.length}+`} label={t('landing.statActivities')} />
              <Stat value="100%" label={t('landing.statFree')} />
            </div>
          </div>
        </div>
      </header>

      {/* ---------- How it works ---------- */}
      <section className="mx-auto max-w-shell px-6 py-16">
        <SectionHead title={t('landing.howTitle')} subtitle={t('landing.howSubtitle')} />
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <Step n={1} icon={Compass} title={t('landing.how1Title')} body={t('landing.how1Body')} />
          <Step n={2} icon={Handshake} title={t('landing.how2Title')} body={t('landing.how2Body')} />
          <Step n={3} icon={Sparkles} title={t('landing.how3Title')} body={t('landing.how3Body')} />
        </div>
      </section>

      {/* ---------- Why / features ---------- */}
      <section className="bg-surface-sunk/40 py-16">
        <div className="mx-auto max-w-shell px-6">
          <SectionHead title={t('landing.whyTitle')} />
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Feature icon={Sparkles} title={t('landing.feat1Title')} body={t('landing.feat1Body')} />
            <Feature icon={ShieldCheck} title={t('landing.feat2Title')} body={t('landing.feat2Body')} />
            <Feature icon={Video} title={t('landing.feat3Title')} body={t('landing.feat3Body')} />
            <Feature icon={Globe} title={t('landing.feat4Title')} body={t('landing.feat4Body')} />
          </div>
        </div>
      </section>

      {/* ---------- Categories ---------- */}
      <section className="mx-auto max-w-shell px-6 py-16">
        <SectionHead title={t('landing.categoriesTitle')} subtitle={t('landing.categoriesSubtitle')} />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {groups.map((g) => {
            const items = SEED_ACTIVITIES.filter((a) => a.group === g).slice(0, 6);
            return (
              <div key={g} className="rounded-card border border-border bg-surface p-5">
                <p className="font-display text-h2 font-medium text-ink">{GROUP_LABELS[g]}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {items.map((a) => (
                    <span key={a.id} className="inline-flex items-center gap-1.5 rounded-full bg-surface-sunk px-2.5 py-1.5 text-[12px] font-medium text-ink-soft">
                      <ActivityIcon activity={a} size="sm" className="!h-4 !w-4" /> {a.name}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------- Live preview ---------- */}
      <section className="mx-auto max-w-shell px-6 pb-16">
        <SectionHead title={t('landing.previewTitle')} subtitle={t('landing.previewHint')} />
        <div className="mt-8">
          {preview.loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[3/2] w-full" />)}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {preview.data?.map((e) => <PreviewCard key={e.id} event={e} onClick={() => navigate('/signup')} />)}
            </div>
          )}
        </div>
      </section>

      {/* ---------- For businesses (always dark, independent of theme) ---------- */}
      <section className="bg-[#171410] py-16 text-white">
        <div className="mx-auto grid max-w-shell items-center gap-10 px-6 lg:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-medium backdrop-blur-sm">
              <Store className="h-3.5 w-3.5" strokeWidth={1.8} /> {t('landing.bizBadge')}
            </span>
            <h2 className="mt-4 font-display text-display font-medium leading-[1.05]">{t('landing.bizTitle')}</h2>
            <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-white/80">{t('landing.bizSubtitle')}</p>
            <div className="mt-6 space-y-3">
              {[t('landing.bizPoint1'), t('landing.bizPoint2'), t('landing.bizPoint3')].map((p) => (
                <p key={p} className="flex items-start gap-2.5 text-[15px] text-white/90">
                  <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-saffron" strokeWidth={1.8} /> {p}
                </p>
              ))}
            </div>
            <Button
              size="lg"
              className="mt-7"
              rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2} />}
              onClick={() => navigate('/business')}
            >
              {t('landing.bizCta')}
            </Button>
          </div>
          {/* Tier cards */}
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { name: 'Starter', price: '199 MAD', Icon: Store },
              { name: 'Bronze', price: '490 MAD', Icon: Store },
              { name: 'Silver', price: '990 MAD', Icon: BadgeCheck },
            ].map((tier) => (
              <div key={tier.name} className="rounded-card border border-white/15 bg-white/5 p-4 backdrop-blur-sm">
                <tier.Icon className="h-6 w-6 text-saffron" strokeWidth={1.6} />
                <p className="mt-3 font-display text-h2 font-medium">{tier.name}</p>
                <p className="mt-1 text-[15px] font-semibold text-white">
                  {tier.price}
                  <span className="text-[12px] font-normal text-white/60">/mo</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section className="mx-auto max-w-shell px-6 py-20 text-center">
        <h2 className="mx-auto max-w-xl font-display text-display font-medium leading-[1.05] text-ink">{t('landing.finalTitle')}</h2>
        <p className="mx-auto mt-3 max-w-md text-[16px] text-ink-soft">{t('landing.finalSubtitle')}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Button size="lg" rightIcon={<ArrowRight className="h-4 w-4" strokeWidth={2} />} onClick={() => navigate('/signup')}>
            {t('landing.ctaJoin')}
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate('/login')}>{t('landing.login')}</Button>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-shell flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <img src="/jmaa.svg" alt="" className="h-7 w-7" />
              <span className="font-display text-h2 font-medium tracking-tight text-ink">hudlgo</span>
            </div>
            <p className="mt-1.5 text-meta text-ink-soft">{t('landing.footerTagline')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-meta font-medium text-ink-soft">
            <Link to="/login" className="hover:text-ink">{t('landing.login')}</Link>
            <Link to="/signup" className="hover:text-ink">{t('landing.signup')}</Link>
            <Link to="/business" className="hover:text-ink">{t('landing.ctaBusiness')}</Link>
            <Link to="/terms" className="hover:text-ink">{t('landing.terms')}</Link>
            <Link to="/privacy" className="hover:text-ink">{t('landing.privacy')}</Link>
            <Link to="/refunds" className="hover:text-ink">{t('landing.refunds')}</Link>
          </div>
        </div>
        <div className="border-t border-border py-4">
          <p className="text-center text-[12px] text-ink-faint">
            © {new Date().getFullYear()} hudlgo · {t('landing.footerRights')}
          </p>
          <DevelopedBy className="mt-1.5" />
        </div>
      </footer>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-display text-h1 font-medium leading-none text-white">{value}</p>
      <p className="mt-1 text-[12px] leading-tight text-white/70">{label}</p>
    </div>
  );
}

function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-h1 font-medium text-ink sm:text-display sm:leading-[1.08]">{title}</h2>
      {subtitle && <p className="mt-2 text-[15px] text-ink-soft">{subtitle}</p>}
    </div>
  );
}

function Step({ n, icon: Icon, title, body }: { n: number; icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="relative rounded-card border border-border bg-surface p-6">
      <span className="absolute right-5 top-5 font-display text-display font-medium leading-none text-surface-sunk">{n}</span>
      <span className="grid h-11 w-11 place-items-center rounded-[12px] bg-clay-soft text-clay">
        <Icon className="h-6 w-6" strokeWidth={1.6} />
      </span>
      <p className="mt-4 font-display text-h2 font-medium text-ink">{title}</p>
      <p className="mt-1.5 text-meta leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

function Feature({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-majorelle-soft text-majorelle">
        <Icon className="h-5 w-5" strokeWidth={1.6} />
      </span>
      <p className="mt-3.5 font-display text-h3 font-medium text-ink">{title}</p>
      <p className="mt-1.5 text-meta leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

/** Read-only card for non-authenticated visitors — clicking prompts sign-up. */
function PreviewCard({ event, onClick }: { event: EnrichedEvent; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button onClick={onClick} className="group block overflow-hidden rounded-card border border-border bg-surface text-left">
      <SmartImage
        src={eventImage(event)}
        alt={event.title}
        icon={resolveIcon(event.activity.lucideIcon)}
        zoomOnHover
        rounded={false}
        className="aspect-[3/2] w-full"
      >
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-surface/90 px-2.5 py-1 text-[12px] font-medium text-ink backdrop-blur-sm">
          <ActivityIcon activity={event.activity} size="sm" className="!h-4 !w-4" />
          {event.activity.name}
        </span>
      </SmartImage>
      <div className="p-3.5">
        <h3 className="line-clamp-1 font-display text-h3 font-medium text-ink">{event.title}</h3>
        <p className="mt-1 flex items-center gap-1.5 text-meta text-ink-soft">
          {event.isOnline ? <Video className="h-3.5 w-3.5 text-majorelle" strokeWidth={1.6} /> : <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} />}
          {event.isOnline ? 'Online' : event.resolvedLocation.label}
        </p>
        <p className="mt-2 text-meta text-ink-faint">{formatEventDate(event.startsAt)} · {t('event.loginToJoin')}</p>
      </div>
    </button>
  );
}
