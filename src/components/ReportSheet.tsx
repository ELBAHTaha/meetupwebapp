import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { Textarea } from './Field';
import { Chip } from './Chip';
import { reportTarget } from '@/api';
import { toast } from '@/store/toast';
import type { ReportCategory, ReportInput } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  targetType: ReportInput['targetType'];
  targetId: string;
  chatThreadId?: string;
}

const REASONS = ['report.r1', 'report.r2', 'report.r3', 'report.r4', 'report.r5'];

// Map the chosen reason to a moderation category (user reports default to
// "suspicious_user" when the reason isn't behaviour/no-show specific).
function categoryFor(reason: string | null, targetType: ReportInput['targetType']): ReportCategory {
  if (reason === 'report.r2') return 'no_show_host';
  if (reason === 'report.r1') return 'inappropriate';
  if (targetType === 'user') return 'suspicious_user';
  if (reason === 'report.r3') return 'fake_activity';
  if (reason === 'report.r4') return 'inappropriate';
  return 'other';
}

export function ReportSheet({ open, onClose, targetType, targetId, chatThreadId }: Props) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<string | null>(null);
  const [detail, setDetail] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit() {
    const reasonText = [reason ? t(reason) : '', detail].filter(Boolean).join(' — ');
    if (!reasonText) return;
    setSaving(true);
    await reportTarget({ targetType, targetId, category: categoryFor(reason, targetType), reason: reasonText, chatThreadId });
    setSaving(false);
    setReason(null);
    setDetail('');
    toast(t('report.thanks'), 'info');
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={t('report.title')}>
      <div className="space-y-4">
        <p className="text-meta text-ink-soft">{t('report.subtitle')}</p>
        <div className="flex flex-wrap gap-2">
          {REASONS.map((r) => (
            <Chip key={r} active={reason === r} onClick={() => setReason(r)} activeClassName="bg-clay text-white">
              {t(r)}
            </Chip>
          ))}
        </div>
        <Textarea label={t('report.details')} placeholder={t('report.detailsPlaceholder')} value={detail} onChange={(e) => setDetail(e.target.value)} />
        {chatThreadId && <p className="text-[12px] text-ink-faint">{t('report.chatAttached')}</p>}
        <Button size="lg" fullWidth variant="danger" disabled={!reason && !detail.trim()} loading={saving} onClick={submit}>
          {t('report.submit')}
        </Button>
      </div>
    </Sheet>
  );
}
