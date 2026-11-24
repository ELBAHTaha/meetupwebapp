import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Avatar } from '@/components/Avatar';
import { Button } from '@/components/Button';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { useAsync } from '@/hooks/useAsync';
import { listBlockedUsers, unblockUser } from '@/api';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';

/** Settings → Blocked users: everyone I've blocked, with Unblock. */
export function BlockedUsersPage() {
  const { t } = useTranslation();
  const bumpData = useSession((s) => s.bumpData);
  const list = useAsync(() => listBlockedUsers(), []);
  const [busy, setBusy] = useState<string | null>(null);

  async function unblock(id: string, name: string) {
    setBusy(id);
    try {
      await unblockUser(id);
      bumpData();
      toast(t('block.unblocked', { name: name.split(' ')[0] }), 'success');
      list.reload();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('authFlow.genericError'), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <PageHeader back title={t('block.settingsTitle')} />
      <div className="space-y-2 px-5 pt-3 md:px-0">
        <p className="text-meta text-ink-soft">{t('block.pageHint')}</p>
        {list.loading ? (
          <Skeleton className="h-16 w-full rounded-card" />
        ) : !list.data?.length ? (
          <EmptyState icon={Ban} title={t('block.empty')} />
        ) : (
          list.data.map((u) => (
            <div key={u.id} className="flex items-center gap-3 rounded-card border border-border bg-surface p-3">
              <Avatar src={u.avatar} name={u.name} size="md" />
              <p className="min-w-0 flex-1 truncate font-display text-h3 font-medium text-ink">{u.name}</p>
              <Button size="sm" variant="outline" loading={busy === u.id} onClick={() => unblock(u.id, u.name)}>
                {t('block.unblock')}
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
