import { Outlet } from 'react-router-dom';
import { BottomTabBar } from './BottomTabBar';
import { TopNav } from './TopNav';
import { Toaster } from './Toaster';
import { DevPanel } from './DevPanel';
import { DevelopedBy } from './DevelopedBy';
import { FeedbackButton } from './FeedbackButton';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-bg">
      <TopNav />
      {/* Mobile: single column max-w-app. Desktop: centered shell. */}
      <main className="mx-auto w-full max-w-app pb-24 md:max-w-shell md:px-6 md:pb-10 md:pt-2">
        <Outlet />
        <DevelopedBy className="mt-10 px-6 pb-2" />
      </main>
      <BottomTabBar />
      <FeedbackButton />
      <Toaster />
      {/* Dev-only lifecycle controls — never shipped in production builds. */}
      {import.meta.env.DEV && <DevPanel />}
    </div>
  );
}
