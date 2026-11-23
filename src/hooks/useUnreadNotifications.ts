import { useEffect, useState } from 'react';
import { listNotifications } from '@/api';
import { useAsync } from './useAsync';
import { useResync, useSocketEvent } from './useRealtime';
import { useSession } from '@/store/session';

/**
 * Number of unread notifications for the current user (drives the bell badge).
 * Fetched on load / data changes, then kept live by the socket's
 * `notification:new` / `notification:unread` pushes (real backend only).
 */
export function useUnreadNotifications(): number {
  const dataVersion = useSession((s) => s.dataVersion);
  const isAuthed = useSession((s) => s.isAuthed);
  const { data, reload } = useAsync(() => (isAuthed ? listNotifications() : Promise.resolve([])), [dataVersion, isAuthed]);
  const [live, setLive] = useState<number | null>(null);
  useEffect(() => setLive(null), [data]);
  useSocketEvent<{ unread: number }>('notification:new', (p) => setLive(p.unread));
  useSocketEvent<{ unread: number }>('notification:unread', (p) => setLive(p.unread));
  useResync(reload);
  return live ?? (data ?? []).filter((n) => !n.read).length;
}
