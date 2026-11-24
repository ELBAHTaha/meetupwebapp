import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarDays, MessageCircle } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Avatar } from '@/components/Avatar';
import { ActivityIcon } from '@/components/ActivityIcon';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { useAsync } from '@/hooks/useAsync';
import { listThreads } from '@/api';
import { db } from '@/api/store';
import { useSession } from '@/store/session';
import { formatChatTime, formatEventDate } from '@/lib/format';
import type { ChatMessage, ChatThread } from '@/types';
import { isThreadUnread } from '@/lib/chat';
import { useResync, useSocketEvent } from '@/hooks/useRealtime';
import { cn } from '@/lib/cn';

export function ChatListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, dataVersion } = useSession();
  const threads = useAsync(() => listThreads(user?.id), [user?.id, dataVersion]);
  // Live overlay: latest message per thread pushed over the socket (`chat:activity`).
  const [live, setLive] = useState<Record<string, ChatMessage>>({});
  useEffect(() => setLive({}), [threads.data]);
  useSocketEvent<{ eventId: string; message: ChatMessage }>('chat:activity', (p) =>
    setLive((cur) => ({ ...cur, [p.eventId]: p.message })),
  );
  useResync(() => threads.reload());

  const rows = useMemo(() => {
    const list = (threads.data ?? []).map((th) => {
      const extra = live[th.eventId ?? th.id];
      return extra && !th.messages.some((m) => m.id === extra.id) ? { ...th, messages: [...th.messages, extra] } : th;
    });
    const lastAt = (th: ChatThread) => th.messages[th.messages.length - 1]?.sentAt ?? th.startsAt ?? '';
    return list.sort((a, b) => lastAt(b).localeCompare(lastAt(a)));
  }, [threads.data, live]);

  return (
    <div>
      <PageHeader title={t('chat.title')} />
      <div className="px-5 pt-3 md:px-0">
        {threads.loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-card border border-border bg-surface p-3">
                <Skeleton className="h-11 w-11 rounded-[10px]" />
                <div className="flex-1 space-y-2"><Skeleton className="h-4 w-1/2" /><Skeleton className="h-3 w-3/4" /></div>
              </div>
            ))}
          </div>
        ) : rows.length > 0 ? (
          <div className="space-y-2">
            {rows.map((thread) => (
              <ThreadRow key={thread.id} thread={thread} currentUserId={user!.id} onClick={() => navigate(`/chat/${thread.id}`)} />
            ))}
          </div>
        ) : (
          <EmptyState icon={MessageCircle} title={t('chat.empty')} hint={t('chat.emptyHint')} />
        )}
      </div>
    </div>
  );
}

function ThreadRow({ thread, currentUserId, onClick }: { thread: ChatThread; currentUserId: string; onClick: () => void }) {
  const { t } = useTranslation();
  const last = thread.messages[thread.messages.length - 1];
  const event = thread.eventId ? db.events.find((e) => e.id === thread.eventId) : undefined;
  const activity = event ? db.activities.find((a) => a.id === event.activityId) : undefined;
  const other = !thread.eventId ? db.users.find((u) => thread.participantIds.includes(u.id) && u.id !== currentUserId) : undefined;
  const title = thread.title ?? activity?.name ?? other?.name ?? t('chat.title');
  const sender = last ? last.sender ?? db.users.find((u) => u.id === last.senderId) : undefined;
  const prefix = last ? (last.senderId === currentUserId ? `${t('chat.you')}: ` : sender ? `${sender.name.split(' ')[0]}: ` : '') : '';
  const unread = isThreadUnread(thread.id, last, currentUserId);
  // Activity date for group chats (from the thread payload, else the local store).
  const startsAt = thread.startsAt ?? event?.startsAt;
  const ended = thread.ended ?? (thread.endsAt ? new Date(thread.endsAt) < new Date() : false);

  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-3 text-start transition-colors hover:border-ink/20 cursor-pointer">
      {activity ? (
        <ActivityIcon activity={activity} size="md" tile />
      ) : other ? (
        <Avatar src={other.avatar} name={other.name} size="md" verified={other.verified} />
      ) : (
        <div className="grid h-11 w-11 place-items-center rounded-[10px] bg-clay-soft text-clay"><MessageCircle className="h-5 w-5" strokeWidth={1.6} /></div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate font-display text-h3 font-medium text-ink">{title}</h3>
          {last && (
            <span className={cn('flex shrink-0 items-center gap-1.5 text-[12px]', unread ? 'font-semibold text-clay' : 'text-ink-faint')}>
              {unread && <span className="h-2 w-2 rounded-full bg-clay" aria-label={t('chat.unread')} />}
              {formatChatTime(last.sentAt)}
            </span>
          )}
        </div>
        {thread.eventId && startsAt && (
          <p className="flex items-center gap-1 text-[11px] font-medium text-ink-faint">
            <CalendarDays className="h-3 w-3 shrink-0" strokeWidth={1.7} />
            {formatEventDate(startsAt)}
            {ended && <span className="text-clay"> · {t('chat.ended')}</span>}
          </p>
        )}
        <p className={cn('truncate text-meta', unread ? 'font-medium text-ink' : 'text-ink-soft')}>{prefix}{last?.text ?? t('chat.noMessages')}</p>
      </div>
      {thread.eventId && <span className="shrink-0 rounded-full bg-surface-sunk px-2 py-0.5 text-[10px] font-medium text-ink-soft">{t('chat.groupTag')}</span>}
    </button>
  );
}
