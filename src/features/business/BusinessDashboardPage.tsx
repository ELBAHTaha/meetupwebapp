import { useNavigate } from 'react-router-dom';
import { CalendarRange, ChevronRight, Clock, MapPin, Plus, Ticket, Users } from 'lucide-react';
import { format } from 'date-fns';
import { useAsync } from '@/hooks/useAsync';
import { getMyBusiness } from '@/api';
import { useSession } from '@/store/session';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Chip';
import { cn } from '@/lib/cn';
import type { MyBusinessActivity } from '@/types';

const STATUS_TONE: Record<string, string> = {
  live: 'bg-olive-soft text-olive',
  completed: 'bg-surface-sunk text-ink-soft',
  cancelled: 'bg-clay text-white',
};

export function BusinessDashboardPage() {
  const navigate = useNavigate();
  const { user, dataVersion } = useSession();
  const data = useAsync(() => getMyBusiness(), [dataVersion]);

  if (data.loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-28 w-full rounded-card" />
        <Skeleton className="h-28 w-full rounded-card" />
      </div>
    );
  }

  if (!data.data) {
    return <p className="text-meta text-ink-soft">Could not load your business right now.</p>;
  }

  const { business, activities } = data.data;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-meta text-ink-soft">Welcome back{user?.name ? `, ${user.name}` : ''}</p>
        <h1 className="font-display text-h1 font-medium text-ink">{business.name}</h1>
      </div>

      {/* Activities at venue */}
      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-display text-h2 font-medium text-ink">Activities at your venue</h2>
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => navigate('/business/create')}>
            Host activity
          </Button>
        </div>

        {activities.length === 0 ? (
          <div className="rounded-card border border-dashed border-border bg-surface p-6 text-center">
            <CalendarRange className="mx-auto h-7 w-7 text-ink-faint" strokeWidth={1.4} />
            <p className="mt-2 text-meta text-ink-soft">No meetups have used your venue yet.</p>
            <p className="text-[12px] text-ink-faint">Host one above — it’ll show up here with live attendance.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((a) => (
              <ActivityCard key={a.id} a={a} onOpen={() => navigate(`/business/activity/${a.id}`)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ActivityCard({ a, onOpen }: { a: MyBusinessActivity; onOpen: () => void }) {
  const start = new Date(a.startsAt);
  const end = a.endsAt ? new Date(a.endsAt) : null;
  const price = a.price ?? 0;
  const status = a.status ?? 'live';

  return (
    <button
      onClick={onOpen}
      className="group flex w-full items-stretch gap-3 rounded-card border border-border bg-surface p-4 text-left transition-colors hover:border-clay/40 cursor-pointer"
    >
      {/* Date block */}
      <div className="flex w-14 shrink-0 flex-col items-center justify-center rounded-card bg-surface-sunk py-2">
        <span className="text-[11px] font-medium uppercase text-ink-soft">{format(start, 'MMM')}</span>
        <span className="font-display text-h1 font-medium leading-none text-ink">{format(start, 'd')}</span>
        <span className="mt-0.5 text-[11px] text-ink-faint">{format(start, 'EEE')}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate font-display text-h3 font-medium text-ink">{a.title}</p>
          <Tag className={cn('shrink-0 capitalize', STATUS_TONE[status] ?? STATUS_TONE.live)}>{status}</Tag>
        </div>

        <p className="mt-0.5 truncate text-[12px] text-ink-soft">
          {a.activityType} · hosted by {a.hostName}
        </p>

        {/* Detail chips */}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-soft">
          <span className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 text-clay" strokeWidth={1.7} />
            {format(start, 'HH:mm')}{end ? `–${format(end, 'HH:mm')}` : ''}
          </span>
          {(a.going != null || a.capacity != null) && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-clay" strokeWidth={1.7} />
              {a.going ?? 0}{a.capacity != null ? ` / ${a.capacity}` : ''} going
            </span>
          )}
          {a.locationLabel && (
            <span className="flex items-center gap-1 truncate">
              <MapPin className="h-3.5 w-3.5 text-clay" strokeWidth={1.7} /> {a.locationLabel}
            </span>
          )}
          <span className="font-medium text-ink">{price > 0 ? `${price} MAD` : 'Free'}</span>
          {a.couponCode && (
            <Tag leftIcon={<Ticket className="h-3.5 w-3.5" strokeWidth={1.7} />} className="bg-majorelle-soft text-majorelle">
              {a.couponCode}
            </Tag>
          )}
        </div>
      </div>

      <ChevronRight className="h-5 w-5 shrink-0 self-center text-ink-faint transition-colors group-hover:text-clay" strokeWidth={1.7} />
    </button>
  );
}
