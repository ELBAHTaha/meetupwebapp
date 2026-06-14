import { Outlet } from 'react-router-dom';
import { BottomTabBar } from './BottomTabBar';
import { TopNav } from './TopNav';
import { Toaster } from './Toaster';
import { DevPanel } from './DevPanel';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-bg">
      <TopNav />
      {/* Mobile: single column max-w-app. Desktop: centered shell. */}
      <main className="mx-auto w-full max-w-app pb-24 md:max-w-shell md:px-6 md:pb-10 md:pt-2">
        <Outlet />
      </main>
      <BottomTabBar />
      <Toaster />
      <DevPanel />
    </div>
  );
}
