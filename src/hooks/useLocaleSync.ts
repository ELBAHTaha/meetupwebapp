import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { updateProfile } from '@/api';
import { USE_REMOTE } from '@/api/http';
import { useSession } from '@/store/session';

/**
 * Keep the signed-in user's stored `locale` in step with the UI language so
 * server-sent emails (verification, reset, reminders) arrive in their language.
 */
export function useLocaleSync(): void {
  const { i18n } = useTranslation();
  const user = useSession((s) => s.user);
  const lang = i18n.language?.slice(0, 2);

  useEffect(() => {
    if (!USE_REMOTE || !user || !lang || user.locale === lang) return;
    updateProfile({ locale: lang })
      .then((fresh) => useSession.getState().setUser(fresh))
      .catch(() => undefined);
  }, [lang, user?.id, user?.locale]); // eslint-disable-line react-hooks/exhaustive-deps
}
