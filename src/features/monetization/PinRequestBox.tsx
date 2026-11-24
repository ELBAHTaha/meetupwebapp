import { useTranslation } from 'react-i18next';
import { Crown, Zap } from 'lucide-react';
import type { PriorityLevel } from '@/types';
import { cn } from '@/lib/cn';
import { PINNED_ACTIVITY_MAD, formatMad } from './pricing';

/**
 * Create-flow choice between a normal activity and a pinned one. Pins are paid
 * offline: choosing "pinned" files a request on publish, and the host gets the
 * payment instructions + reference. When the free daily activity is used up,
 * the only option is an extra activity that goes live (pinned) once paid.
 */
export function PinRequestBox({
  value,
  freeAvailable,
  onChange,
}: {
  value: PriorityLevel;
  /** True when the host still has today's free activity. */
  freeAvailable: boolean;
  onChange: (priority: PriorityLevel) => void;
}) {
  const { t } = useTranslation();
  const price = formatMad(PINNED_ACTIVITY_MAD);
  const options: { id: PriorityLevel; title: string; copy: string; price: string }[] = freeAvailable
    ? [
        { id: 'standard', title: t('pin.freeTitle'), copy: t('pin.freeCopy'), price: t('pin.free') },
        { id: 'priority', title: t('pin.pinnedTitle'), copy: t('pin.pinnedCopy'), price },
      ]
    : [{ id: 'priority', title: t('pin.extraTitle'), copy: t('pin.extraCopy'), price }];

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-display text-h3 font-medium">{freeAvailable ? t('pin.visibilityTitle') : t('pin.extraHeading')}</p>
          <p className="text-meta text-ink-soft">{options.find((o) => o.id === value)?.copy ?? t('pin.choose')}</p>
        </div>
        {value === 'priority' ? <Crown className="h-5 w-5 text-saffron" /> : <Zap className="h-5 w-5 text-clay" />}
      </div>
      <div className="mt-3 grid gap-2">
        {options.map((item) => (
          <button
            key={item.id}
            onClick={() => onChange(item.id)}
            className={cn(
              'flex items-center justify-between gap-3 rounded-input border px-3 py-2.5 text-start transition-colors cursor-pointer',
              value === item.id ? 'border-clay bg-clay-soft' : 'border-border bg-bg',
            )}
          >
            <span>
              <span className="block text-meta font-semibold text-ink">{item.title}</span>
              <span className="block text-[12px] text-ink-soft">{item.copy}</span>
            </span>
            <span className="shrink-0 text-meta font-semibold text-ink">{item.price}</span>
          </button>
        ))}
      </div>
      {value === 'priority' && <p className="mt-2 text-[12px] text-ink-faint">{t('pin.offlineNote')}</p>}
    </div>
  );
}
