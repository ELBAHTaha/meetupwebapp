import { useState, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ImageIcon } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props {
  src: string;
  alt: string;
  /** Line icon shown in the fallback tonal block. */
  icon?: LucideIcon;
  /** Apply a bottom-up scrim (for text over the image). */
  scrim?: boolean | 'strong';
  /** Gentle zoom on hover when the parent has `group`. */
  zoomOnHover?: boolean;
  rounded?: boolean;
  className?: string;
  children?: ReactNode;
}

/**
 * Photography component. Standardized object-cover image with a warm tonal
 * fallback (block + centered line icon) if the source fails — so the design
 * never shows a broken image and always reads as intentional.
 */
export function SmartImage({
  src,
  alt,
  icon: Icon = ImageIcon,
  scrim,
  zoomOnHover,
  rounded = true,
  className,
  children,
}: Props) {
  const [failed, setFailed] = useState(false);

  return (
    <div className={cn('relative overflow-hidden bg-surface-sunk', rounded && 'rounded-image', className)}>
      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-sunk to-border">
          <Icon className="h-8 w-8 text-ink-faint" strokeWidth={1.5} aria-hidden />
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className={cn(
            'h-full w-full object-cover transition-transform duration-300 ease-out-soft',
            zoomOnHover && 'group-hover:scale-[1.03]',
          )}
        />
      )}
      {scrim && !failed && (
        <div
          className={cn(
            'pointer-events-none absolute inset-0',
            scrim === 'strong' ? 'bg-scrim-strong' : 'bg-scrim',
          )}
        />
      )}
      {children}
    </div>
  );
}
