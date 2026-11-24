import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LayoutDashboard, LogOut, MessageCircle, Plus, Receipt, Store, Ticket } from 'lucide-react';
import { Toaster } from '@/components/Toaster';
import { DevelopedBy } from '@/components/DevelopedBy';
import { FeedbackButton } from '@/components/FeedbackButton';
import { VerifyEmailBanner } from '@/components/VerifyEmailBanner';
import { useLocaleSync } from '@/hooks/useLocaleSync';
import { useRealtimeConnection } from '@/hooks/useRealtime';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { cn } from '@/lib/cn';

const links = [
  { to: '/business/dashboard', icon: LayoutDashboard, label: 'bizNav.dashboard' },
  { to: '/business/chat', icon: MessageCircle, label: 'bizNav.chat' },
  { to: '/business/create', icon: Plus, label: 'bizNav.host' },
  { to: '/business/venue', icon: Store, label: 'bizNav.venue' },
  { to: '/business/redeem', icon: Ticket, label: 'bizNav.redeem' },
  { to: '/business/upgrades', icon: Receipt, label: 'bizNav.plan' },
];

export function BusinessLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const logout = useSession((s) => s.logout);
  useLocaleSync();
  useRealtimeConnection();

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-shell items-center gap-3 px-5 md:px-6">
          <button onClick={() => navigate('/business/dashboard')} className="flex items-center gap-2 cursor-pointer">
            <img src="/jmaa.svg" alt="hudlgo" className="h-8 w-8" />
            <span className="font-display text-h2 font-medium tracking-tight">
              hudlgo <span className="text-clay">{t('bizNav.business')}</span>
            </span>
          </button>

          <nav className="ms-2 flex items-center gap-1">
            {links.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-2 rounded-full px-3.5 py-2 text-meta font-medium transition-colors',
                    isActive ? 'bg-surface-sunk text-ink' : 'text-ink-soft hover:bg-surface-sunk/60',
                  )
                }
              >
                <Icon className="h-4 w-4" strokeWidth={1.6} />
                <span className="hidden sm:inline">{t(label)}</span>
              </NavLink>
            ))}
          </nav>

          <button
            onClick={() => {
              logout();
              toast(t('a11y.loggedOut'), 'info');
              navigate('/login');
            }}
            aria-label={t('a11y.logout')}
            title={t('a11y.logout')}
            className="ml-auto grid h-10 w-10 place-items-center rounded-full text-ink-soft hover:bg-surface-sunk hover:text-clay cursor-pointer transition-colors"
          >
            <LogOut className="h-5 w-5" strokeWidth={1.6} />
          </button>
        </div>
      </header>
      <VerifyEmailBanner />

      <main className="mx-auto w-full max-w-shell px-5 pb-16 pt-5 md:px-6">
        <Outlet />
        <DevelopedBy className="mt-12" />
      </main>
      <FeedbackButton />
      <Toaster />
    </div>
  );
}
