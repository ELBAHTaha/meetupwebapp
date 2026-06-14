import { useTranslation } from 'react-i18next';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import type { ActivityGroup, EventFilters, Vibe } from '@/types';
import { GROUP_LABELS } from '@/api/catalog';
import { VIBE_LABEL } from '@/lib/collections';
import { cn } from '@/lib/cn';

interface Props {
  open: boolean;
  onClose: () => void;
  filters: EventFilters;
  onChange: (f: EventFilters) => void;
  onReset: () => void;
}

const dates: { key: NonNullable<EventFilters['date']>; label: string }[] = [
  { key: 'any', label: 'filters.any' },
  { key: 'today', label: 'filters.today' },
  { key: 'tomorrow', label: 'filters.tomorrow' },
  { key: 'week', label: 'filters.week' },
];

const groups: ActivityGroup[] = ['sport', 'outdoor', 'social'];
const vibes: Vibe[] = ['chill', 'active'];

export function FilterSheet({ open, onClose, filters, onChange, onReset }: Props) {
  const { t } = useTranslation();
  const set = (patch: Partial<EventFilters>) => onChange({ ...filters, ...patch });

  return (
    <Sheet open={open} onClose={onClose} title={t('filters.title')}>
      <div className="space-y-6">
        <Section title={t('filters.group')}>
          <Chip active={!filters.group} onClick={() => set({ group: undefined })} activeClassName="bg-clay text-white">
            {t('filters.any')}
          </Chip>
          {groups.map((g) => (
            <Chip key={g} active={filters.group === g} onClick={() => set({ group: g })} activeClassName="bg-clay text-white">
              {GROUP_LABELS[g]}
            </Chip>
          ))}
        </Section>

        <Section title={t('filters.vibe')}>
          <Chip active={!filters.vibe} onClick={() => set({ vibe: undefined })} activeClassName="bg-clay text-white">
            {t('filters.any')}
          </Chip>
          {vibes.map((v) => (
            <Chip key={v} active={filters.vibe === v} onClick={() => set({ vibe: v })} activeClassName="bg-clay text-white">
              {VIBE_LABEL[v]}
            </Chip>
          ))}
        </Section>

        <Section title={t('filters.date')}>
          {dates.map((d) => (
            <Chip key={d.key} active={(filters.date ?? 'any') === d.key} onClick={() => set({ date: d.key })} activeClassName="bg-clay text-white">
              {t(d.label)}
            </Chip>
          ))}
        </Section>

        <div className="space-y-3">
          <Toggle label={t('filters.openSpots')} on={!!filters.openSpotsOnly} onToggle={() => set({ openSpotsOnly: !filters.openSpotsOnly })} />
          <Toggle label={t('filters.travelers')} on={!!filters.travelersOnly} onToggle={() => set({ travelersOnly: !filters.travelersOnly })} />
        </div>

        <div className="flex gap-3 pt-1">
          <Button variant="outline" size="lg" onClick={onReset}>
            {t('filters.reset')}
          </Button>
          <Button size="lg" fullWidth onClick={onClose}>
            {t('filters.apply')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 text-meta font-semibold text-ink">{title}</h3>
      <div className="flex flex-wrap gap-2">{children}</div>
    </section>
  );
}

function Toggle({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex w-full items-center justify-between rounded-input border border-border bg-surface px-4 py-3.5 cursor-pointer">
      <span className="text-[15px] font-medium text-ink">{label}</span>
      <span className={cn('relative h-6 w-11 rounded-full transition-colors duration-200', on ? 'bg-clay' : 'bg-border')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform duration-200', on ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </span>
    </button>
  );
}
