import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Flag, MessageCircle, UserX } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { ProfileView } from './ProfileView';
import { ReportSheet } from '@/components/ReportSheet';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import { useAsync } from '@/hooks/useAsync';
import { getUser } from '@/api';
import { db } from '@/api/store';
import { useSession } from '@/store/session';

export function UserProfilePage() {
  const { id = '' } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useSession((s) => s.user);
  const [reportOpen, setReportOpen] = useState(false);
  const { data: user, loading } = useAsync(() => getUser(id), [id]);

  // Own profile? Redirect-style render via ProfileView self.
  if (me && id === me.id) {
    return (
      <div>
        <PageHeader back title={me.name} />
        <ProfileView user={me} self />
      </div>
    );
  }

  function messageUser() {
    if (!user) return;
    // Find or create a DM thread.
    let thread = db.threads.find(
      (th) => !th.eventId && th.participantIds.length === 2 && th.participantIds.includes(user.id) && me && th.participantIds.includes(me.id),
    );
    if (!thread && me) {
      thread = { id: `t-dm-${user.id}-${Date.now()}`, participantIds: [me.id, user.id], messages: [] };
      db.threads.push(thread);
    }
    if (thread) navigate(`/chat/${thread.id}`);
  }

  return (
    <div>
      <PageHeader back title={user?.name} />
      {loading ? (
        <div className="space-y-4 px-5">
          <div className="flex gap-4">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="flex-1 space-y-2 pt-2">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
        </div>
      ) : user ? (
        <>
          <div className="flex gap-2 px-5 pt-3 md:px-0">
            <Button fullWidth leftIcon={<MessageCircle className="h-4 w-4" strokeWidth={1.6} />} onClick={messageUser}>
              {t('profile.message')}
            </Button>
            <Button variant="danger" leftIcon={<Flag className="h-4 w-4" strokeWidth={1.6} />} onClick={() => setReportOpen(true)}>
              {t('report.title')}
            </Button>
          </div>
          <ProfileView user={user} self={false} />
          <ReportSheet open={reportOpen} onClose={() => setReportOpen(false)} targetType="user" targetId={user.id} />
        </>
      ) : (
        <EmptyState icon={UserX} title={t('common.notFound')} />
      )}
    </div>
  );
}
