import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Gift, Pencil, Settings, ShieldAlert, Store } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { InviteSheet } from '@/components/InviteSheet';
import { ProfileView } from './ProfileView';
import { useSession } from '@/store/session';

export function ProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const [inviteOpen, setInviteOpen] = useState(false);

  if (!user) return null;

  return (
    <div>
      <PageHeader
        title={t('nav.profile')}
        right={
          <button onClick={() => navigate('/settings')} aria-label={t('profile.settings')} className="grid h-10 w-10 place-items-center rounded-full hover:bg-black/5 cursor-pointer">
            <Settings className="h-5 w-5" />
          </button>
        }
      />
      {(user.status === 'suspended' || user.status === 'banned') && (
        <div className="mx-5 mt-3 flex items-start gap-2 rounded-card border border-clay/30 bg-clay-soft px-4 py-3 md:mx-0">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-clay" strokeWidth={1.7} />
          <p className="text-meta font-medium text-clay">
            {user.status === 'banned' ? t('profile.statusBanned') : t('profile.statusSuspended')}
          </p>
        </div>
      )}
      <div className="space-y-2 px-5 pt-3 md:px-0">
        <Button variant="outline" fullWidth leftIcon={<Pencil className="h-4 w-4" />} onClick={() => navigate('/profile/edit')}>
          {t('profile.edit')}
        </Button>
        <Button fullWidth leftIcon={<Gift className="h-4 w-4" />} onClick={() => setInviteOpen(true)}>
          {t('referral.invite')}
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" fullWidth leftIcon={<Store className="h-4 w-4" />} onClick={() => navigate('/venues')}>
            {t('venues.browse')}
          </Button>
          <Button variant="outline" fullWidth leftIcon={<Store className="h-4 w-4" />} onClick={() => navigate('/business/onboard')}>
            {t('venues.forBusinesses')}
          </Button>
        </div>
      </div>
      <ProfileView user={user} self />
      <InviteSheet open={inviteOpen} onClose={() => setInviteOpen(false)} />
    </div>
  );
}
