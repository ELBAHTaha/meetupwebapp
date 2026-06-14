import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Compass } from 'lucide-react';
import { Button } from '@/components/Button';

export function NotFoundPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-6 text-center">
      <span className="font-display text-[88px] font-medium leading-none text-clay">404</span>
      <div className="motif-rule mt-4 w-16 rounded-full" />
      <h1 className="mt-4 font-display text-h1 font-medium">{t('common.notFound')}</h1>
      <p className="mt-2 max-w-xs text-meta text-ink-soft">{t('common.notFoundHint')}</p>
      <Button className="mt-6" size="lg" leftIcon={<Compass className="h-5 w-5" strokeWidth={1.6} />} onClick={() => navigate('/discover')}>
        {t('common.goHome')}
      </Button>
    </div>
  );
}
