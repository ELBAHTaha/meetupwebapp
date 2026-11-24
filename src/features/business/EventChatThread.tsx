import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Lock, MessageCircle, SendHorizonal } from 'lucide-react';
import { getThread, sendMessage } from '@/api';
import { Avatar } from '@/components/Avatar';
import { toast } from '@/store/toast';
import { cn } from '@/lib/cn';
import { formatChatTime } from '@/lib/format';
import type { ChatMessage } from '@/types';
import { markThreadSeen, mergeIncoming, settleOptimistic, withPending } from '@/lib/chat';
import { useResync, useThreadMessages } from '@/hooks/useRealtime';

export type ChatUser = { name: string; avatar: string; verified?: boolean };

/**
 * Reusable group-chat thread for the business side. Loads the thread for an
 * event and resolves sender names from the supplied user map (host + attendees).
 * `heightClass` controls the scroll area (e.g. a fixed panel vs. a full page).
 */
export function EventChatThread({
  eventId,
  users,
  meId,
  endsAt,
  heightClass = 'max-h-80',
}: {
  eventId: string;
  users: Map<string, ChatUser>;
  meId?: string;
  endsAt?: string;
  heightClass?: string;
}) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [expired, setExpired] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const ended = endsAt ? new Date(endsAt) < new Date() : false;
  const closed = ended || expired;

  const load = useCallback((initial = false) => {
    let alive = true;
    if (initial) {
      setLoading(true);
      setDenied(false);
    }
    getThread(eventId)
      .then((th) => {
        if (!alive) return;
        if (!th) { setExpired(true); return; }
        setMessages((cur) => withPending(th.messages, cur));
      })
      .catch(() => alive && setDenied(true))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [eventId]);

  useEffect(() => load(true), [load]);
  useResync(() => { load(); });
  useThreadMessages(eventId, (m) => setMessages((cur) => mergeIncoming(cur, m, meId)));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
    const last = messages[messages.length - 1];
    if (last && !last.pending) markThreadSeen(eventId, last.sentAt);
  }, [messages.length, eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send() {
    const value = text.trim();
    if (!value || !meId) return;
    setText('');
    const optimistic: ChatMessage = { id: `tmp-${Date.now()}`, senderId: meId, text: value, sentAt: new Date().toISOString(), pending: true };
    setMessages((m) => [...m, optimistic]);
    try {
      const saved = await sendMessage(eventId, value);
      setMessages((m) => settleOptimistic(m, optimistic.id, saved));
    } catch (err) {
      setMessages((m) => m.filter((msg) => msg.id !== optimistic.id));
      toast(err instanceof Error ? err.message : t('chat.sendFailed'), 'error');
    }
  }

  if (denied) {
    return (
      <div className="rounded-card border border-border bg-surface p-6 text-center">
        <MessageCircle className="mx-auto h-7 w-7 text-ink-faint" strokeWidth={1.4} />
        <p className="mt-2 text-meta text-ink-soft">{t('chat.deniedTitle')}</p>
        <p className="text-[12px] text-ink-faint">{t('chat.deniedHint')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-card border border-border bg-surface">
      <div className={cn('flex-1 space-y-3 overflow-y-auto p-4', heightClass)}>
        {loading ? (
          <p className="text-center text-meta text-ink-faint">{t('common.loading')}</p>
        ) : messages.length === 0 ? (
          <p className="py-4 text-center text-meta text-ink-faint">{t('chat.sayHello')}</p>
        ) : (
          messages.map((m, i) => {
            const mine = m.senderId === meId;
            const sender = users.get(m.senderId) ?? m.sender;
            const showAvatar = !mine && messages[i - 1]?.senderId !== m.senderId;
            return (
              <div key={m.id} className={cn('flex items-end gap-2', mine ? 'justify-end' : 'justify-start')}>
                {!mine && (showAvatar && sender ? <Avatar src={sender.avatar} name={sender.name} size="xs" /> : <span className="w-6" />)}
                <div className="max-w-[78%]">
                  {!mine && showAvatar && <p className="mb-0.5 ms-1 text-[11px] font-medium text-ink-faint">{(sender?.name ?? t('chat.member')).split(' ')[0]}</p>}
                  <div className={cn('rounded-[14px] px-3.5 py-2.5 text-[15px] leading-snug', mine ? 'rounded-ee-[4px] bg-clay-soft text-ink' : 'rounded-es-[4px] bg-surface-sunk text-ink', m.pending && 'opacity-60')}>
                    {m.text}
                  </div>
                  <p className={cn('mt-0.5 text-[10px] text-ink-faint', mine ? 'text-end' : 'ms-1')}>{formatChatTime(m.sentAt)}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-border p-3">
        {closed ? (
          <p className="flex items-center justify-center gap-2 py-1 text-meta text-ink-faint">
            <Lock className="h-4 w-4" strokeWidth={1.6} /> {expired ? t('chat.expired') : t('chat.ended')}
          </p>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex items-center gap-2">
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('chat.messageAttendees')} className="flex-1 rounded-full border border-border bg-bg px-4 py-2.5 text-[15px] focus:border-clay" />
            <button type="submit" disabled={!text.trim()} aria-label={t('chat.send')} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-clay text-white transition-transform active:scale-90 disabled:opacity-40 cursor-pointer">
              <SendHorizonal className="h-5 w-5 rtl:-scale-x-100" strokeWidth={1.6} />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/** Build the host + attendees name map an EventChatThread needs. */
export function chatUsersFromEvent(e: {
  host: { id: string; name: string; avatar: string; verified?: boolean };
  attendeeUsers?: { id: string; name: string; avatar: string; verified?: boolean }[];
}): Map<string, ChatUser> {
  const m = new Map<string, ChatUser>();
  m.set(e.host.id, { name: e.host.name, avatar: e.host.avatar, verified: e.host.verified });
  (e.attendeeUsers ?? []).forEach((u) => m.set(u.id, { name: u.name, avatar: u.avatar, verified: u.verified }));
  return m;
}
