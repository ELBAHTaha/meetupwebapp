import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';

/**
 * Small "Developed by keyinov" credit shown in the footer of every page.
 * The link inherits the surrounding text colour, so pass a `className` with a
 * light colour (e.g. `text-white/60`) when placing it on a dark background.
 */
export function DevelopedBy({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <p className={cn('text-center text-[12px] text-ink-faint', className)}>
      {t('app.developedBy')}{' '}
      <a
        href="https://keyinov.com"
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium underline-offset-2 hover:text-clay hover:underline"
      >
        keyinov
      </a>
    </p>
  );
}
