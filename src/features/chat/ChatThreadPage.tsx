import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Flag, Lock, SendHorizonal } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Avatar } from '@/components/Avatar';
import { ActivityIcon } from '@/components/ActivityIcon';
import { ReportSheet } from '@/components/ReportSheet';
import { getThread, sendMessage } from '@/api';
import { db } from '@/api/store';
import { threadExpired } from '@/api/store';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { formatChatTime } from '@/lib/format';
import type { ChatMessage, ChatThread } from '@/types';
import { cn } from '@/lib/cn';

export function ChatThreadPage() {
  const { threadId = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [fetched, setFetched] = useState<ChatThread | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [reportOpen, setReportOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const thread = db.threads.find((x) => x.id === threadId);
  const event = thread?.eventId ? db.events.find((e) => e.id === thread.eventId) : undefined;
  const activity = event ? db.activities.find((a) => a.id === event.activityId) : undefined;
  const other = !thread?.eventId ? db.users.find((u) => thread?.participantIds.includes(u.id) && u.id !== user?.id) : undefined;
  const title = thread?.title ?? activity?.name ?? other?.name ?? fetched?.title ?? 'Chat';
  const expired = thread ? threadExpired(thread) : false;
  // Once the activity ends the chat is read-only (separate from the 24h expiry).
  const ended = fetched?.ended ?? (fetched?.endsAt ? new Date(fetched.endsAt) < new Date() : false);
  const closed = expired || ended;
  // Report target: the activity for group chats, the other user for DMs.
  const reportTargetType = event ? 'activity' : 'user';
  const reportTargetId = event ? event.id : other?.id ?? '';

  useEffect(() => {
    let active = true;
    getThread(threadId).then((th) => {
      if (active) { setMessages(th?.messages ?? []); setFetched(th); setLoading(false); }
    });
    return () => { active = false; };
  }, [threadId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  async function send() {
    const value = text.trim();
    if (!value || !user) return;
    setText('');
    const optimistic: ChatMessage = { id: `tmp-${Date.now()}`, senderId: user.id, text: value, sentAt: new Date().toISOString(), pending: true };
    setMessages((m) => [...m, optimistic]);
    try {
      const saved = await sendMessage(threadId, value);
      setMessages((m) => m.map((msg) => (msg.id === optimistic.id ? saved : msg)));
    } catch (err) {
      setMessages((m) => m.filter((msg) => msg.id !== optimistic.id));
      toast(err instanceof Error ? err.message : 'Could not send', 'error');
    }
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-bg md:h-[calc(100vh-4rem)]">
      <PageHeader
        back
        onBack={() => navigate('/chat')}
        title={title}
        right={
          <div className="flex items-center gap-1">
            <button onClick={() => setReportOpen(true)} aria-label={t('report.title')} className="grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-surface-sunk cursor-pointer">
              <Flag className="h-[18px] w-[18px]" strokeWidth={1.6} />
            </button>
            {activity ? <ActivityIcon activity={activity} size="sm" tile /> : other ? <Avatar src={other.avatar} name={other.name} size="sm" /> : null}
          </div>
        }
      />
      {event && (
        <button onClick={() => navigate(`/event/${event.id}`)} className="mx-auto w-full max-w-app border-b border-border bg-surface/60 px-5 py-2 text-left text-[12px] font-medium text-clay cursor-pointer md:max-w-shell">
          {t('event.about')} →
        </button>
      )}

      <div className="mx-auto w-full max-w-app flex-1 space-y-3 overflow-y-auto px-4 py-4 md:max-w-2xl">
        {loading ? (
          <p className="text-center text-meta text-ink-faint">{t('common.loading')}</p>
        ) : (
          messages.map((m, i) => {
            const mine = m.senderId === user?.id;
            const sender = db.users.find((u) => u.id === m.senderId);
            const showAvatar = !mine && messages[i - 1]?.senderId !== m.senderId;
            return (
              <div key={m.id} className={cn('flex items-end gap-2', mine ? 'justify-end' : 'justify-start')}>
                {!mine && (showAvatar && sender ? <Avatar src={sender.avatar} name={sender.name} size="xs" /> : <span className="w-6" />)}
                <div className="max-w-[78%] animate-fade-in">
                  {!mine && showAvatar && <p className="mb-0.5 ml-1 text-[11px] font-medium text-ink-faint">{sender?.name.split(' ')[0]}</p>}
                  <div className={cn('rounded-[14px] px-3.5 py-2.5 text-[15px] leading-snug', mine ? 'rounded-br-[4px] bg-clay-soft text-ink' : 'rounded-bl-[4px] bg-surface-sunk text-ink', m.pending && 'opacity-60')}>
                    {m.text}
                  </div>
                  <p className={cn('mt-0.5 text-[10px] text-ink-faint', mine ? 'text-right' : 'ml-1')}>{formatChatTime(m.sentAt)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="mx-auto w-full max-w-app border-t border-border bg-bg/95 px-4 py-3 backdrop-blur-md md:max-w-2xl" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)' }}>
        {closed ? (
          <p className="flex items-center justify-center gap-2 py-2 text-meta text-ink-faint">
            <Lock className="h-4 w-4" strokeWidth={1.6} /> {expired ? t('chat.expired') : t('chat.ended')}
          </p>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('chat.messagePlaceholder')} className="flex-1 rounded-full border border-border bg-surface px-4 py-3 text-[15px] focus:border-clay" />
            <button type="submit" disabled={!text.trim()} aria-label={t('chat.send')} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-clay text-white transition-transform active:scale-90 disabled:opacity-40 cursor-pointer">
              <SendHorizonal className="h-5 w-5" strokeWidth={1.6} />
            </button>
          </form>
        )}
      </div>

      <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} targetType={reportTargetType} targetId={reportTargetId} chatThreadId={thread?.id} />
    </div>
  );
}
