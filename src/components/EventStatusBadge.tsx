import { useTranslation } from 'react-i18next';
import { Check, Clock, Users } from 'lucide-react';
import type { EnrichedEvent } from '@/types';
import { Tag } from './Chip';

export function neededToConfirm(e: Pick<EnrichedEvent, 'goingCount' | 'minPlayers'>): number {
  return Math.max(0, e.minPlayers - e.goingCount);
}

interface Props {
  event: EnrichedEvent;
}

export function EventStatusBadge({ event }: Props) {
  const { t } = useTranslation();

  if (event.status === 'PAST') {
    return <Tag className="bg-surface-sunk text-ink-faint">{t('event.past')}</Tag>;
  }
  if (event.status === 'FULL') {
    return (
      <Tag className="bg-ink text-bg" leftIcon={<Users className="h-3.5 w-3.5" strokeWidth={1.6} />}>
        {t('event.full')}
      </Tag>
    );
  }
  if (event.status === 'PENDING' && event.minPlayers > 1) {
    return (
      <Tag className="bg-saffron-soft text-saffron" leftIcon={<Clock className="h-3.5 w-3.5" strokeWidth={1.6} />}>
        {t('event.needsMore', { count: neededToConfirm(event) })}
      </Tag>
    );
  }
  if (event.status === 'CONFIRMED') {
    return (
      <Tag className="bg-olive-soft text-olive" leftIcon={<Check className="h-3.5 w-3.5" strokeWidth={2} />}>
        {t('event.confirmed')}
      </Tag>
    );
  }
  return null;
}
