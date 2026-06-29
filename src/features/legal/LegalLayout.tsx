import { Link } from 'react-router-dom';
import { DevelopedBy } from '@/components/DevelopedBy';
import { cn } from '@/lib/cn';

/**
 * Single source of truth for the facts that appear across the legal pages.
 *
 * ⚠️ Review every value below before submitting these URLs to Paddle — Paddle's
 * compliance team reads these pages and rejects placeholder text. Replace the
 * domain, contact email and legal entity with your real details.
 */
export const LEGAL = {
  brand: 'hudlgo',
  /** The legal entity that operates hudlgo — your registered company name, or
   *  your full legal name if you trade as a sole proprietor. */
  entity: 'hudlgo',
  /** Public contact inbox. Paddle's reviewers (and customers) will email this. */
  email: 'support@hudlgo.com',
  /** Your production domain, without the protocol. */
  domain: 'hudlgo.com',
  /** Country whose law governs these terms / where you are established. */
  jurisdiction: 'Morocco',
  /** Shown as the "last updated" line on every page. */
  effectiveDate: '29 June 2026',
} as const;

const LINKS = [
  { to: '/terms', label: 'Terms of Service' },
  { to: '/privacy', label: 'Privacy Policy' },
  { to: '/refunds', label: 'Refund Policy' },
] as const;

/** Shared chrome (header + readable column + footer) for all legal pages. */
export function LegalLayout({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-bg">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-shell items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-2">
            <img src="/jmaa.svg" alt="" className="h-8 w-8" />
            <span className="font-display text-h2 font-medium tracking-tight text-ink">{LEGAL.brand}</span>
          </Link>
          <Link to="/" className="text-meta font-semibold text-clay hover:text-clay-press transition-colors">
            ← Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
        <h1 className="font-display text-display font-medium leading-[1.08] text-ink">{title}</h1>
        <p className="mt-2 text-meta text-ink-faint">Last updated: {LEGAL.effectiveDate}</p>
        <div className="mt-8 space-y-8">{children}</div>

        <div className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-6 text-meta font-medium text-ink-soft">
          {LINKS.map((l) => (
            <Link key={l.to} to={l.to} className="hover:text-ink">
              {l.label}
            </Link>
          ))}
        </div>
      </main>

      <footer className="border-t border-border bg-surface py-4">
        <p className="text-center text-[12px] text-ink-faint">
          © {new Date().getFullYear()} {LEGAL.brand} · All rights reserved.
        </p>
        <DevelopedBy className="mt-1.5" />
      </footer>
    </div>
  );
}

/** A titled section of legal copy. */
export function Section({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-h1 font-medium text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

/** Bulleted list with the project's spacing. */
export function List({ items, className }: { items: React.ReactNode[]; className?: string }) {
  return (
    <ul className={cn('ms-5 list-disc space-y-1.5', className)}>
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
