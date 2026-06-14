import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}

export function EmptyState({ icon: Icon, title, hint, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center animate-fade-in">
      <div className="grid h-16 w-16 place-items-center rounded-card border border-border bg-surface">
        <Icon className="h-7 w-7 text-ink-faint" strokeWidth={1.5} />
      </div>
      <div className="motif-rule mt-5 w-12 rounded-full" />
      <h3 className="mt-4 font-display text-h2 font-medium text-ink">{title}</h3>
      {hint && <p className="mt-1.5 max-w-xs text-meta text-ink-soft">{hint}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
