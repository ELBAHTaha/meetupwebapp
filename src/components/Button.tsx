import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variants: Record<Variant, string> = {
  primary: 'bg-clay text-white hover:bg-clay-press active:bg-clay-press disabled:bg-clay/40',
  secondary: 'bg-olive text-white hover:bg-olive/90 active:bg-olive/90',
  outline: 'bg-surface text-ink border border-border hover:border-ink/30 hover:bg-surface-sunk/50',
  ghost: 'bg-transparent text-ink hover:bg-surface-sunk',
  danger: 'bg-surface text-clay border border-clay/25 hover:bg-clay-soft',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-meta gap-1.5',
  md: 'h-11 px-5 text-[15px] gap-2',
  lg: 'h-[52px] px-6 text-base gap-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading, fullWidth, leftIcon, rightIcon, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center rounded-input font-body font-semibold',
        'transition-all duration-200 ease-out-soft cursor-pointer select-none',
        'active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100',
        variants[variant],
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-[1.1em] w-[1.1em] animate-spin" aria-hidden /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
});
