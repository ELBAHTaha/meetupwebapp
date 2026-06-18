import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { LANGUAGES, setLanguage } from '@/i18n';
import { cn } from '@/lib/cn';

/** Compact language switcher: a flag button that opens a small dropdown. */
export function LanguageToggle({ className }: { className?: string }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Change language"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full px-3 py-2 text-meta font-medium text-ink-soft transition-colors hover:bg-surface-sunk cursor-pointer"
      >
        <span className="text-base leading-none">{current.flag}</span>
        <span className="uppercase">{current.code}</span>
      </button>

      {open && (
        <div className="absolute end-0 z-50 mt-1 w-44 overflow-hidden rounded-card border border-border bg-surface p-1 shadow-[0_8px_30px_rgba(43,38,32,.14)]">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => { setLanguage(l.code); setOpen(false); }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-input px-3 py-2 text-left text-meta transition-colors cursor-pointer',
                i18n.language === l.code ? 'bg-clay-soft text-ink' : 'text-ink-soft hover:bg-surface-sunk',
              )}
            >
              <span className="text-base leading-none">{l.flag}</span>
              <span className="flex-1 font-medium">{l.label}</span>
              {i18n.language === l.code && <Check className="h-4 w-4 text-clay" strokeWidth={1.8} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
