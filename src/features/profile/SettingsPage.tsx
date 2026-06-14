import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ChevronRight, Crown, Globe, LogOut, Moon, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Sheet } from '@/components/Sheet';
import { useSession } from '@/store/session';
import { LANGUAGES, setLanguage } from '@/i18n';
import { toast } from '@/store/toast';
import { cn } from '@/lib/cn';

export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const logout = useSession((s) => s.logout);
  const user = useSession((s) => s.user);
  const [langOpen, setLangOpen] = useState(false);

  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  return (
    <div>
      <PageHeader back title={t('profile.settings')} />
      <div className="mx-auto max-w-app space-y-2.5 px-5 pt-4 md:max-w-md md:px-0">
        {user?.role === 'admin' && (
          <button onClick={() => navigate('/admin')} className="flex w-full items-center gap-3 rounded-card border border-clay/30 bg-clay-soft p-4 cursor-pointer hover:border-clay/50 transition-colors">
            <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-clay text-white"><ShieldAlert className="h-5 w-5" strokeWidth={1.6} /></span>
            <div className="flex-1 text-left">
              <p className="font-display text-h3 font-medium">{t('profile.adminPanel')}</p>
              <p className="text-[12px] text-ink-soft">{t('admin.subtitle')}</p>
            </div>
            <ChevronRight className="h-5 w-5 text-ink-faint" strokeWidth={1.6} />
          </button>
        )}
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

        <div className="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-4">
          <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-surface-sunk text-ink-soft"><Moon className="h-5 w-5" strokeWidth={1.6} /></span>
          <div className="flex-1 text-left">
            <p className="font-display text-h3 font-medium">{t('profile.theme')}</p>
            <p className="text-[12px] text-ink-soft">{t('common.comingSoon')}</p>
          </div>
        </div>

        <button onClick={() => { logout(); navigate('/'); toast('Logged out', 'info'); }} className="flex w-full items-center gap-3 rounded-card border border-border bg-surface p-4 text-clay cursor-pointer hover:bg-clay-soft transition-colors">
          <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-clay-soft text-clay"><LogOut className="h-5 w-5" strokeWidth={1.6} /></span>
          <p className="flex-1 text-left font-display text-h3 font-medium">{t('profile.logout')}</p>
        </button>

        <p className="pt-4 text-center text-[12px] text-ink-faint">Jmaâ · demo build · v0.2.0</p>
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
