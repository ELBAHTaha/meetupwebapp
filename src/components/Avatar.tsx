import { BadgeCheck } from 'lucide-react';
import { cn } from '@/lib/cn';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const sizes: Record<Size, string> = {
  xs: 'h-6 w-6',
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-16 w-16',
  xl: 'h-24 w-24',
};

interface Props {
  src: string;
  name: string;
  size?: Size;
  verified?: boolean;
  ring?: boolean;
  className?: string;
}

export function Avatar({ src, name, size = 'md', verified, ring, className }: Props) {
  return (
    <div className={cn('relative shrink-0', className)}>
      <img
        src={src}
        alt={name}
        loading="lazy"
        className={cn('rounded-full bg-surface-sunk object-cover', ring && 'ring-2 ring-surface', sizes[size])}
      />
      {verified && (
        <BadgeCheck
          className={cn(
            'absolute -bottom-0.5 -right-0.5 rounded-full bg-surface text-majorelle',
            size === 'xl' || size === 'lg' ? 'h-6 w-6' : 'h-4 w-4',
          )}
          strokeWidth={1.8}
          aria-label="Verified"
        />
      )}
    </div>
  );
}

interface StackProps {
  users: { id: string; avatar: string; name: string }[];
  max?: number;
  size?: Size;
}

export function AvatarStack({ users, max = 5, size = 'sm' }: StackProps) {
  const shown = users.slice(0, max);
  const extra = users.length - shown.length;
  return (
    <div className="flex items-center">
      <div className="flex -space-x-2.5">
        {shown.map((u) => (
          <Avatar key={u.id} src={u.avatar} name={u.name} size={size} ring />
        ))}
      </div>
      {extra > 0 && <span className="ml-2 text-meta font-medium text-ink-soft">+{extra}</span>}
    </div>
  );
}
