import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { BadgeCheck, Bell, Check, ChevronRight, Crown, Globe, LogOut, Moon, ShieldCheck, Sun } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Sheet } from '@/components/Sheet';
import { useSession } from '@/store/session';
import { useTheme } from '@/store/theme';
import { LANGUAGES, setLanguage } from '@/i18n';
import { toast } from '@/store/toast';
import { updateProfile } from '@/api';
import { cn } from '@/lib/cn';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const logout = useSession((s) => s.logout);
  const user = useSession((s) => s.user);
  const setUser = useSession((s) => s.setUser);
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggle);
  const [langOpen, setLangOpen] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const dark = theme === 'dark';
  const emailOn = user?.emailNotifications !== false;

  async function toggleEmail() {
    if (!user || savingEmail) return;
    const next = !emailOn;
    setSavingEmail(true);
    setUser({ ...user, emailNotifications: next }); // optimistic
    try {
      const updated = await updateProfile({ emailNotifications: next });
      setUser(updated);
      toast(next ? t('profile.emailOn') : t('profile.emailOff'), 'success');
    } catch {
      setUser({ ...user, emailNotifications: emailOn }); // revert
      toast(t('common.somethingWrong'), 'error');
    } finally {
      setSavingEmail(false);
    }
  }

  const verifyStatus = user?.verified ? 'verified' : user?.verificationStatus ?? 'none';
  const verifyHint =
    verifyStatus === 'verified' ? t('profile.verifyVerified')
    : verifyStatus === 'pending' ? t('profile.verifyPending')
    : t('profile.verifyNone');

  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  return (
    <div>
      <PageHeader back title={t('profile.settings')} />
      <div className="mx-auto max-w-app space-y-2.5 px-5 pt-4 md:max-w-md md:px-0">
        {/* Identity verification */}
        <button onClick={() => navigate('/verify')} className="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-4 cursor-pointer hover:border-ink/20 transition-colors">
          <span className={cn('grid h-10 w-10 place-items-center rounded-[10px]', verifyStatus === 'verified' ? 'bg-olive-soft text-olive' : 'bg-majorelle-soft text-majorelle')}>
            {verifyStatus === 'verified' ? <BadgeCheck className="h-5 w-5" strokeWidth={1.7} /> : <ShieldCheck className="h-5 w-5" strokeWidth={1.6} />}
          </span>
          <div className="flex-1 text-left">
            <p className="font-display text-h3 font-medium">{t('profile.verifyTitle')}</p>
            <p className="text-[12px] text-ink-soft">{verifyHint}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-ink-faint" strokeWidth={1.6} />
        </button>

        {/* Admins reach the panel from the top navigation bar (admin-only link). */}
        <button onClick={() => navigate('/pricing')} className="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-4 cursor-pointer hover:border-ink/20 transition-colors">
          <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-saffron-soft text-saffron"><Crown className="h-5 w-5" strokeWidth={1.6} /></span>
          <div className="flex-1 text-left">
            <p className="font-display text-h3 font-medium">{t('profile.plans')}</p>
            <p className="text-[12px] text-ink-soft">{t('profile.plansHint')}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-ink-faint" strokeWidth={1.6} />
        </button>

        <button onClick={() => setLangOpen(true)} className="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-4 cursor-pointer hover:border-ink/20 transition-colors">
          <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-clay-soft text-clay"><Globe className="h-5 w-5" strokeWidth={1.6} /></span>
          <div className="flex-1 text-left">
            <p className="font-display text-h3 font-medium">{t('profile.language')}</p>
            <p className="text-[12px] text-ink-soft">{current.flag} {current.label}</p>
          </div>
          <ChevronRight className="h-5 w-5 text-ink-faint" strokeWidth={1.6} />
        </button>

        <button onClick={toggleTheme} className="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-4 cursor-pointer hover:border-ink/20 transition-colors">
          <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-surface-sunk text-ink-soft">
            {dark ? <Moon className="h-5 w-5" strokeWidth={1.6} /> : <Sun className="h-5 w-5" strokeWidth={1.6} />}
          </span>
          <div className="flex-1 text-left">
            <p className="font-display text-h3 font-medium">{t('profile.theme')}</p>
            <p className="text-[12px] text-ink-soft">{dark ? t('profile.themeDark') : t('profile.themeLight')}</p>
          </div>
          <span className={cn('relative h-6 w-11 rounded-full transition-colors', dark ? 'bg-clay' : 'bg-border')}>
            <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform', dark ? 'translate-x-[22px]' : 'translate-x-0.5')} />
          </span>
        </button>

        <button onClick={toggleEmail} disabled={savingEmail} className="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-4 cursor-pointer hover:border-ink/20 transition-colors disabled:opacity-60">
          <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-majorelle-soft text-majorelle"><Bell className="h-5 w-5" strokeWidth={1.6} /></span>
          <div className="flex-1 text-left">
            <p className="font-display text-h3 font-medium">{t('profile.emailTitle')}</p>
            <p className="text-[12px] text-ink-soft">{t('profile.emailHint')}</p>
          </div>
          <span className={cn('relative h-6 w-11 rounded-full transition-colors', emailOn ? 'bg-clay' : 'bg-border')}>
            <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform', emailOn ? 'translate-x-[22px]' : 'translate-x-0.5')} />
          </span>
        </button>

        <button onClick={() => { logout(); navigate('/'); toast('Logged out', 'info'); }} className="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-4 text-clay cursor-pointer hover:bg-clay-soft transition-colors">
          <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-clay-soft text-clay"><LogOut className="h-5 w-5" strokeWidth={1.6} /></span>
          <p className="flex-1 text-left font-display text-h3 font-medium">{t('profile.logout')}</p>
        </button>

        <p className="pt-4 text-center text-[12px] text-ink-faint">hudlgo · demo build · v0.2.0</p>
      </div>

      <Sheet open={langOpen} onClose={() => setLangOpen(false)} title={t('profile.language')}>
        <div className="space-y-2">
          {LANGUAGES.map((l) => (
            <button key={l.code} onClick={() => { setLanguage(l.code); setLangOpen(false); }} className={cn('flex w-full items-center gap-3 rounded-input border p-4 text-left transition-colors cursor-pointer', i18n.language === l.code ? 'border-clay bg-clay-soft' : 'border-border bg-surface hover:border-ink/20')}>
              <span className="text-2xl">{l.flag}</span>
              <span className="flex-1 font-display text-h3 font-medium">{l.label}</span>
              {i18n.language === l.code && <Check className="h-5 w-5 text-clay" strokeWidth={1.8} />}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
