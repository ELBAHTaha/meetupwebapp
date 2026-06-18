import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarRange, Clock, Crown, MapPin, MessageCircle, Users } from 'lucide-react';
import { format } from 'date-fns';
import { getEvent } from '@/api';
import { useAsync } from '@/hooks/useAsync';
import { Avatar } from '@/components/Avatar';
import { Tag } from '@/components/Chip';
import { Skeleton } from '@/components/Skeleton';
import { cn } from '@/lib/cn';
import type { User } from '@/types';

const STATUS_TONE: Record<string, string> = {
  live: 'bg-olive-soft text-olive',
  completed: 'bg-surface-sunk text-ink-soft',
  cancelled: 'bg-clay text-white',
};

export function BusinessActivityDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const ev = useAsync(() => getEvent(id), [id]);

  if (ev.loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-64 w-full rounded-card" />
      </div>
    );
  }

  if (!ev.data) {
    return (
      <div className="mx-auto max-w-2xl">
        <button onClick={() => navigate('/business/dashboard')} className="mb-3 inline-flex items-center gap-1.5 text-meta font-medium text-ink-soft hover:text-ink cursor-pointer">
          <ArrowLeft className="h-4 w-4" strokeWidth={1.8} /> Back to dashboard
        </button>
        <p className="text-meta text-ink-soft">This activity could not be found.</p>
      </div>
    );
  }

  const e = ev.data;
  const start = new Date(e.startsAt);
  const end = e.endsAt ? new Date(e.endsAt) : new Date(start.getTime() + e.durationMins * 60_000);
  const status = e.lifecycle ?? 'live';
  const byId = new Map((e.attendeeUsers ?? []).map((u) => [u.id, u] as const));
  const going = e.attendees.filter((a) => a.status === 'going').map((a) => byId.get(a.userId)).filter((u): u is User => !!u);
  const waitlist = e.attendees.filter((a) => a.status === 'waitlisted').map((a) => byId.get(a.userId)).filter((u): u is User => !!u);

  return (
    <div className="mx-auto max-w-2xl">
      <button onClick={() => navigate('/business/dashboard')} className="mb-3 inline-flex items-center gap-1.5 text-meta font-medium text-ink-soft hover:text-ink cursor-pointer">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} /> Back to dashboard
      </button>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-h1 font-medium text-ink">{e.title}</h1>
            <Tag className={cn('capitalize', STATUS_TONE[status] ?? STATUS_TONE.live)}>{status}</Tag>
          </div>
          <p className="mt-1 text-meta text-ink-soft">{e.activity.name}</p>
        </div>
      </div>

      {/* Key facts */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Fact icon={CalendarRange} label="Date" value={format(start, 'EEE d MMM')} />
        <Fact icon={Clock} label="Time" value={`${format(start, 'HH:mm')}–${format(end, 'HH:mm')}`} />
        <Fact icon={Users} label="Going" value={`${e.goingCount} / ${e.capacity}`} sub={`min ${e.minPlayers}`} />
        <Fact icon={MapPin} label="Price" value={e.price > 0 ? `${e.price} MAD` : 'Free'} />
      </div>

      {/* Location + host */}
      <div className="mt-3 rounded-card border border-border bg-surface p-4">
        <p className="flex items-center gap-1.5 text-meta text-ink">
          <MapPin className="h-4 w-4 shrink-0 text-clay" strokeWidth={1.6} />
          <span className="font-medium">{e.resolvedLocation.label}</span>
          {e.generalArea && e.generalArea !== e.resolvedLocation.label ? <span className="text-ink-soft">· {e.generalArea}</span> : null}
        </p>
        <div className="mt-3 flex items-center gap-2 border-t border-border pt-3">
          <Avatar src={e.host.avatar} name={e.host.name} size="sm" verified={e.host.verified} />
          <div>
            <p className="text-[12px] text-ink-faint">Hosted by</p>
            <p className="text-meta font-medium text-ink">{e.host.name}</p>
          </div>
        </div>
        {e.description && <p className="mt-3 border-t border-border pt-3 text-meta text-ink-soft">{e.description}</p>}
      </div>

      {/* Open group chat */}
      <button
        onClick={() => navigate(`/business/chat/${e.id}`)}
        className="mt-3 flex w-full items-center gap-3 rounded-card border border-border bg-surface p-4 text-left transition-colors hover:border-clay/40 cursor-pointer"
      >
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-clay-soft text-clay">
          <MessageCircle className="h-5 w-5" strokeWidth={1.6} />
        </span>
        <div className="flex-1">
          <p className="font-display text-h3 font-medium text-ink">Group chat</p>
          <p className="text-[12px] text-ink-soft">Message the host and attendees of this activity.</p>
        </div>
        <span className="text-meta font-medium text-clay">Open →</span>
      </button>

      {/* Who's joining */}
      <section className="mt-5">
        <h2 className="mb-3 font-display text-h2 font-medium text-ink">Who’s joining · {going.length}</h2>
        {going.length === 0 ? (
          <p className="rounded-card border border-dashed border-border bg-surface p-5 text-center text-meta text-ink-soft">
            No one has joined yet.
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {going.map((u) => (
              <div key={u.id} className="flex w-16 flex-col items-center gap-1.5">
                <Avatar src={u.avatar} name={u.name} size="md" verified={u.verified} />
                <span className="w-full truncate text-center text-[12px] text-ink-soft">{u.name.split(' ')[0]}</span>
              </div>
            ))}
          </div>
        )}

        {waitlist.length > 0 && (
          <div className="mt-4 rounded-card border border-border bg-surface-sunk/60 p-3">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-faint">Waitlist · {waitlist.length}</p>
            <div className="mt-2 flex -space-x-2">
              {waitlist.map((u) => (
                <Avatar key={u.id} src={u.avatar} name={u.name} size="sm" ring />
              ))}
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center gap-1.5 rounded-card border border-border bg-surface px-3 py-2 text-[12px] text-ink-faint">
          <Crown className="h-3.5 w-3.5 shrink-0 text-clay" strokeWidth={1.6} />
          Attendee details are shown to you as the venue. Their contact info is never shared unless they opt in.
        </div>
      </section>
    </div>
  );
}

function Fact({ icon: Icon, label, value, sub }: { icon: typeof Users; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-card border border-border bg-surface p-3">
      <Icon className="h-4 w-4 text-clay" strokeWidth={1.7} />
      <p className="mt-1.5 font-display text-h3 font-medium leading-none text-ink">{value}</p>
      <p className="mt-1 text-[12px] text-ink-soft">{label}{sub ? ` · ${sub}` : ''}</p>
    </div>
  );
}
