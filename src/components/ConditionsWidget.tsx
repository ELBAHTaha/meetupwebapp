import { useTranslation } from 'react-i18next';
import { Droplet, Thermometer, Timer, Waves, Wind } from 'lucide-react';
import type { Conditions } from '@/types';
import { Skeleton } from './Skeleton';

interface Props {
  conditions: Conditions | null;
  loading?: boolean;
  compact?: boolean;
}

function Metric({ icon: Icon, label, value }: { icon: typeof Wind; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-ink-faint" strokeWidth={1.5} />
      <span className="text-meta text-ink-soft">{label}</span>
      <span className="text-meta font-semibold text-ink">{value}</span>
    </div>
  );
}

export function ConditionsWidget({ conditions, loading, compact }: Props) {
  const { t } = useTranslation();
  if (loading) return <Skeleton className="h-12 w-full rounded-card" />;
  if (!conditions) return null;

  const { fields } = conditions;
  const summary = fields.summaryKey ? t(`conditions.summary.${fields.summaryKey}`, fields.summary) : fields.summary;

  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-majorelle-soft px-2.5 py-1 text-[12px] font-medium text-majorelle">
        <Waves className="h-3.5 w-3.5" strokeWidth={1.6} />
        {summary}
      </span>
    );
  }

  // Quiet inline strip — not a loud box.
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-card border border-border bg-surface px-4 py-3">
      <span className="text-meta font-semibold text-ink">{summary}</span>
      <div className="h-4 w-px bg-border" />
      {fields.swellM !== undefined && <Metric icon={Waves} label={t('conditions.swell')} value={`${fields.swellM} m`} />}
      {fields.wavePeriodS !== undefined && <Metric icon={Timer} label={t('conditions.period')} value={`${fields.wavePeriodS} s`} />}
      {fields.windKts !== undefined && <Metric icon={Wind} label={t('conditions.wind')} value={`${fields.windKts} kt`} />}
      {fields.tempC !== undefined && <Metric icon={Thermometer} label={t('conditions.air')} value={`${fields.tempC}°`} />}
      {fields.waterTempC !== undefined && <Metric icon={Droplet} label={t('conditions.water')} value={`${fields.waterTempC}°`} />}
      {conditions.source === 'open-meteo' && (
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="ms-auto text-[11px] text-ink-faint hover:underline">
          {t('conditions.source')}
        </a>
      )}
    </div>
  );
}
