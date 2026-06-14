import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface Props {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  className?: string;
  /** Show the quiet geometric motif rule under the title. */
  motif?: boolean;
}

export function SectionHeader({ title, subtitle, action, className, motif }: Props) {
  return (
    <div className={cn('mb-4', className)}>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-h2 font-medium text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-meta text-ink-soft">{subtitle}</p>}
        </div>
        {action}
      </div>
      {motif && <div className="motif-rule mt-3 w-16 rounded-full" />}
    </div>
  );
}
