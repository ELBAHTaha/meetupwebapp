import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';
import { tokens } from '@/api/http';
import { saveDb } from '@/api/store';

interface SessionState {
  isAuthed: boolean;
  onboarded: boolean;
  user: User | null;
  city: string;
  /** Bumped after any data mutation so feeds know to refetch. */
  dataVersion: number;

  login: (user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  setCity: (city: string) => void;
  completeOnboarding: () => void;
  bumpData: () => void;
}

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      isAuthed: false,
      onboarded: false,
      user: null,
      city: 'Casablanca',
      dataVersion: 0,

      login: (user) => set({ isAuthed: true, user, city: user.city || 'Casablanca' }),
      logout: () => {
        // Drop the backend JWTs alongside the local session.
        tokens.clear();
        set({ isAuthed: false, onboarded: false, user: null });
      },
      setUser: (user) => set({ user }),
      setCity: (city) => set({ city }),
      completeOnboarding: () => set({ onboarded: true }),
      bumpData: () => {
        // Every UI mutation calls this right after the API write completes, so
        // it's the single chokepoint where the db is freshly mutated — persist.
        saveDb();
        set((s) => ({ dataVersion: s.dataVersion + 1 }));
      },
    }),
    {
      name: 'jmaa-session',
      version: 2,
      // Backfill trust & safety fields for sessions persisted by older builds.
      migrate: (persisted) => {
        const s = persisted as Partial<SessionState> | undefined;
        if (s?.user) {
          const u = s.user as User & Partial<User>;
          u.status ??= 'active';
          u.role ??= 'user';
          u.trustScore ??= u.rating ?? 5;
          u.flagCount ??= 0;
          u.lookingFor ??= 'both';
        }
        return s as SessionState;
      },
      partialize: (s) => ({
        isAuthed: s.isAuthed,
        onboarded: s.onboarded,
        user: s.user,
        city: s.city,
      }),
    },
  ),
);
