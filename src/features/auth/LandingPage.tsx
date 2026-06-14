import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin } from 'lucide-react';
import { Button } from '@/components/Button';
import { SmartImage } from '@/components/SmartImage';
import { ActivityIcon, resolveIcon } from '@/components/ActivityIcon';
import { Skeleton } from '@/components/Skeleton';
import { WELCOME_IMAGE, eventImage } from '@/lib/imagery';
import { useAsync } from '@/hooks/useAsync';
import { listPreviewEvents } from '@/api';
import { formatEventDate } from '@/lib/format';
import type { EnrichedEvent } from '@/types';

export function LandingPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const preview = useAsync(() => listPreviewEvents(4), []);

  return (
    <div className="min-h-[100dvh] bg-bg">
      {/* Hero */}
      <div className="relative bg-ink">
        <SmartImage src={WELCOME_IMAGE} alt="Rooftops of a Moroccan medina at golden hour" scrim="strong" rounded={false} className="absolute inset-0 h-full w-full" />
        <div className="relative mx-auto flex min-h-[70dvh] max-w-app flex-col px-6 py-9 text-white">
          <div className="flex items-center gap-2">
            <img src="/jmaa.svg" alt="" className="h-9 w-9" />
            <span className="font-display text-h1 font-medium tracking-tight">Jmaâ</span>
          </div>
          <div className="mt-auto">
            <span className="inline-block rounded-full bg-white/15 px-3 py-1.5 text-[12px] font-medium backdrop-blur-sm">{t('auth.badge')}</span>
            <h1 className="mt-4 font-display text-display font-medium leading-[1.05]">{t('auth.headline')}</h1>
            <p className="mt-3 max-w-sm text-[15px] leading-relaxed text-white/85">{t('auth.heroSubtitle')}</p>
            <div className="mt-7 grid grid-cols-2 gap-3">
              <Button size="lg" onClick={() => navigate('/signup')}>{t('auth.joinCta')}</Button>
              <Button size="lg" variant="ghost" className="bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm" onClick={() => navigate('/signup')}>
                {t('auth.hostCta')}
              </Button>
            </div>
            <p className="mt-4 text-center text-[13px] text-white/80">
              {t('auth.haveAccount')}{' '}
              <Link to="/login" className="font-semibold text-white underline underline-offset-2">{t('auth.login')}</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Read-only preview */}
      <div className="mx-auto max-w-app px-5 py-7 md:max-w-shell md:px-0">
        <div className="mb-1 flex items-end justify-between">
          <h2 className="font-display text-h1 font-medium">{t('auth.previewTitle')}</h2>
        </div>
        <p className="mb-4 text-meta text-ink-soft">{t('auth.previewHint')}</p>
        {preview.loading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-[3/2] w-full" />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {preview.data?.map((e) => <PreviewCard key={e.id} event={e} onClick={() => navigate('/signup')} />)}
          </div>
        )}
      </div>
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
          <MapPin className="h-3.5 w-3.5" strokeWidth={1.5} /> {event.resolvedLocation.label}
        </p>
        <p className="mt-2 text-meta text-ink-faint">{formatEventDate(event.startsAt)} · {t('event.loginToJoin')}</p>
      </div>
    </button>
  );
}
