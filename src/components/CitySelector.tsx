import { useEffect, useRef, useState } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import { CITIES } from '@/api/catalog';
import { cn } from '@/lib/cn';

interface Props {
  city: string;
  onChange: (city: string) => void;
}

export function CitySelector({ city, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click or Escape — standard dropdown dismissal.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-ink cursor-pointer"
      >
        <MapPin className="h-4 w-4 text-clay" strokeWidth={1.6} />
        <span className="font-display text-h3 font-medium">{city}</span>
        <ChevronDown
          className={cn('h-4 w-4 text-ink-faint transition-transform duration-200', open && 'rotate-180')}
          strokeWidth={1.6}
        />
      </button>

      {/* Dropdown — drops down from the arrow (fade-in eases down 6px). */}
      {open && (
        <div
          role="listbox"
          aria-label="Choose a city"
          className="absolute left-0 top-full z-30 mt-2 w-[min(20rem,calc(100vw-2.5rem))] origin-top rounded-card border border-border bg-surface p-2 shadow-e1 animate-fade-in"
        >
          <div className="grid grid-cols-2 gap-1.5">
            {CITIES.map((c) => {
              const active = city === c.name;
              return (
                <button
                  key={c.id}
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(c.name);
                    setOpen(false);
                  }}
                  className={cn(
                    'flex items-center gap-2 rounded-input border p-2.5 text-left text-meta font-medium transition-colors cursor-pointer',
                    active
                      ? 'border-clay bg-clay-soft text-clay'
                      : 'border-transparent text-ink-soft hover:border-border hover:bg-surface-sunk',
                  )}
                >
                  <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
                  <span className="truncate">{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
