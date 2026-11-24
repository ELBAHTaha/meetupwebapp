import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Ban } from 'lucide-react';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { blockUser } from '@/api';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';

/** Confirmation before blocking someone (used on profiles and in chat). */
export function BlockUserSheet({
  open,
  onClose,
  user,
  onBlocked,
}: {
  open: boolean;
  onClose: () => void;
  user: { id: string; name: string } | null;
  onBlocked?: () => void;
}) {
  const { t } = useTranslation();
  const bumpData = useSession((s) => s.bumpData);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  async function confirm() {
    if (!user) return;
    setBusy(true);
    try {
      await blockUser(user.id);
      bumpData();
      toast(t('block.done', { name: user.name.split(' ')[0] }), 'success');
      onClose();
      onBlocked?.();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('authFlow.genericError'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('block.confirmTitle', { name: user.name.split(' ')[0] })}>
      <div className="space-y-4 pb-2">
        <ul className="list-disc space-y-1.5 ps-5 text-meta text-ink-soft">
          <li>{t('block.effect1')}</li>
          <li>{t('block.effect2')}</li>
          <li>{t('block.effect3')}</li>
        </ul>
        <p className="text-[12px] text-ink-faint">{t('block.undoHint')}</p>
        <div className="flex gap-2">
          <Button variant="outline" fullWidth onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" fullWidth loading={busy} leftIcon={<Ban className="h-4 w-4" strokeWidth={1.7} />} onClick={confirm}>
            {t('block.block')}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
