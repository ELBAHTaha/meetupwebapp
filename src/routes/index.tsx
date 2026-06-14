import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { useSession } from '@/store/session';
import { LandingPage } from '@/features/auth/LandingPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { SignupPage } from '@/features/auth/SignupPage';
import { OnboardingPage } from '@/features/auth/OnboardingPage';
import { DiscoverPage } from '@/features/discover/DiscoverPage';
import { MapPage } from '@/features/map/MapPage';
import { CreateEventPage } from '@/features/create/CreateEventPage';
import { ChatListPage } from '@/features/chat/ChatListPage';
import { ChatThreadPage } from '@/features/chat/ChatThreadPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { SettingsPage } from '@/features/profile/SettingsPage';
import { EditProfilePage } from '@/features/profile/EditProfilePage';
import { EventDetailPage } from '@/features/event/EventDetailPage';
import { UserProfilePage } from '@/features/profile/UserProfilePage';
import { NotificationsPage } from '@/features/notifications/NotificationsPage';
import { AdminPage } from '@/features/admin/AdminPage';
import { MyEventsPage } from '@/features/myevents/MyEventsPage';
import { NotFoundPage } from '@/features/misc/NotFoundPage';
import { PricingPage } from '@/features/monetization/PricingPage';
import { BusinessPage } from '@/features/monetization/BusinessPage';

function Protected({ children }: { children: React.ReactNode }) {
  const { isAuthed, onboarded } = useSession.getState();
  if (!isAuthed) return <Navigate to="/login" replace />;
  if (!onboarded) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: React.ReactNode }) {
  const { isAuthed, onboarded } = useSession.getState();
  if (isAuthed && onboarded) return <Navigate to="/discover" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/landing', element: <PublicOnly><LandingPage /></PublicOnly> },
  { path: '/login', element: <PublicOnly><LoginPage /></PublicOnly> },
  { path: '/signup', element: <PublicOnly><SignupPage /></PublicOnly> },
  { path: '/onboarding', element: <OnboardingPage /> },
  // Public: businesses can register/sponsor without a user account (the signup
  // page links here). Renders standalone — no app nav chrome required.
  { path: '/business', element: <BusinessPage /> },
  {
    element: (
      <Protected>
        <AppLayout />
      </Protected>
    ),
    children: [
      { path: '/discover', element: <DiscoverPage /> },
      { path: '/map', element: <MapPage /> },
      { path: '/create', element: <CreateEventPage /> },
      { path: '/chat', element: <ChatListPage /> },
      { path: '/chat/:threadId', element: <ChatThreadPage /> },
      { path: '/profile', element: <ProfilePage /> },
      { path: '/profile/edit', element: <EditProfilePage /> },
      { path: '/settings', element: <SettingsPage /> },
      { path: '/event/:id', element: <EventDetailPage /> },
      { path: '/user/:id', element: <UserProfilePage /> },
      { path: '/my-events', element: <MyEventsPage /> },
      { path: '/notifications', element: <NotificationsPage /> },
      { path: '/admin', element: <AdminPage /> },
      { path: '/pricing', element: <PricingPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
