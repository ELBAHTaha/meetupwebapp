import { listNotifications } from '@/api';
import { useAsync } from './useAsync';
import { useSession } from '@/store/session';

/** Number of unread notifications for the current user (drives the bell badge). */
export function useUnreadNotifications(): number {
  const dataVersion = useSession((s) => s.dataVersion);
  const isAuthed = useSession((s) => s.isAuthed);
  const { data } = useAsync(() => (isAuthed ? listNotifications() : Promise.resolve([])), [dataVersion, isAuthed]);
  return (data ?? []).filter((n) => !n.read).length;
}
