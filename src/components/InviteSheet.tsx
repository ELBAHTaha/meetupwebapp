import { useTranslation } from 'react-i18next';
import { Copy, Gift, MessageCircle } from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { Skeleton } from '@/components/Skeleton';
import { toast } from '@/store/toast';
import { useAsync } from '@/hooks/useAsync';
import { getReferral } from '@/api';
import { whatsappHref } from '@/lib/share';

// "Invite friends, get Pro" sheet. Shows the user's personal invite link, how
// many friends have joined, and WhatsApp/copy actions. Both the inviter and the
// new friend get Pro Host trial days when the friend signs up via the link.
export function InviteSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { data, loading } = useAsync(() => (open ? getReferral() : Promise.resolve(null)), [open]);

  async function copy() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.link);
    } catch {
      /* clipboard blocked — still reassure */
    }
    toast(t('referral.copied'), 'success');
  }

  const message = data ? `${t('referral.shareText', { days: data.rewardDays })} ${data.link}` : '';

  return (
    <Sheet open={open} onClose={onClose} title={t('referral.title')}>
      <div className="flex items-start gap-3 rounded-card border border-clay/25 bg-clay-soft px-4 py-3">
        <Gift className="mt-0.5 h-5 w-5 shrink-0 text-clay" strokeWidth={1.7} />
        <p className="text-meta text-ink-soft">{t('referral.subtitle', { days: data?.rewardDays ?? 7 })}</p>
      </div>

      {loading || !data ? (
        <Skeleton className="mt-4 h-12 w-full" />
      ) : (
        <>
          <p className="mt-4 text-[12px] font-semibold uppercase tracking-wide text-ink-faint">{t('referral.yourLink')}</p>
          <div className="mt-1.5 truncate rounded-input border border-border bg-surface-sunk px-3 py-2.5 text-meta text-ink-soft">{data.link}</div>
          <p className="mt-2 text-[12px] text-ink-faint">{t('referral.joined', { count: data.joinedCount })}</p>

          <div className="mt-4 space-y-2.5">
            <a
              href={whatsappHref(message)}
              target="_blank"
              rel="noreferrer"
              onClick={onClose}
              className="flex items-center gap-3 rounded-input border border-border bg-surface px-4 py-3 text-[15px] font-medium text-ink hover:border-ink/20 transition-colors"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#25D366] text-white">
                <MessageCircle className="h-5 w-5" strokeWidth={1.8} />
              </span>
              {t('referral.whatsapp')}
            </a>

            <button
              onClick={copy}
              className="flex w-full items-center gap-3 rounded-input border border-border bg-surface px-4 py-3 text-[15px] font-medium text-ink hover:border-ink/20 transition-colors cursor-pointer"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-sunk text-ink-soft">
                <Copy className="h-5 w-5" strokeWidth={1.7} />
              </span>
              {t('referral.copy')}
            </button>
          </div>
        </>
      )}
    </Sheet>
  );
}
