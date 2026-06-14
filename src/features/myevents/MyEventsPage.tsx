import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, CalendarClock, CalendarRange } from 'lucide-react';
import { SectionHeader } from '@/components/SectionHeader';
import { EventCard } from '@/components/EventCard';
import { EmptyState } from '@/components/EmptyState';
import { EventCardSkeletonList } from '@/components/Skeleton';
import { useAsync } from '@/hooks/useAsync';
import { getEventsForUser } from '@/api';
import { useSession } from '@/store/session';
import { cn } from '@/lib/cn';

type Tab = 'going' | 'hosting' | 'past';

const tabs: { key: Tab; icon: typeof CalendarClock }[] = [
  { key: 'going', icon: CalendarClock },
  { key: 'hosting', icon: CalendarCheck },
  { key: 'past', icon: CalendarRange },
];

export function MyEventsPage() {
  const { t } = useTranslation();
  const user = useSession((s) => s.user);
  const dataVersion = useSession((s) => s.dataVersion);
  const [tab, setTab] = useState<Tab>('going');

  const events = useAsync(() => getEventsForUser(user!.id), [user?.id, dataVersion]);
  const list = events.data?.[tab] ?? [];

  return (
    <div className="mx-auto max-w-shell px-5 pb-24 pt-6 md:px-6">
      <SectionHeader
        title={t('myEvents.title')}
        subtitle={t('myEvents.subtitle')}
        motif
      />

      {/* Tabs */}
      <div className="flex gap-1 rounded-full border border-border bg-surface p-1 mb-6">
        {tabs.map(({ key, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-full py-2 text-meta font-medium transition-colors cursor-pointer',
              tab === key ? 'bg-ink text-bg' : 'text-ink-soft hover:text-ink',
            )}
          >
            <Icon className="h-4 w-4" strokeWidth={1.6} />
            {t(`myEvents.${key}`)}
          </button>
        ))}
      </div>

      {/* Event list */}
      {events.loading ? (
        <EventCardSkeletonList count={3} />
      ) : list.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {list.map((e) => (
            <EventCard key={e.id} event={e} fromCity={user?.city} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={CalendarRange}
          title={t('myEvents.empty')}
          hint={t('myEvents.emptyHint')}
        />
      )}
    </div>
  );
}
