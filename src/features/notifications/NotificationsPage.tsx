import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, BellOff, CalendarClock, CheckCheck, Hand, MessageCircle, PartyPopper, ShieldAlert, Star, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { useAsync } from '@/hooks/useAsync';
import { listNotifications, markNotificationsRead } from '@/api';
import { useSession } from '@/store/session';
import { formatRelative } from '@/lib/format';
import type { AppNotification } from '@/types';
import { cn } from '@/lib/cn';

const iconFor: Record<AppNotification['type'], typeof MessageCircle> = {
  reminder: CalendarClock,
  join_request: UserPlus,
  chat: MessageCircle,
  confirmed: PartyPopper,
  review: Star,
  start: Hand,
  rate: Star,
  report: ShieldAlert,
  admin: ShieldAlert,
};

export function NotificationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const bumpData = useSession((s) => s.bumpData);
  const { data, loading } = useAsync(() => listNotifications(), []);

  useEffect(() => {
    // Mark read shortly after viewing, then refresh so the bell badge clears.
    const id = setTimeout(async () => {
      await markNotificationsRead();
      bumpData();
    }, 1200);
    return () => clearTimeout(id);
  }, [bumpData]);

  return (
    <div>
      <PageHeader
        back
        title={t('notifications.title')}
        right={
          <button onClick={() => markNotificationsRead()} aria-label={t('notifications.markAllRead')} className="grid h-10 w-10 place-items-center rounded-full hover:bg-black/5 cursor-pointer">
            <CheckCheck className="h-5 w-5" />
          </button>
        }
      />
      <div className="px-5 pt-3 md:px-0">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-card" />
            ))}
          </div>
        ) : data && data.length > 0 ? (
          <div className="space-y-2">
            {data.map((n) => {
              const Icon = iconFor[n.type] ?? Bell;
              return (
                <button
                  key={n.id}
                  onClick={() => n.eventId && navigate(`/event/${n.eventId}`)}
                  className={cn('flex w-full items-start gap-3 rounded-card border p-3.5 text-left transition-colors cursor-pointer', n.read ? 'border-border bg-surface' : 'border-clay/20 bg-clay-soft/50 hover:bg-clay-soft')}
                >
                  <span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-[10px]', n.read ? 'bg-surface-sunk text-ink-soft' : 'bg-clay-soft text-clay')}>
                    <Icon className="h-5 w-5" strokeWidth={1.6} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-h3 font-medium text-ink">{n.title}</p>
                    <p className="text-meta text-ink-soft">{n.body}</p>
                    <p className="mt-0.5 text-[12px] text-ink-faint">{formatRelative(n.createdAt)}</p>
                  </div>
                  {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-clay" />}
                </button>
              );
            })}
          </div>
        ) : (
          <EmptyState icon={BellOff} title={t('notifications.empty')} />
        )}
      </div>
    </div>
  );
}
