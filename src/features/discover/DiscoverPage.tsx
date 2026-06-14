import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, CalendarX2, Search, SlidersHorizontal } from 'lucide-react';
import { EventCard } from '@/components/EventCard';
import { EventCardSkeletonList } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { Button } from '@/components/Button';
import { CitySelector } from '@/components/CitySelector';
import { SectionHeader } from '@/components/SectionHeader';
import { resolveIcon } from '@/components/ActivityIcon';
import { FilterSheet } from './FilterSheet';
import { useAsync } from '@/hooks/useAsync';
import { listEvents } from '@/api';
import { useSession } from '@/store/session';
import { COLLECTIONS } from '@/lib/collections';
import type { EventFilters } from '@/types';
import { cn } from '@/lib/cn';

export function DiscoverPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, city, setCity, dataVersion } = useSession();
  const [search, setSearch] = useState('');
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [filters, setFilters] = useState<EventFilters>({});
  const [filterOpen, setFilterOpen] = useState(false);

  const activeFilterCount = useMemo(
    () =>
      [filters.group, filters.vibe, filters.date && filters.date !== 'any', filters.openSpotsOnly, filters.travelersOnly].filter(
        Boolean,
      ).length,
    [filters],
  );

  const events = useAsync(
    () => listEvents({ ...filters, city, search: search || undefined }),
    [city, search, filters, dataVersion],
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
            <div className="mt-2">
              <CitySelector city={city} onChange={setCity} />
            </div>
          </div>
          <button
            onClick={() => navigate('/notifications')}
            aria-label={t('notifications.title')}
            className="relative grid h-10 w-10 place-items-center rounded-full border border-border bg-surface cursor-pointer md:hidden"
          >
            <Bell className="h-5 w-5 text-ink" strokeWidth={1.6} />
            <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-clay" />
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
