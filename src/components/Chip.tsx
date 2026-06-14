import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface ChipProps {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  leftIcon?: ReactNode;
  className?: string;
  activeClassName?: string;
}

export function Chip({ children, active, onClick, leftIcon, className, activeClassName }: ChipProps) {
  const interactive = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={interactive ? active : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-meta font-medium',
        'transition-colors duration-200',
        interactive && 'cursor-pointer',
        active
          ? activeClassName ?? 'bg-ink text-bg'
          : 'bg-surface text-ink-soft border border-border hover:border-ink/25',
        className,
      )}
    >
      {leftIcon}
      {children}
    </button>
  );
}

interface TagProps {
  children: ReactNode;
  className?: string;
  leftIcon?: ReactNode;
}

/** Static, non-interactive pill (badges on cards). */
export function Tag({ children, className, leftIcon }: TagProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium',
        className,
      )}
    >
      {leftIcon}
      {children}
    </span>
  );
}
