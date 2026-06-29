import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, CalendarX2, Clock, Lock, MapPin, Star, Ticket, Users, Video } from 'lucide-react';
import { SmartImage } from '@/components/SmartImage';
import { ActivityIcon, resolveIcon } from '@/components/ActivityIcon';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { useAsync } from '@/hooks/useAsync';
import { getEvent } from '@/api';
import { useSession } from '@/store/session';
import { eventImage } from '@/lib/imagery';
import { formatDayLong, formatPrice, formatTimeRange } from '@/lib/format';

// Public, read-only activity preview reached from a shared link (`/a/:id`).
// Logged-out visitors see the safe (general-area) details and a sign-up CTA;
// signed-in members are sent straight to the full interactive page.
export function PublicActivityPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAuthed, onboarded } = useSession();

  if (isAuthed && onboarded) return <Navigate to={`/event/${id}`} replace />;

  const { data: event, loading } = useAsync(() => getEvent(id), [id]);

  return (
    <div className="min-h-[100dvh] bg-bg pb-28">
      <header className="flex items-center justify-between px-5 py-4">
        <Link to="/" className="flex items-center gap-2">
          <img src="/jmaa.svg" alt="" className="h-8 w-8" />
          <span className="font-display text-h2 font-medium tracking-tight text-ink">hudlgo</span>
        </Link>
        <Link to="/login" className="text-meta font-semibold text-clay hover:text-clay-press transition-colors">
          {t('landing.login')}
        </Link>
      </header>

      {loading ? (
        <div className="mx-auto max-w-2xl space-y-4 px-5">
          <Skeleton className="aspect-[3/2] w-full rounded-card" />
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !event ? (
        <EmptyState icon={CalendarX2} title={t('common.notFound')} hint={t('common.notFoundHint')} />
      ) : (
        <div className="mx-auto max-w-2xl px-5">
          <SmartImage
            src={eventImage(event)}
            alt={event.title}
            icon={resolveIcon(event.activity.lucideIcon)}
            rounded={false}
            className="aspect-[3/2] w-full rounded-card border border-border"
          />

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[12px] font-medium text-ink">
              <ActivityIcon activity={event.activity} size="sm" className="!h-4 !w-4" /> {event.activity.name}
            </span>
          </div>
          <h1 className="mt-3 font-display text-h1 font-medium leading-tight text-ink">{event.title}</h1>

          <div className="mt-4 divide-y divide-border rounded-card border border-border bg-surface">
            <Row icon={CalendarDays} label={formatDayLong(event.startsAt)} sub={formatTimeRange(event.startsAt, event.durationMins)} />
            <Row
              icon={event.isOnline ? Video : MapPin}
              label={event.isOnline ? t('event.online') : event.generalArea ?? event.resolvedLocation.label}
              sub={event.isOnline ? '' : t('event.approxArea')}
            />
            <Row icon={Users} label={t('event.going', { count: event.goingCount, capacity: event.capacity })} />
            <Row icon={Ticket} label={formatPrice(event.price)} sub={event.price === 0 ? t('event.free') : 'per person'} />
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-card border border-border bg-surface p-4">
            <Avatar src={event.host.avatar} name={event.host.name} size="md" verified={event.host.verified} />
            <div className="flex-1">
              <p className="text-[12px] text-ink-faint">{t('event.hostedBy')}</p>
              <p className="font-display text-h3 font-medium text-ink">{event.host.name}</p>
              <p className="flex items-center gap-1 text-[12px] text-ink-soft">
                <Star className="h-3 w-3 fill-saffron text-saffron" /> {event.host.rating} · {event.host.reviewCount} {t('event.reviewsWord')}
              </p>
            </div>
          </div>

          {event.description && (
            <section className="mt-5">
              <h2 className="mb-1.5 font-display text-h3 font-medium text-ink">{t('event.about')}</h2>
              <p className="text-base leading-relaxed text-ink-soft">{event.description}</p>
            </section>
          )}

          <p className="mt-5 flex items-center gap-1.5 text-[12px] text-ink-faint">
            <Lock className="h-3.5 w-3.5" strokeWidth={1.6} /> {t('event.approxArea')}
          </p>
        </div>
      )}

      {event && (
        <div
          className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-2xl border-t border-border bg-bg/95 px-5 py-3 backdrop-blur-md"
          style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}
        >
          <Button size="lg" fullWidth onClick={() => navigate('/signup')}>
            {t('share.joinCta')}
          </Button>
          <p className="mt-1.5 text-center text-[12px] text-ink-faint">{t('share.joinHint')}</p>
        </div>
      )}
    </div>
  );
}

function Row({ icon: Icon, label, sub }: { icon: typeof Clock; label: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="h-[18px] w-[18px] shrink-0 text-ink-faint" strokeWidth={1.5} />
      <span className="text-[15px] font-medium text-ink">{label}</span>
      {sub && <span className="ml-auto text-meta text-ink-soft">{sub}</span>}
    </div>
  );
}
