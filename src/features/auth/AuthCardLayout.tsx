import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { DevelopedBy } from '@/components/DevelopedBy';
import { LanguageToggle } from '@/components/LanguageToggle';

/**
 * Minimal centered-card shell for the standalone account pages (forgot / reset
 * password, verify email). Public routes — works signed in or out.
 */
export function AuthCardLayout({ icon, title, subtitle, children }: {
  icon: ReactNode;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg">
      <header className="mx-auto flex w-full max-w-app items-center justify-between px-5 pt-6">
        <Link to="/" className="flex items-center gap-2">
          <img src="/jmaa.svg" alt="hudlgo" className="h-8 w-8" />
          <span className="font-display text-h2 font-medium tracking-tight text-ink">hudlgo</span>
        </Link>
        <LanguageToggle />
      </header>

      <main className="mx-auto flex w-full max-w-app flex-1 flex-col justify-center px-5 py-10">
        <div className="rounded-[24px] border border-border bg-surface px-6 pb-8 pt-7 animate-fade-in">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-clay-soft text-clay">{icon}</div>
          <h1 className="mt-4 font-display text-h1 font-medium text-ink">{title}</h1>
          {subtitle && <p className="mt-1.5 text-meta leading-relaxed text-ink-soft">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
      </main>

      <DevelopedBy className="pb-6" />
    </div>
  );
}
