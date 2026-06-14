import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/cn';

interface SheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  variant?: 'bottom' | 'center';
}

export function Sheet({ open, onClose, title, children, variant = 'bottom' }: SheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-ink/40 animate-fade" onClick={onClose} />
      <div
        className={cn(
          'relative z-10 mx-auto w-full border border-border bg-surface shadow-e1',
          variant === 'bottom'
            ? 'mt-auto max-w-app rounded-t-sheet animate-sheet-up max-h-[88vh]'
            : 'm-auto max-w-md rounded-sheet animate-fade-in max-h-[88vh]',
          'flex flex-col',
        )}
      >
        <div className="relative flex items-center justify-between px-5 pt-5 pb-2">
          {variant === 'bottom' && (
            <div className="absolute left-1/2 top-2.5 h-1 w-9 -translate-x-1/2 rounded-full bg-border" />
          )}
          <h2 className="font-display text-h2 font-medium text-ink">{title}</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="grid h-9 w-9 place-items-center rounded-full text-ink-soft hover:bg-surface-sunk cursor-pointer"
          >
            <X className="h-5 w-5" strokeWidth={1.5} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 pb-7 pt-1">{children}</div>
      </div>
    </div>
  );
}
