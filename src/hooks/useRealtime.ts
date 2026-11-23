import { useEffect, useRef } from 'react';
import { onResync, onSocket, startRealtime, subscribeThread } from '@/lib/socket';
import { useSession } from '@/store/session';
import type { ChatMessage } from '@/types';

/** Open the shared socket while signed in (used by the app layouts). */
export function useRealtimeConnection(): void {
  const isAuthed = useSession((s) => s.isAuthed);
  useEffect(() => {
    if (isAuthed) startRealtime();
  }, [isAuthed]);
}

/** Subscribe to a socket event for the component's lifetime (handler can change freely). */
export function useSocketEvent<T>(event: string, handler: (payload: T) => void): void {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => onSocket<T>(event, (p) => ref.current(p)), [event]);
}

/**
 * Call `fn` whenever we may have missed live events: after a socket reconnect,
 * or when the tab becomes visible again.
 */
export function useResync(fn: () => void): void {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    const off = onResync(() => ref.current());
    const onVisible = () => {
      if (document.visibilityState === 'visible') ref.current();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      off();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}

/** Live messages for one group chat: joins its room and forwards `message:new`. */
export function useThreadMessages(eventId: string | undefined, onMessage: (m: ChatMessage) => void): void {
  useEffect(() => (eventId ? subscribeThread(eventId) : undefined), [eventId]);
  useSocketEvent<{ eventId: string; message: ChatMessage }>('message:new', (p) => {
    if (p.eventId === eventId) onMessage(p.message);
  });
}
