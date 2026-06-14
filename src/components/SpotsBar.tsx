import { cn } from '@/lib/cn';

interface Props {
  going: number;
  capacity: number;
  minPlayers: number;
  colorHex: string;
  className?: string;
}

/** A capacity bar with a notch marking the min-players confirmation threshold. */
export function SpotsBar({ going, capacity, minPlayers, colorHex, className }: Props) {
  const pct = Math.min(100, (going / capacity) * 100);
  const minPct = minPlayers > 1 ? Math.min(100, (minPlayers / capacity) * 100) : null;
  const confirmed = going >= minPlayers;

  return (
    <div className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-surface-sunk', className)}>
      <div
        className="h-full rounded-full transition-all duration-500 ease-out-soft"
        style={{ width: `${pct}%`, backgroundColor: confirmed ? colorHex : '#D89A34' }}
      />
      {minPct !== null && minPct < 100 && (
        <div
          className="absolute top-1/2 h-2.5 w-[2px] -translate-y-1/2 rounded-full bg-ink/35"
          style={{ left: `${minPct}%` }}
          title={`Confirms at ${minPlayers}`}
        />
      )}
    </div>
  );
}
