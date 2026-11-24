import { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Input, Textarea } from '@/components/Field';
import { Chip } from '@/components/Chip';
import { Avatar } from '@/components/Avatar';
import { CITIES } from '@/api/catalog';
import { updateProfile, uploadAvatar } from '@/api';
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
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast(t('profile.photoTooBig'), 'error');
      return;
    }
    setUploading(true);
    try {
      setUser(await uploadAvatar(file));
      toast(t('profile.photoUpdated'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : t('authFlow.genericError'), 'error');
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setSaving(true);
    const updated = await updateProfile({ name, bio, city, lookingFor });
    setUser(updated);
    setCity(city);
    setSaving(false);
    toast(t('profile.updated'), 'success');
    navigate('/profile');
  }

  return (
    <div>
      <PageHeader back title={t('profile.edit')} />
      <div className="mx-auto max-w-app space-y-5 px-5 pt-4 md:max-w-md md:px-0">
        <div className="flex flex-col items-center gap-2">
          <Avatar src={user.avatar} name={user.name} size="xl" verified={user.verified} />
          <Button size="sm" variant="outline" loading={uploading} leftIcon={<Camera className="h-4 w-4" strokeWidth={1.7} />} onClick={() => fileRef.current?.click()}>
            {t('profile.changePhoto')}
          </Button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={onPhoto} />
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
