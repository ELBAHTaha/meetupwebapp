import { create } from 'zustand';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'jmaa-theme';

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches;
}

function initialTheme(): Theme {
  const stored = typeof localStorage !== 'undefined' ? (localStorage.getItem(STORAGE_KEY) as Theme | null) : null;
  return stored ?? (systemPrefersDark() ? 'dark' : 'light');
}

/** Toggle the `.dark` class on <html>; CSS variables do the rest. */
function apply(theme: Theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

const startTheme = initialTheme();
apply(startTheme); // run once on module load so the app boots in the right theme

interface ThemeState {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggle: () => void;
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: startTheme,
  setTheme: (theme) => {
    apply(theme);
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, theme);
    set({ theme });
  },
  toggle: () => get().setTheme(get().theme === 'dark' ? 'light' : 'dark'),
}));
