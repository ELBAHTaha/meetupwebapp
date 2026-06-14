import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props {
  value: number;
  onChange?: (v: number) => void;
  size?: number;
  readOnly?: boolean;
}

/** Interactive 1–5 star control (also renders read-only). */
export function StarRating({ value, onChange, size = 28, readOnly }: Props) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div className="flex items-center gap-1.5" role={readOnly ? undefined : 'radiogroup'}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onMouseEnter={() => !readOnly && setHover(n)}
          onMouseLeave={() => !readOnly && setHover(0)}
          onClick={() => onChange?.(n)}
          className={cn('transition-transform', !readOnly && 'cursor-pointer hover:scale-110')}
        >
          <Star
            style={{ width: size, height: size }}
            className={n <= shown ? 'fill-saffron text-saffron' : 'text-border'}
            strokeWidth={1.5}
          />
        </button>
      ))}
    </div>
  );
}
