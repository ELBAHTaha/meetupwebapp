import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogOut, MessageCircle, Plus, Store } from 'lucide-react';
import { Toaster } from '@/components/Toaster';
import { DevelopedBy } from '@/components/DevelopedBy';
import { FeedbackButton } from '@/components/FeedbackButton';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { cn } from '@/lib/cn';

const links = [
  { to: '/business/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/business/chat', icon: MessageCircle, label: 'Chat' },
  { to: '/business/create', icon: Plus, label: 'Host activity' },
  { to: '/business/venue', icon: Store, label: 'Venue' },
];

export function BusinessLayout() {
  const navigate = useNavigate();
  const logout = useSession((s) => s.logout);

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-shell items-center gap-3 px-5 md:px-6">
          <button onClick={() => navigate('/business/dashboard')} className="flex items-center gap-2 cursor-pointer">
            <img src="/jmaa.svg" alt="hudlgo" className="h-8 w-8" />
            <span className="font-display text-h2 font-medium tracking-tight">
              hudlgo <span className="text-clay">Business</span>
            </span>
          </button>

          <nav className="ml-2 flex items-center gap-1">
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
                <span className="hidden sm:inline">{label}</span>
              </NavLink>
            ))}
          </nav>

          <button
            onClick={() => {
              logout();
              toast('Logged out', 'info');
              navigate('/login');
            }}
            aria-label="Log out"
            title="Log out"
            className="ml-auto grid h-10 w-10 place-items-center rounded-full text-ink-soft hover:bg-surface-sunk hover:text-clay cursor-pointer transition-colors"
          >
            <LogOut className="h-5 w-5" strokeWidth={1.6} />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-shell px-5 pb-16 pt-5 md:px-6">
        <Outlet />
        <DevelopedBy className="mt-12" />
      </main>
      <FeedbackButton />
      <Toaster />
    </div>
  );
}
