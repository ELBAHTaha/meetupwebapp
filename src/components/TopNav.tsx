import { NavLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bell, CalendarRange, Compass, Crown, LogOut, MessageCircle, Moon, Plus, ShieldAlert, Sun } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useSession } from '@/store/session';
import { useTheme } from '@/store/theme';
import { useUnreadNotifications } from '@/hooks/useUnreadNotifications';
import { toast } from '@/store/toast';
import { Avatar } from './Avatar';
import { LanguageToggle } from './LanguageToggle';

const baseLinks: { to: string; icon: LucideIcon; key: string }[] = [
  { to: '/discover', icon: Compass, key: 'discover' },
  { to: '/chat', icon: MessageCircle, key: 'chat' },
  { to: '/my-events', icon: CalendarRange, key: 'myEvents' },
  { to: '/pricing', icon: Crown, key: 'plans' },
];

const adminLink = { to: '/admin', icon: ShieldAlert, key: 'admin' };

export function TopNav() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useSession((s) => s.user);
  const logout = useSession((s) => s.logout);
  const theme = useTheme((s) => s.theme);
  const toggleTheme = useTheme((s) => s.toggle);
  const unread = useUnreadNotifications();

  const links = user?.role === 'admin' ? [...baseLinks, adminLink] : baseLinks;

  return (
    <header className="sticky top-0 z-40 hidden border-b border-border bg-bg/85 backdrop-blur-md md:block">
      <div className="mx-auto flex h-16 max-w-shell items-center gap-6 px-6">
        <button onClick={() => navigate('/discover')} className="flex items-center gap-2 cursor-pointer">
          <img src="/jmaa.svg" alt="hudlgo" className="h-8 w-8" />
          <span className="font-display text-h1 font-medium tracking-tight">hudlgo</span>
        </button>

        <nav className="ml-4 flex items-center gap-1">
          {links.map(({ to, icon: Icon, key }) => (
            <NavLink
              key={key}
              to={to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-full px-4 py-2 text-meta font-medium transition-colors',
                  isActive ? 'bg-surface-sunk text-ink' : 'text-ink-soft hover:bg-surface-sunk/60',
                )
              }
            >
              <Icon className="h-4 w-4" strokeWidth={1.6} />
              {t(`nav.${key}`)}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => navigate('/create')}
            className="flex items-center gap-1.5 rounded-input bg-clay px-4 py-2 text-meta font-semibold text-white transition-colors hover:bg-clay-press cursor-pointer"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            {t('nav.create')}
          </button>
          <LanguageToggle />
          <button
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
            className="grid h-10 w-10 place-items-center rounded-full text-ink-soft hover:bg-surface-sunk cursor-pointer"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" strokeWidth={1.6} /> : <Moon className="h-5 w-5" strokeWidth={1.6} />}
          </button>
          <button
            onClick={() => navigate('/notifications')}
            aria-label={t('notifications.title')}
            className="relative grid h-10 w-10 place-items-center rounded-full text-ink-soft hover:bg-surface-sunk cursor-pointer"
          >
            <Bell className="h-5 w-5" strokeWidth={1.6} />
            {unread > 0 && (
              <span className="absolute right-1 top-1 grid min-h-[16px] min-w-[16px] place-items-center rounded-full bg-clay px-1 text-[10px] font-semibold leading-none text-white">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>
          <button onClick={() => navigate('/profile')} className="cursor-pointer" aria-label={t('nav.profile')}>
            {user && <Avatar src={user.avatar} name={user.name} size="sm" verified={user.verified} />}
          </button>
          <button
            onClick={() => { logout(); toast(t('profile.logout'), 'info'); navigate('/login'); }}
            aria-label={t('profile.logout')}
            title={t('profile.logout')}
            className="grid h-10 w-10 place-items-center rounded-full text-ink-soft hover:bg-surface-sunk hover:text-clay cursor-pointer transition-colors"
          >
            <LogOut className="h-5 w-5" strokeWidth={1.6} />
          </button>
        </div>
      </div>
    </header>
  );
}
