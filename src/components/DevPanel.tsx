import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { FlaskConical } from 'lucide-react';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { devTriggerLifecycle, type DevPhase } from '@/api';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';

/**
 * Dev-only control to fast-forward the activity lifecycle (reminders, start,
 * completion → ratings) without waiting for real time to pass.
 */
export function DevPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const bumpData = useSession((s) => s.bumpData);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<DevPhase | null>(null);

  async function run(phase: DevPhase, goTo?: string) {
    setBusy(phase);
    const msg = await devTriggerLifecycle(phase);
    bumpData();
    setBusy(null);
    setOpen(false);
    toast(msg, 'info');
    if (goTo) navigate(goTo);
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t('dev.open')}
        className="fixed bottom-24 left-4 z-40 flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-2 text-[12px] font-semibold text-ink-soft shadow-e1 cursor-pointer md:bottom-6"
      >
        <FlaskConical className="h-4 w-4 text-clay" strokeWidth={1.7} />
        {t('dev.open')}
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={t('dev.title')}>
        <div className="space-y-3">
          <p className="text-meta text-ink-soft">{t('dev.subtitle')}</p>
          <Button fullWidth variant="outline" loading={busy === 'reminders'} onClick={() => run('reminders', '/notifications')}>
            {t('dev.reminders')}
          </Button>
          <Button fullWidth variant="outline" loading={busy === 'startMine'} onClick={() => run('startMine')}>
            {t('dev.startMine')}
          </Button>
          <Button fullWidth variant="outline" loading={busy === 'endMine'} onClick={() => run('endMine', '/notifications')}>
            {t('dev.endMine')}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
