import { useNavigate } from 'react-router-dom';
import { CalendarRange, ChevronRight, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { getMyBusiness } from '@/api';
import { useAsync } from '@/hooks/useAsync';
import { useSession } from '@/store/session';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Chip';
import { cn } from '@/lib/cn';

const STATUS_TONE: Record<string, string> = {
  live: 'bg-olive-soft text-olive',
  completed: 'bg-surface-sunk text-ink-soft',
  cancelled: 'bg-clay text-white',
};

export function BusinessChatListPage() {
  const navigate = useNavigate();
  const { dataVersion } = useSession();
  const data = useAsync(() => getMyBusiness(), [dataVersion]);

  if (data.loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-20 w-full rounded-card" />
        <Skeleton className="h-20 w-full rounded-card" />
      </div>
    );
  }

  const activities = data.data?.activities ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-h1 font-medium text-ink">Messages</h1>
        <p className="text-meta text-ink-soft">Group chats for activities at your venue.</p>
      </div>

      {activities.length === 0 ? (
        <div className="rounded-card border border-dashed border-border bg-surface p-6 text-center">
          <MessageCircle className="mx-auto h-7 w-7 text-ink-faint" strokeWidth={1.4} />
          <p className="mt-2 text-meta text-ink-soft">No activity chats yet.</p>
          <p className="text-[12px] text-ink-faint">Host an activity and its group chat will appear here.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map((a) => {
            const status = a.status ?? 'live';
            return (
              <button
                key={a.id}
                onClick={() => navigate(`/business/chat/${a.id}`)}
                className="group flex w-full items-center gap-3 rounded-card border border-border bg-surface p-3.5 text-left transition-colors hover:border-clay/40 cursor-pointer"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-clay-soft text-clay">
                  <MessageCircle className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-display text-h3 font-medium text-ink">{a.title}</p>
                    <Tag className={cn('shrink-0 capitalize', STATUS_TONE[status] ?? STATUS_TONE.live)}>{status}</Tag>
                  </div>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-ink-soft">
                    <CalendarRange className="h-3.5 w-3.5 shrink-0 text-clay" strokeWidth={1.6} />
                    {format(new Date(a.startsAt), 'EEE d MMM · HH:mm')}
                    {a.going != null ? ` · ${a.going} going` : ''}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-faint transition-colors group-hover:text-clay" strokeWidth={1.7} />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
