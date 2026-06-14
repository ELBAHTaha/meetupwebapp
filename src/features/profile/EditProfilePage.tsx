import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Input, Textarea } from '@/components/Field';
import { Chip } from '@/components/Chip';
import { Avatar } from '@/components/Avatar';
import { CITIES } from '@/api/catalog';
import { updateProfile } from '@/api';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import type { LookingFor } from '@/types';

const LF: { key: LookingFor; label: string }[] = [
  { key: 'partners', label: 'profile.lfPartners' },
  { key: 'friends', label: 'profile.lfFriends' },
  { key: 'both', label: 'profile.lfBoth' },
];

export function EditProfilePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setUser, setCity } = useSession();
  const [name, setName] = useState(user?.name ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [city, setCityLocal] = useState(user?.city ?? 'Casablanca');
  const [lookingFor, setLookingFor] = useState<LookingFor>(user?.lookingFor ?? 'both');
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  async function save() {
    setSaving(true);
    const updated = await updateProfile({ name, bio, city, lookingFor });
    setUser(updated);
    setCity(city);
    setSaving(false);
    toast('Profile updated', 'success');
    navigate('/profile');
  }

  return (
    <div>
      <PageHeader back title={t('profile.edit')} />
      <div className="mx-auto max-w-app space-y-5 px-5 pt-4 md:max-w-md md:px-0">
        <div className="flex justify-center">
          <Avatar src={user.avatar} name={user.name} size="xl" verified={user.verified} />
        </div>
        <Input label={t('auth.name')} value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea label={t('profile.bio')} value={bio} onChange={(e) => setBio(e.target.value)} />
        <div>
          <span className="mb-1.5 block text-meta font-medium text-ink-soft">{t('profile.hereFor')}</span>
          <div className="flex flex-wrap gap-2">
            {LF.map((o) => (
              <Chip key={o.key} active={lookingFor === o.key} onClick={() => setLookingFor(o.key)} activeClassName="bg-clay text-white">
                {t(o.label)}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-meta font-medium text-ink-soft">{t('profile.city')}</span>
          <div className="flex flex-wrap gap-2">
            {CITIES.map((c) => (
              <Chip key={c.id} active={city === c.name} onClick={() => setCityLocal(c.name)} activeClassName="bg-clay text-white">
                {c.name}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="outline" size="lg" onClick={() => navigate('/profile')}>{t('profile.cancel')}</Button>
          <Button size="lg" fullWidth loading={saving} onClick={save}>{t('profile.save')}</Button>
        </div>
      </div>
    </div>
  );
}
