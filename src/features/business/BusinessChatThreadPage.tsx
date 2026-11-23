import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CalendarRange } from 'lucide-react';
import { format } from 'date-fns';
import { getEvent } from '@/api';
import { useAsync } from '@/hooks/useAsync';
import { useSession } from '@/store/session';
import { Skeleton } from '@/components/Skeleton';
import { EventChatThread, chatUsersFromEvent } from './EventChatThread';

export function BusinessChatThreadPage() {
  const { eventId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const meId = useSession((s) => s.user?.id);
  const ev = useAsync(() => getEvent(eventId), [eventId]);

  if (ev.loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-[60vh] w-full rounded-card" />
      </div>
    );
  }

  if (!ev.data) {
    return (
      <div className="mx-auto max-w-2xl">
        <button onClick={() => navigate('/business/chat')} className="mb-3 inline-flex items-center gap-1.5 text-meta font-medium text-ink-soft hover:text-ink cursor-pointer">
          <ArrowLeft className="h-4 w-4 rtl:rotate-180" strokeWidth={1.8} /> {t('businessChat.back')}
        </button>
        <p className="text-meta text-ink-soft">{t('businessChat.notFound')}</p>
      </div>
    );
  }

  const e = ev.data;

  return (
    <div className="mx-auto max-w-2xl">
      <button onClick={() => navigate('/business/chat')} className="mb-3 inline-flex items-center gap-1.5 text-meta font-medium text-ink-soft hover:text-ink cursor-pointer">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" strokeWidth={1.8} /> {t('businessChat.back')}
      </button>

      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-h1 font-medium text-ink">{e.title}</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-ink-soft">
            <CalendarRange className="h-3.5 w-3.5 text-clay" strokeWidth={1.6} />
            {format(new Date(e.startsAt), 'EEE d MMM · HH:mm')} · {t('businessChat.going', { count: e.goingCount })}
          </p>
        </div>
        <button onClick={() => navigate(`/business/activity/${e.id}`)} className="shrink-0 text-meta font-medium text-clay hover:underline cursor-pointer">
          {t('businessChat.details')}
        </button>
      </div>

      <EventChatThread eventId={e.id} users={chatUsersFromEvent(e)} meId={meId} endsAt={e.endsAt} heightClass="h-[60vh]" />
    </div>
  );
}
