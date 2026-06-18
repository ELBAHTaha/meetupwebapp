import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass, MessageCircle, Plus, User } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Tab {
  to: string;
  icon: LucideIcon;
  key: string;
  center?: boolean;
}

const tabs: Tab[] = [
  { to: '/discover', icon: Compass, key: 'discover' },
  { to: '/create', icon: Plus, key: 'create', center: true },
  { to: '/chat', icon: MessageCircle, key: 'chat' },
  { to: '/profile', icon: User, key: 'profile' },
];

export function BottomTabBar() {
  const { t } = useTranslation();
  const { pathname } = useLocation();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-app border-t border-border bg-bg/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Primary"
    >
      <div className="flex items-stretch justify-around px-2 pt-1.5 pb-1">
        {tabs.map(({ to, icon: Icon, key, center }) => {
          const active = pathname.startsWith(to);
          if (center) {
            return (
              <NavLink key={key} to={to} aria-label={t(`nav.${key}`)} className="flex flex-1 items-center justify-center">
                <span className="grid h-11 w-11 -translate-y-2 place-items-center rounded-input bg-clay text-white transition-transform duration-200 active:scale-90">
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </span>
              </NavLink>
            );
          }
          return (
            <NavLink
              key={key}
              to={to}
              className={cn(
                'flex flex-1 flex-col items-center gap-1 rounded-input py-1.5 transition-colors',
                active ? 'text-clay' : 'text-ink-faint hover:text-ink-soft',
              )}
            >
              <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2 : 1.5} />
              <span className="text-[10px] font-medium">{t(`nav.${key}`)}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
