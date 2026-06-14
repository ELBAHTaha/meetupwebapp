import { Check, Info, X } from 'lucide-react';
import { useToast } from '@/store/toast';
import { cn } from '@/lib/cn';

const icons = { success: Check, info: Info, error: X };

export function Toaster() {
  const toasts = useToast((s) => s.toasts);

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] mx-auto flex max-w-app flex-col items-center gap-2 px-5 md:bottom-8">
      {toasts.map((t) => {
        const Icon = icons[t.tone];
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex items-center gap-2.5 rounded-input px-4 py-3 text-meta font-medium shadow-e1 animate-fade-in',
              t.tone === 'success' && 'bg-olive text-white',
              t.tone === 'info' && 'bg-ink text-bg',
              t.tone === 'error' && 'bg-clay text-white',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" strokeWidth={1.8} />
            {t.message}
          </div>
        );
      })}
    </div>
  );
}
