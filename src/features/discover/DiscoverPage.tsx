import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, CalendarX2, Loader2, LocateFixed, Search, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { EventCard } from '@/components/EventCard';
import { EventCardSkeletonList } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/Button';
import { CitySelector } from '@/components/CitySelector';
import { SectionHeader } from '@/components/SectionHeader';
import { resolveIcon } from '@/components/ActivityIcon';
import { FilterSheet } from './FilterSheet';
import { useAsync } from '@/hooks/useAsync';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { listEvents } from '@/api';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { COLLECTIONS } from '@/lib/collections';
import type { EventFilters } from '@/types';
import { cn } from '@/lib/cn';

export function DiscoverPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, city, setCity, dataVersion } = useSession();
  const unread = useUnreadNotifications();
  const [search, setSearch] = useState('');
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [filters, setFilters] = useState<EventFilters>({});
  const [filterOpen, setFilterOpen] = useState(false);
  // "Near me": sort by distance from the device location, ignoring the chosen city.
  const [nearMe, setNearMe] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  function toggleNearMe() {
    if (nearMe) return setNearMe(false);
    if (coords) return setNearMe(true);
    if (!('geolocation' in navigator)) return toast(t('discover.nearMeUnsupported'), 'error');
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setNearMe(true);
        setLocating(false);
      },
      () => {
        toast(t('discover.nearMeDenied'), 'error');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }
  const [verifyDismissed, setVerifyDismissed] = useState(() => localStorage.getItem('jmaa-verify-dismissed') === '1');

  const showVerify =
    !!user && !user.verified && (user.verificationStatus ?? 'none') !== 'pending' && !verifyDismissed;
  function dismissVerify() {
    setVerifyDismissed(true);
    localStorage.setItem('jmaa-verify-dismissed', '1');
  }

  const activeFilterCount = useMemo(
    () =>
      [filters.group, filters.vibe, filters.date && filters.date !== 'any', filters.openSpotsOnly, filters.travelersOnly].filter(
        Boolean,
      ).length,
    [filters],
  );

  const events = useAsync(
    () =>
      listEvents(
        nearMe && coords
          ? { ...filters, search: search || undefined, lat: coords.lat, lng: coords.lng, sort: 'distance' }
          : { ...filters, city, search: search || undefined },
      ),
    [city, search, filters, dataVersion, nearMe, coords],
  );

  // Apply the selected intent collection + personalize ordering by lookingFor.
  const list = useMemo(() => {
    let items = events.data ?? [];
    const col = COLLECTIONS.find((c) => c.id === collectionId);
    if (col) items = items.filter(col.predicate);
    const lf = user?.lookingFor;
    if (lf === 'friends') {
      items = [...items].sort((a, b) => Number(b.activity.group === 'social') - Number(a.activity.group === 'social'));
    } else if (lf === 'partners') {
      items = [...items].sort((a, b) => Number(b.activity.vibe === 'active') - Number(a.activity.vibe === 'active'));
    }
    return items;
  }, [events.data, collectionId, user?.lookingFor]);

  const subtitle =
    user?.lookingFor === 'friends'
      ? t('discover.subFriends', { city })
      : user?.lookingFor === 'partners'
        ? t('discover.subPartners', { city })
        : t('discover.subBoth', { city });

  return (
    <div className="pb-4">
      {/* Header */}
      <div className="px-5 pb-1 pt-5 md:px-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-display text-h1 font-medium text-ink">{t('discover.greeting', { name: user?.name ?? '' })}</p>
            <p className="mt-0.5 text-meta text-ink-soft">{subtitle}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <CitySelector city={city} onChange={(c) => { setCity(c); setNearMe(false); }} />
              <button
                onClick={toggleNearMe}
                disabled={locating}
                aria-pressed={nearMe}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-meta font-medium transition-colors cursor-pointer disabled:opacity-60',
                  nearMe ? 'border-clay bg-clay-soft text-clay' : 'border-border bg-surface text-ink-soft hover:border-ink/25',
                )}
              >
                {locating ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} /> : <LocateFixed className="h-4 w-4" strokeWidth={1.8} />}
                {t('discover.nearMe')}
              </button>
            </div>
          </div>
          <button
            onClick={() => navigate('/notifications')}
            aria-label={t('notifications.title')}
            className="relative grid h-10 w-10 place-items-center rounded-full border border-border bg-surface cursor-pointer md:hidden"
          >
            <Bell className="h-5 w-5 text-ink" strokeWidth={1.6} />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 grid min-h-[16px] min-w-[16px] place-items-center rounded-full bg-clay px-1 text-[10px] font-semibold leading-none text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
        </div>

        {/* Search + filter */}
        <div className="mt-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-faint" strokeWidth={1.6} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('discover.searchPlaceholder')}
              className="w-full rounded-input border border-border bg-surface py-3 pl-11 pr-4 text-[15px] placeholder:text-ink-faint focus:border-clay"
            />
          </div>
          <button
            onClick={() => setFilterOpen(true)}
            aria-label={t('filters.title')}
            className="relative grid h-12 w-12 shrink-0 place-items-center rounded-input border border-border bg-surface cursor-pointer hover:border-ink/25"
          >
            <SlidersHorizontal className="h-5 w-5 text-ink" strokeWidth={1.6} />
            {activeFilterCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-clay text-[10px] font-semibold text-white">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Verify-your-identity prompt (unverified users only) */}
      {showVerify && (
        <div className="px-5 pt-3 md:px-0">
          <div className="relative flex items-center gap-3 overflow-hidden rounded-card border border-majorelle/30 bg-majorelle-soft p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-majorelle text-white">
              <ShieldCheck className="h-5 w-5" strokeWidth={1.7} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-h3 font-medium text-ink">{t('discover.verifyTitle')}</p>
              <p className="text-[12px] text-ink-soft">{t('discover.verifyBody')}</p>
            </div>
            <Button size="sm" onClick={() => navigate('/verify')}>{t('discover.verifyCta')}</Button>
            <button
              onClick={dismissVerify}
              aria-label="Dismiss"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-surface/60 cursor-pointer"
            >
              <X className="h-4 w-4" strokeWidth={1.8} />
            </button>
          </div>
        </div>
      )}

      {/* Intent collections rail */}
      <div className="no-scrollbar flex gap-2.5 overflow-x-auto px-5 py-4 md:px-0">
        {COLLECTIONS.map((c) => {
          const Icon = resolveIcon(c.icon);
          const on = collectionId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => setCollectionId(on ? null : c.id)}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-meta font-medium transition-colors cursor-pointer',
                on ? 'border-ink bg-ink text-bg' : 'border-border bg-surface text-ink-soft hover:border-ink/25',
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.6} />
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Feed */}
      <div className="px-5 md:px-0">
        <SectionHeader title={collectionId ? COLLECTIONS.find((c) => c.id === collectionId)!.label : t('discover.upcoming')} motif />
        {events.loading ? (
          <EventCardSkeletonList />
        ) : list.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {list.map((e) => (
              <EventCard key={e.id} event={e} fromCity={city} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={CalendarX2}
            title={t('discover.noResults')}
            hint={t('discover.noResultsHint')}
            action={<Button onClick={() => navigate('/create')}>{t('discover.createOwn')}</Button>}
          />
        )}
      </div>

      <FilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} filters={filters} onChange={setFilters} onReset={() => setFilters({})} />
    </div>
  );
}
