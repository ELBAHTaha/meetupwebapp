import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bug, Heart, Lightbulb, MessageCircle, MessageSquarePlus, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Sheet } from './Sheet';
import { Button } from './Button';
import { Textarea } from './Field';
import { submitFeedback, type FeedbackCategory } from '@/api';
import { toast } from '@/store/toast';
import { cn } from '@/lib/cn';

const CATS: { id: FeedbackCategory; icon: LucideIcon; key: string }[] = [
  { id: 'idea', icon: Lightbulb, key: 'feedback.catIdea' },
  { id: 'bug', icon: Bug, key: 'feedback.catBug' },
  { id: 'praise', icon: Heart, key: 'feedback.catPraise' },
  { id: 'other', icon: MessageCircle, key: 'feedback.catOther' },
];

/** Always-on floating feedback button + sheet, mounted in the app layouts. */
export function FeedbackButton() {
  const { t } = useTranslation();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>('idea');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  async function submit() {
    if (message.trim().length < 2 || sending) return;
    setSending(true);
    try {
      await submitFeedback({ category, message: message.trim(), path: location.pathname });
      toast(t('feedback.sent'), 'success');
      setOpen(false);
      setMessage('');
      setCategory('idea');
    } catch {
      toast(t('common.somethingWrong'), 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t('feedback.button')}
        title={t('feedback.button')}
        className="fixed bottom-24 right-4 z-40 grid h-12 w-12 place-items-center rounded-full bg-clay text-white shadow-e2 transition-transform hover:scale-105 active:scale-95 md:bottom-6 md:right-6"
      >
        <MessageSquarePlus className="h-5 w-5" strokeWidth={1.8} />
      </button>

      <Sheet open={open} onClose={() => setOpen(false)} title={t('feedback.title')}>
        <p className="text-meta text-ink-soft">{t('feedback.subtitle')}</p>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {CATS.map(({ id, icon: Icon, key }) => (
            <button
              key={id}
              onClick={() => setCategory(id)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-input border px-2 py-3 text-[12px] font-medium transition-colors cursor-pointer',
                category === id
                  ? 'border-clay bg-clay-soft text-clay'
                  : 'border-border bg-surface text-ink-soft hover:border-ink/20',
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={1.6} />
              {t(key)}
            </button>
          ))}
        </div>

        <div className="mt-4">
          <Textarea
            rows={5}
            placeholder={t('feedback.placeholder')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={2000}
          />
        </div>

        <Button
          fullWidth
          size="lg"
          className="!mt-4"
          loading={sending}
          disabled={message.trim().length < 2}
          onClick={submit}
          leftIcon={<Send className="h-4 w-4" strokeWidth={1.8} />}
        >
          {t('feedback.submit')}
        </Button>
      </Sheet>
    </>
  );
}
