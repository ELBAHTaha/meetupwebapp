import { useTranslation } from 'react-i18next';
import { Copy, MessageCircle, Share2 } from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { toast } from '@/store/toast';
import { activityShareUrl, whatsappHref } from '@/lib/share';

// Share an activity to friends. WhatsApp is first (it's the dominant channel in
// Morocco); the link opens a public preview page that recipients can see without
// an account, which nudges them to sign up to join.
export function ShareSheet({
  open,
  onClose,
  activityId,
  title,
}: {
  open: boolean;
  onClose: () => void;
  activityId: string;
  title: string;
}) {
  const { t } = useTranslation();
  const url = activityShareUrl(activityId);
  const message = `${title} — ${url}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* clipboard blocked — still close + reassure */
    }
    toast(t('share.copied'), 'success');
    onClose();
  }

  async function native() {
    try {
      await navigator.share?.({ title, url });
    } catch {
      /* user dismissed the share sheet */
    }
    onClose();
  }

  const hasNativeShare = typeof navigator !== 'undefined' && 'share' in navigator;

  return (
    <Sheet open={open} onClose={onClose} title={t('share.title')}>
      <p className="text-meta text-ink-soft">{t('share.intro')}</p>
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
          {t('share.whatsapp')}
        </a>

        <button
          onClick={copy}
          className="flex w-full items-center gap-3 rounded-input border border-border bg-surface px-4 py-3 text-[15px] font-medium text-ink hover:border-ink/20 transition-colors cursor-pointer"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-sunk text-ink-soft">
            <Copy className="h-5 w-5" strokeWidth={1.7} />
          </span>
          {t('share.copy')}
        </button>

        {hasNativeShare && (
          <button
            onClick={native}
            className="flex w-full items-center gap-3 rounded-input border border-border bg-surface px-4 py-3 text-[15px] font-medium text-ink hover:border-ink/20 transition-colors cursor-pointer"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-sunk text-ink-soft">
              <Share2 className="h-5 w-5" strokeWidth={1.7} />
            </span>
            {t('share.more')}
          </button>
        )}
      </div>
    </Sheet>
  );
}
