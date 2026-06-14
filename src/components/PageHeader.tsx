import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props {
  title?: string;
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
  transparent?: boolean;
}

export function PageHeader({ title, back, onBack, right, transparent }: Props) {
  const navigate = useNavigate();
  return (
    <header
      className={cn(
        'sticky top-0 z-30 flex h-14 items-center gap-2 px-4 md:top-16',
        transparent ? 'bg-transparent' : 'border-b border-border bg-bg/90 backdrop-blur-md',
      )}
    >
      {back && (
        <button
          onClick={() => (onBack ? onBack() : navigate(-1))}
          aria-label="Back"
          className={cn(
            'grid h-10 w-10 place-items-center rounded-full cursor-pointer transition-colors',
            transparent ? 'border border-border bg-surface/90 backdrop-blur' : 'hover:bg-surface-sunk',
          )}
        >
          <ChevronLeft className="h-5 w-5" strokeWidth={1.6} />
        </button>
      )}
      {title && <h1 className="font-display text-h2 font-medium text-ink">{title}</h1>}
      <div className="ml-auto flex items-center gap-1">{right}</div>
    </header>
  );
}
