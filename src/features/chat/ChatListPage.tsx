import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Avatar } from '@/components/Avatar';
import { ActivityIcon } from '@/components/ActivityIcon';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { useAsync } from '@/hooks/useAsync';
import { listThreads } from '@/api';
import { db } from '@/api/store';
import { useSession } from '@/store/session';
import { formatChatTime } from '@/lib/format';
import type { ChatThread } from '@/types';

export function ChatListPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, dataVersion } = useSession();
  const threads = useAsync(() => listThreads(user?.id), [user?.id, dataVersion]);

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
        ) : threads.data && threads.data.length > 0 ? (
          <div className="space-y-2">
            {threads.data.map((thread) => (
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
  const title = thread.title ?? other?.name ?? 'Chat';
  const sender = last ? db.users.find((u) => u.id === last.senderId) : undefined;
  const prefix = last ? (last.senderId === currentUserId ? `${t('chat.you')}: ` : `${sender?.name.split(' ')[0]}: `) : '';

  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-3 text-left transition-colors hover:border-ink/20 cursor-pointer">
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
          {last && <span className="shrink-0 text-[12px] text-ink-faint">{formatChatTime(last.sentAt)}</span>}
        </div>
        <p className="truncate text-meta text-ink-soft">{prefix}{last?.text ?? 'No messages yet'}</p>
      </div>
      {thread.eventId && <span className="shrink-0 rounded-full bg-surface-sunk px-2 py-0.5 text-[10px] font-medium text-ink-soft">{t('chat.groupTag')}</span>}
    </button>
  );
}
