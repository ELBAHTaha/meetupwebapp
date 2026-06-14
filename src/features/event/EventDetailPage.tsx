import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  CalendarDays,
  CalendarX2,
  ChevronLeft,
  Clock,
  Flag,
  Hand,
  MapPin,
  MessageCircle,
  Share2,
  Star,
  Ticket,
  Users,
  UserCheck,
} from 'lucide-react';
import { Button } from '@/components/Button';
import { Avatar } from '@/components/Avatar';
import { ActivityIcon } from '@/components/ActivityIcon';
import { Tag } from '@/components/Chip';
import { VibeTag } from '@/components/VibeTag';
import { EventStatusBadge, neededToConfirm } from '@/components/EventStatusBadge';
import { SpotsBar } from '@/components/SpotsBar';
import { ConditionsWidget } from '@/components/ConditionsWidget';
import { MapView } from '@/components/MapView';
import { Skeleton } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { Sheet } from '@/components/Sheet';
import { Textarea } from '@/components/Field';
import { ReportSheet } from '@/components/ReportSheet';
import { RatingSheet } from '@/components/RatingSheet';
import { useAsync } from '@/hooks/useAsync';
import { canStart, getConditions, getEvent, joinEvent, leaveEvent, startActivity } from '@/api';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { activityColor } from '@/lib/activityColors';
import { formatDayLong, formatEventDate, formatPrice, formatTimeRange } from '@/lib/format';
import { db } from '@/api/store';

const GENDER_LABEL: Record<string, string> = { women: 'event.genderWomen', men: 'event.genderMen' };

export function EventDetailPage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, bumpData, dataVersion } = useSession();
  const [acting, setActing] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [spotNote, setSpotNote] = useState('');

  const { data: event, loading, reload } = useAsync(() => getEvent(id), [id, dataVersion]);
  const showConditions = !!event?.activity.outdoor && !!event?.spotId;
  const conditions = useAsync(
    () => (showConditions ? getConditions(event!.spotId!) : Promise.resolve(null)),
    [event?.spotId, showConditions],
  );

  if (loading) {
    return (
      <div>
        <div className="space-y-4 px-5 pt-5">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!event) {
    return <EmptyState icon={CalendarX2} title={t('common.notFound')} hint={t('common.notFoundHint')} />;
  }

  const color = activityColor(event.activity.colorToken);
  const status = event.viewerStatus;
  const goingAttendees = event.attendees.filter((a) => a.status === 'going' || a.status === 'host');
  const waitlist = event.attendees.filter((a) => a.status === 'waitlisted');
  const isFull = event.openSpots <= 0;

  async function handleJoin() {
    if (!user) return;
    setActing(true);
    try {
      const updated = await joinEvent(event!.id, user.id);
      bumpData();
      reload();
      if (updated.viewerStatus === 'waitlisted') {
        toast(t('event.waitlistPosition', { pos: waitlistPosFor(user.id, updated.id) }), 'info');
      } else {
        toast(
          t('event.joinConfirm', { place: updated.resolvedLocation.label, when: formatEventDate(updated.startsAt) }),
          'success',
        );
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not join', 'error');
    } finally {
      setActing(false);
    }
  }

  async function handleLeave() {
    if (!user) return;
    setActing(true);
    await leaveEvent(event!.id, user.id);
    bumpData();
    reload();
    setActing(false);
    toast('You left the event', 'info');
  }

  async function confirmStart() {
    setActing(true);
    try {
      await startActivity(event!.id, spotNote || 'I’ll wave when I see you');
      bumpData();
      reload();
      setStartOpen(false);
      toast('Attendees notified you’ve arrived 👋', 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not start', 'error');
    } finally {
      setActing(false);
    }
  }

  function handleShare() {
    const url = window.location.href;
    if (navigator.share) navigator.share({ title: event!.title, url }).catch(() => {});
    else {
      navigator.clipboard?.writeText(url);
      toast('Link copied to clipboard', 'success');
    }
  }

  return (
    <div className="pb-28 md:pb-10">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-4">
        <button onClick={() => navigate(-1)} aria-label="Back" className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface text-ink hover:bg-surface-sunk cursor-pointer transition-colors">
          <ChevronLeft className="h-5 w-5" strokeWidth={1.6} />
        </button>
        <button onClick={handleShare} aria-label={t('event.share')} className="grid h-10 w-10 place-items-center rounded-full border border-border bg-surface text-ink hover:bg-surface-sunk cursor-pointer transition-colors">
          <Share2 className="h-[18px] w-[18px]" strokeWidth={1.6} />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 px-5 md:px-0 md:mx-auto md:max-w-2xl">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[12px] font-medium text-ink">
          <ActivityIcon activity={event.activity} size="sm" className="!h-4 !w-4" />
          {event.activity.name}
        </span>
        <VibeTag vibe={event.activity.vibe} />
        <EventStatusBadge event={event} />
      </div>

      <div className="space-y-7 px-5 pt-4 md:px-0 md:mx-auto md:max-w-2xl">
        <div>
          <h1 className="font-display text-h1 font-medium leading-tight text-ink">{event.title}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {event.travelersWelcome && <Tag className="bg-majorelle-soft text-majorelle">{t('event.travelersWelcome')}</Tag>}
            {event.genderPreference && event.genderPreference !== 'any' && (
              <Tag className="bg-clay-soft text-clay" leftIcon={<UserCheck className="h-3.5 w-3.5" strokeWidth={1.6} />}>
                {t(GENDER_LABEL[event.genderPreference])}
              </Tag>
            )}
          </div>
        </div>

        {/* Host has arrived */}
        {event.startedAt && event.hostSpotNote && status !== 'not_joined' && (
          <div className="flex items-start gap-3 rounded-card border border-olive/30 bg-olive-soft px-4 py-3">
            <Hand className="mt-0.5 h-5 w-5 shrink-0 text-olive" strokeWidth={1.7} />
            <div>
              <p className="font-display text-h3 font-medium text-ink">{t('event.spotNoteTitle')}</p>
              <p className="text-meta text-ink-soft">{t('start.spotNote', { name: event.host.name, note: event.hostSpotNote })}</p>
            </div>
          </div>
        )}

        {/* Completed → rate */}
        {event.status === 'PAST' && (
          <div className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface px-4 py-3">
            <div>
              <p className="font-display text-h3 font-medium text-ink">{t('event.completed')}</p>
              <p className="text-meta text-ink-soft">{t('event.ratePeople')}</p>
            </div>
            <Button size="sm" leftIcon={<Star className="h-4 w-4" strokeWidth={1.6} />} onClick={() => setRateOpen(true)}>
              {t('rate.rateButton')}
            </Button>
          </div>
        )}

        {/* Meta list */}
        <div className="divide-y divide-border rounded-card border border-border bg-surface">
          <MetaRow icon={CalendarDays} label={formatDayLong(event.startsAt)} sub={formatTimeRange(event.startsAt, event.durationMins)} />
          <MetaRow icon={Clock} label={t('event.duration', { mins: event.durationMins })} />
          <MetaRow icon={Ticket} label={formatPrice(event.price)} sub={event.price === 0 ? t('event.free') : 'per person'} />
          <MetaRow icon={Users} label={`${event.capacity} ${t('event.capacityWord')}`} sub={event.minPlayers > 1 ? t('event.minPlayers', { count: event.minPlayers }) : ''} />
        </div>

        {/* Conditions (outdoor only) */}
        {showConditions && (
          <section>
            <h2 className="mb-2.5 text-meta font-semibold uppercase tracking-wide text-ink-faint">{t('event.conditions')}</h2>
            <ConditionsWidget conditions={conditions.data} loading={conditions.loading} />
          </section>
        )}

        {/* Confirmation progress */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[15px] font-medium text-ink">
              {t('event.going', { count: event.goingCount, capacity: event.capacity })}
            </span>
            {event.status === 'PENDING' && event.minPlayers > 1 && (
              <span className="text-meta font-semibold text-saffron">{t('event.needsMore', { count: neededToConfirm(event) })}</span>
            )}
          </div>
          <SpotsBar going={event.goingCount} capacity={event.capacity} minPlayers={event.minPlayers} colorHex={color.hex} />
        </section>

        {/* Host */}
        <button onClick={() => navigate(`/user/${event.host.id}`)} className="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-4 text-left cursor-pointer hover:border-ink/20 transition-colors">
          <Avatar src={event.host.avatar} name={event.host.name} size="md" verified={event.host.verified} />
          <div className="flex-1">
            <p className="text-[12px] text-ink-faint">{t('event.hostedBy')}</p>
            <p className="font-display text-h3 font-medium text-ink">{event.host.name}</p>
            <p className="flex items-center gap-1 text-[12px] text-ink-soft">
              <Star className="h-3 w-3 fill-saffron text-saffron" /> {event.host.rating} · {event.host.reviewCount} {t('event.reviewsWord')}
            </p>
          </div>
          <span className="text-meta font-medium text-clay">{t('event.viewProfile')}</span>
        </button>

        {/* About */}
        <section>
          <h2 className="mb-2 font-display text-h2 font-medium text-ink">{t('event.about')}</h2>
          <p className="text-base leading-relaxed text-ink-soft">{event.description}</p>
        </section>

        {/* Who's going */}
        <section>
          <h2 className="mb-3 font-display text-h2 font-medium text-ink">{t('event.whosGoing')} · {goingAttendees.length}</h2>
          <div className="flex flex-wrap gap-3">
            {goingAttendees.map((a) => {
              const u = db.users.find((x) => x.id === a.userId);
              if (!u) return null;
              return (
                <button key={a.userId} onClick={() => navigate(`/user/${u.id}`)} className="flex w-16 flex-col items-center gap-1.5 cursor-pointer">
                  <Avatar src={u.avatar} name={u.name} size="md" verified={u.verified} />
                  <span className="w-full truncate text-center text-[12px] text-ink-soft">
                    {a.status === 'host' ? t('event.host') : u.name.split(' ')[0]}
                  </span>
                </button>
              );
            })}
          </div>
          {waitlist.length > 0 && (
            <div className="mt-4 rounded-card border border-border bg-surface-sunk/60 p-3">
              <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-faint">{t('event.waitlist')} · {waitlist.length}</p>
              <div className="mt-2 flex -space-x-2">
                {waitlist.map((a) => {
                  const u = db.users.find((x) => x.id === a.userId);
                  return u ? <Avatar key={a.userId} src={u.avatar} name={u.name} size="sm" ring /> : null;
                })}
              </div>
            </div>
          )}
        </section>

        {/* Location */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="font-display text-h2 font-medium text-ink">{t('event.location')}</h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-sunk px-2 py-0.5 text-[11px] font-medium text-ink-soft">
              <MapPin className="h-3 w-3" strokeWidth={1.6} /> {t('event.meetingPoint')}
            </span>
          </div>
          <MapView
            center={event.resolvedLocation}
            zoom={14}
            interactive={false}
            markers={[{ id: event.id, lat: event.resolvedLocation.lat, lng: event.resolvedLocation.lng, colorHex: color.hex }]}
            className="h-48 rounded-card border border-border"
          />
          <p className="mt-2 flex items-center gap-1.5 text-meta text-ink-soft">
            <MapPin className="h-4 w-4 text-clay" strokeWidth={1.6} />
            {event.resolvedLocation.label}
          </p>
        </section>

        {/* Secondary actions */}
        <div className="flex gap-3">
          {(status === 'joined' || status === 'host' || status === 'waitlisted') && (
            <Button variant="outline" fullWidth leftIcon={<MessageCircle className="h-4 w-4" strokeWidth={1.6} />} onClick={() => navigate(`/chat/${event.id}`)}>
              {t('event.openChat')}
            </Button>
          )}
          <Button variant="danger" leftIcon={<Flag className="h-4 w-4" strokeWidth={1.6} />} onClick={() => setReportOpen(true)}>
            {t('event.report')}
          </Button>
        </div>
      </div>

      {/* Sticky RSVP bar */}
      {event.status !== 'PAST' && (
        <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-app border-t border-border bg-bg/95 px-5 py-3 backdrop-blur-md md:max-w-shell" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}>
          <div className="md:mx-auto md:max-w-md">
            {status === 'host' && canStart(event) && (
              <Button size="lg" fullWidth leftIcon={<Hand className="h-4 w-4" strokeWidth={1.6} />} onClick={() => setStartOpen(true)}>
                {t('start.button')}
              </Button>
            )}
            {status === 'host' && !canStart(event) && (
              <Button size="lg" fullWidth disabled variant="outline">
                {event.startedAt ? t('event.spotNoteTitle') : t('event.youHost')}
              </Button>
            )}
            {status === 'joined' && <Button size="lg" fullWidth variant="danger" loading={acting} onClick={handleLeave}>{t('event.leave')}</Button>}
            {status === 'waitlisted' && (
              <Button size="lg" fullWidth variant="danger" loading={acting} onClick={handleLeave}>
                {t('event.waitlistPosition', { pos: waitlist.find((a) => a.userId === user?.id)?.waitPosition ?? 1 })} · {t('event.leave')}
              </Button>
            )}
            {status === 'not_joined' && (
              <Button size="lg" fullWidth loading={acting} onClick={handleJoin}>
                {isFull ? t('event.joinWaitlist') : t('event.join')}
              </Button>
            )}
          </div>
        </div>
      )}

      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} targetType="activity" targetId={event.id} chatThreadId={event.id} />
      <RatingSheet eventId={event.id} open={rateOpen} onClose={() => setRateOpen(false)} onDone={() => bumpData()} />

      {/* Start activity — host spot note */}
      <Sheet open={startOpen} onClose={() => setStartOpen(false)} title={t('start.title')}>
        <div className="space-y-4">
          <Textarea label={t('start.noteLabel')} placeholder={t('start.notePlaceholder')} value={spotNote} onChange={(e) => setSpotNote(e.target.value)} />
          <Button size="lg" fullWidth loading={acting} onClick={confirmStart}>{t('start.confirm')}</Button>
        </div>
      </Sheet>
    </div>
  );
}

function MetaRow({ icon: Icon, label, sub }: { icon: typeof Clock; label: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <Icon className="h-[18px] w-[18px] shrink-0 text-ink-faint" strokeWidth={1.5} />
      <span className="text-[15px] font-medium text-ink">{label}</span>
      {sub && <span className="ml-auto text-meta text-ink-soft">{sub}</span>}
    </div>
  );
}

function waitlistPosFor(userId: string, eventId: string): number {
  const e = db.events.find((x) => x.id === eventId);
  return e?.attendees.find((a) => a.userId === userId)?.waitPosition ?? 1;
}
