import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Lock, MapPin, Plane, Star } from 'lucide-react';
import type { EnrichedEvent } from '@/types';
import { cn } from '@/lib/cn';
import { ActivityIcon } from './ActivityIcon';
import { Avatar } from './Avatar';
import { EventStatusBadge } from './EventStatusBadge';
import { SpotsBar } from './SpotsBar';
import { VibeTag } from './VibeTag';
import { SmartImage } from './SmartImage';
import { activityColor } from '@/lib/activityColors';
import { eventImage } from '@/lib/imagery';
import { resolveIcon } from './ActivityIcon';
import { formatEventDate, formatDistance, distanceKm } from '@/lib/format';
import { CITIES } from '@/api/catalog';
import { useSession } from '@/store/session';

interface Props {
  event: EnrichedEvent;
  fromCity?: string;
}

export function EventCard({ event, fromCity }: Props) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const color = activityColor(event.activity.colorToken);
  const currentUserId = useSession((s) => s.user?.id);
  const isOwn = currentUserId === event.hostId;

  const cityCenter = CITIES.find((c) => c.name === (fromCity ?? event.host.city));
  const dist =
    cityCenter && distanceKm(cityCenter, event.resolvedLocation) < 200
      ? distanceKm(cityCenter, event.resolvedLocation)
      : null;

  return (
    <article
      onClick={() => navigate(`/event/${event.id}`)}
      className="group cursor-pointer overflow-hidden rounded-card border border-border bg-surface transition-colors duration-200 hover:border-ink/20 animate-fade-in"
    >
      <SmartImage
        src={eventImage(event)}
        alt={`${event.activity.name} — ${event.title}`}
        icon={resolveIcon(event.activity.lucideIcon)}
        zoomOnHover
        rounded={false}
        className="aspect-[3/2] w-full"
      >
        <div className="absolute inset-x-3 top-3 flex items-start justify-between">
          <div className="flex flex-col items-start gap-1.5">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-surface/90 px-2.5 py-1 text-[12px] font-medium text-ink backdrop-blur-sm">
              <ActivityIcon activity={event.activity} size="sm" className="!h-4 !w-4" />
              {event.activity.name}
            </span>
            {event.sponsoredVenue && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm backdrop-blur-sm',
                  event.sponsoredVenue.tier === 'gold'
                    ? 'bg-saffron'
                    : event.sponsoredVenue.tier === 'silver'
                      ? 'bg-majorelle'
                      : 'bg-clay',
                )}
                title={`Sponsored venue · ${event.sponsoredVenue.name}`}
              >
                <BadgeCheck className="h-3 w-3" strokeWidth={2} aria-hidden="true" />
                Sponsored venue
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {!event.approvedAt && (
              <span className="inline-flex items-center gap-1 rounded-full bg-saffron px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                {t('event.pendingTag')}
              </span>
            )}
            {isOwn && (
              <span className="inline-flex items-center gap-1 rounded-full bg-clay px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
                <Star className="h-3 w-3 fill-white" strokeWidth={0} aria-hidden="true" />
                Your event
              </span>
            )}
            {event.travelersWelcome && (
              <span className="grid h-7 w-7 place-items-center rounded-full bg-surface/90 backdrop-blur-sm" title={t('event.travelersWelcome')}>
                <Plane className="h-3.5 w-3.5 text-majorelle" strokeWidth={1.6} />
              </span>
            )}
          </div>
        </div>
      </SmartImage>

      <div className="p-3.5">
        <h3 className="line-clamp-2 font-display text-h3 font-medium leading-snug text-ink">{event.title}</h3>
        <div className="mt-1.5 flex items-center gap-1.5 text-meta text-ink-soft">
          {event.locationHidden ? (
            <Lock className="h-3.5 w-3.5 shrink-0 text-ink-faint" strokeWidth={1.6} />
          ) : (
            <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
          )}
          <span className="truncate">{event.resolvedLocation.label}</span>
          {dist !== null && <span className="shrink-0 text-ink-faint">· {formatDistance(dist)}</span>}
        </div>

        <div className="mt-2 flex items-center gap-2 text-meta text-ink-soft">
          <span>{formatEventDate(event.startsAt)}</span>
          <span className="text-ink-faint">·</span>
          <VibeTag vibe={event.activity.vibe} />
        </div>

        <div className="mt-3 border-t border-border pt-3">
          <SpotsBar going={event.goingCount} capacity={event.capacity} minPlayers={event.minPlayers} colorHex={color.hex} />
          <div className="mt-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Avatar src={event.host.avatar} name={event.host.name} size="xs" verified={event.host.verified} />
              <span className="text-meta font-medium text-ink-soft">
                {isOwn ? (
                  <span className="text-clay">You're hosting</span>
                ) : (
                  t('event.going', { count: event.goingCount, capacity: event.capacity })
                )}
              </span>
            </div>
            <EventStatusBadge event={event} />
          </div>
        </div>
      </div>
    </article>
  );
}
