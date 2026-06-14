import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { Avatar } from './Avatar';
import { StarRating } from './StarRating';
import { useAsync } from '@/hooks/useAsync';
import { getRateablePeople, submitRating } from '@/api';
import { toast } from '@/store/toast';
import type { Rating } from '@/types';

interface Props {
  eventId: string;
  open: boolean;
  onClose: () => void;
  onDone?: () => void;
}

/** Post-event private rating flow (host rates attendees / attendees rate host). */
export function RatingSheet({ eventId, open, onClose, onDone }: Props) {
  const { t } = useTranslation();
  const { data, loading, reload } = useAsync(
    () => (open ? getRateablePeople(eventId) : Promise.resolve([])),
    [eventId, open],
  );
  const [scores, setScores] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setScores({});
  }, [open, eventId]);

  const people = data ?? [];

  async function save() {
    const entries = people.filter((p) => scores[p.user.id]);
    if (entries.length === 0) {
      onClose();
      return;
    }
    setSaving(true);
    for (const p of entries) {
      await submitRating({ toUserId: p.user.id, activityId: eventId, score: scores[p.user.id], type: p.type as Rating['type'] });
    }
    setSaving(false);
    toast(t('rate.thanks'), 'success');
    reload();
    onDone?.();
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('rate.title')}>
      {loading ? (
        <p className="py-6 text-center text-meta text-ink-soft">{t('common.loading')}</p>
      ) : people.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-meta text-ink-soft">{t('rate.allDone')}</p>
          <Button className="mt-4" onClick={onClose}>{t('common.done')}</Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-meta text-ink-soft">{t('rate.subtitle')}</p>
          {people.map((p) => (
            <div key={p.user.id} className="flex items-center justify-between gap-3 rounded-card border border-border bg-surface p-3">
              <div className="flex items-center gap-3">
                <Avatar src={p.user.avatar} name={p.user.name} size="sm" verified={p.user.verified} />
                <span className="font-display text-h3 font-medium">{p.user.name}</span>
              </div>
              <StarRating value={scores[p.user.id] ?? 0} onChange={(v) => setScores((s) => ({ ...s, [p.user.id]: v }))} size={24} />
            </div>
          ))}
          <p className="text-[12px] text-ink-faint">{t('rate.private')}</p>
          <Button size="lg" fullWidth loading={saving} onClick={save}>{t('rate.submit')}</Button>
        </div>
      )}
    </Sheet>
  );
}
