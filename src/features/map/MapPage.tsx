import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { List, Map as MapIcon, X } from 'lucide-react';
import { MapView, type MapMarker } from '@/components/MapView';
import { CitySelector } from '@/components/CitySelector';
import { EventCard } from '@/components/EventCard';
import { ActivityIcon } from '@/components/ActivityIcon';
import { Avatar } from '@/components/Avatar';
import { EventStatusBadge } from '@/components/EventStatusBadge';
import { EventCardSkeletonList } from '@/components/Skeleton';
import { useAsync } from '@/hooks/useAsync';
import { listEvents } from '@/api';
import { CITIES } from '@/api/catalog';
import { useSession } from '@/store/session';
import { activityColor } from '@/lib/activityColors';
import { formatEventDate } from '@/lib/format';
import type { EnrichedEvent } from '@/types';
import { cn } from '@/lib/cn';

export function MapPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { city, setCity, dataVersion } = useSession();
  const [view, setView] = useState<'map' | 'list'>('map');
  const [selected, setSelected] = useState<EnrichedEvent | null>(null);

  const center = CITIES.find((c) => c.name === city) ?? CITIES[0];
  const events = useAsync(() => listEvents({ city }), [city, dataVersion]);

  const markers: MapMarker[] =
    events.data?.map((e) => ({
      id: e.id,
      lat: e.resolvedLocation.lat,
      lng: e.resolvedLocation.lng,
      colorHex: activityColor(e.activity.colorToken).hex,
      active: selected?.id === e.id,
      onClick: () => setSelected(e),
    })) ?? [];

  return (
    <div className="relative">
      <div className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border bg-bg/90 px-5 py-3 backdrop-blur-md md:static md:border-0 md:px-0">
        <CitySelector city={city} onChange={(c) => { setCity(c); setSelected(null); }} />
        <div className="flex rounded-full border border-border bg-surface p-1">
          <button onClick={() => setView('map')} className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-meta font-medium transition-colors cursor-pointer', view === 'map' ? 'bg-ink text-bg' : 'text-ink-soft')}>
            <MapIcon className="h-4 w-4" strokeWidth={1.6} /> {t('common.map')}
          </button>
          <button onClick={() => setView('list')} className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-meta font-medium transition-colors cursor-pointer', view === 'list' ? 'bg-ink text-bg' : 'text-ink-soft')}>
            <List className="h-4 w-4" strokeWidth={1.6} /> {t('common.list')}
          </button>
        </div>
      </div>

      {view === 'map' ? (
        <div className="relative">
          <MapView center={center} zoom={12} markers={markers} className="h-[calc(100vh-9.5rem)] md:h-[calc(100vh-12rem)] md:rounded-card md:border md:border-border" />
          {selected && (
            <div className="absolute inset-x-3 bottom-4 z-[500] animate-fade-in md:inset-x-auto md:left-4 md:max-w-sm">
              <div className="relative overflow-hidden rounded-card border border-border bg-surface shadow-e1">
                <button onClick={() => setSelected(null)} aria-label={t('common.close')} className="absolute right-2.5 top-2.5 z-10 grid h-8 w-8 place-items-center rounded-full bg-surface/90 backdrop-blur cursor-pointer">
                  <X className="h-4 w-4" strokeWidth={1.6} />
                </button>
                <button onClick={() => navigate(`/event/${selected.id}`)} className="flex w-full gap-3 p-3 text-left cursor-pointer">
                  <ActivityIcon activity={selected.activity} size="lg" tile />
                  <div className="min-w-0 flex-1 pr-6">
                    <p className={`text-[12px] font-medium ${activityColor(selected.activity.colorToken).text}`}>{selected.activity.name}</p>
                    <h3 className="truncate font-display text-h3 font-medium text-ink">{selected.title}</h3>
                    <p className="truncate text-meta text-ink-soft">{selected.resolvedLocation.label}</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <Avatar src={selected.host.avatar} name={selected.host.name} size="xs" />
                      <span className="text-[12px] text-ink-soft">{formatEventDate(selected.startsAt)}</span>
                      <EventStatusBadge event={selected} />
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="px-5 pt-2 md:px-0">
          {events.loading ? <EventCardSkeletonList /> : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {events.data?.map((e) => <EventCard key={e.id} event={e} fromCity={city} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
