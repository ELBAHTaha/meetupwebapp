import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, Crown, ImagePlus, Loader2, MapPin, Phone, Star, Store, X, Ticket } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { format } from 'date-fns';
import { getMyBusiness, removeVenuePhoto, updateMyBusiness, uploadVenuePhotos } from '@/api';
import { useAsync } from '@/hooks/useAsync';
import { useSession } from '@/store/session';
import { Button } from '@/components/Button';
import { Input, Textarea } from '@/components/Field';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Chip';
import { toast } from '@/store/toast';
import { cn } from '@/lib/cn';
import type { MyBusiness, SponsorshipTier } from '@/types';

const tierIcon: Record<SponsorshipTier, LucideIcon> = { starter: Store, bronze: Store, silver: Star, gold: Crown };

const MAX_PHOTOS = 6;

export function BusinessVenuePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const bump = useSession((s) => s.bumpData);
  const data = useAsync(() => getMyBusiness(), []);
  const [form, setForm] = useState({ name: '', description: '', address: '', phone: '', couponOffer: '' });
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data.data && !ready) {
      const b = data.data.business;
      setForm({ name: b.name, description: b.description, address: b.address, phone: b.phone, couponOffer: b.couponOffer ?? '' });
      setPhotos(b.photos ?? []);
      setReady(true);
    }
  }, [data.data, ready]);

  async function onPickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (e.target) e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    try {
      const res = await uploadVenuePhotos(files);
      setPhotos(res.business.photos);
      bump();
      toast(t('bizVenue.photosAdded'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : t('bizVenue.uploadFailed'), 'error');
    } finally {
      setUploading(false);
    }
  }

  async function onRemovePhoto(url: string) {
    try {
      const res = await removeVenuePhoto(url);
      setPhotos(res.business.photos);
      bump();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('bizVenue.removeFailed'), 'error');
    }
  }

  async function save() {
    setSaving(true);
    try {
      await updateMyBusiness(form);
      bump();
      toast(t('bizVenue.updated'), 'success');
      navigate('/business/dashboard');
    } catch (err) {
      toast(err instanceof Error ? err.message : t('bizVenue.updateFailed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  if (data.loading || !ready) {
    return (
      <div className="mx-auto max-w-xl space-y-3">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-72 w-full rounded-card" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl">
      <button onClick={() => navigate('/business/dashboard')} className="mb-3 inline-flex items-center gap-1.5 text-meta font-medium text-ink-soft hover:text-ink cursor-pointer">
        <ArrowLeft className="h-4 w-4 rtl:-scale-x-100" strokeWidth={1.8} /> Back to dashboard
      </button>
      <h1 className="font-display text-h1 font-medium text-ink">{t('bizVenue.title')}</h1>
      <p className="mt-1 text-meta text-ink-soft">{t('bizVenue.subtitle')}</p>

      {/* Plan & usage */}
      <SponsorshipCard sponsorship={data.data?.sponsorship ?? null} />

      {/* Venue photos */}
      <div className="mt-5 rounded-card border border-border bg-surface p-5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="font-display text-h3 font-medium text-ink">{t('bizVenue.photos')}</p>
            <p className="text-[12px] text-ink-soft">{t('bizVenue.photosHint', { max: MAX_PHOTOS })}</p>
          </div>
          <span className="text-[12px] text-ink-faint">{photos.length}/{MAX_PHOTOS}</span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
          {photos.map((url, i) => (
            <div key={url} className="group relative aspect-square overflow-hidden rounded-card border border-border bg-surface-sunk">
              <img src={url} alt="" className="h-full w-full object-cover" />
              {i === 0 && (
                <span className="absolute start-1.5 top-1.5 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm">
                  Cover
                </span>
              )}
              <button
                onClick={() => onRemovePhoto(url)}
                aria-label={t('bizVenue.removePhoto')}
                className="absolute end-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink/70 text-white backdrop-blur-sm transition-colors hover:bg-clay cursor-pointer"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          ))}
          {photos.length < MAX_PHOTOS && (
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="grid aspect-square place-items-center rounded-card border border-dashed border-clay/50 bg-clay-soft/40 text-clay transition-colors hover:bg-clay-soft disabled:opacity-60 cursor-pointer"
            >
              {uploading ? <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.8} /> : <ImagePlus className="h-5 w-5" strokeWidth={1.7} />}
              <span className="mt-1 text-[11px] font-medium">{uploading ? 'Uploading…' : 'Add'}</span>
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={onPickPhotos} />
        {photos.length === 0 && !uploading && (
          <p className="mt-3 text-[12px] text-ink-faint">{t('bizVenue.noPhotos')}</p>
        )}
      </div>

      <div className="mt-4 space-y-4 rounded-card border border-border bg-surface p-5">
        <Input label={t('business.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} leftIcon={<Building2 className="h-5 w-5" strokeWidth={1.6} />} />
        <Textarea label={t('business.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <Input label={t('business.address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} leftIcon={<MapPin className="h-5 w-5" strokeWidth={1.6} />} />
        <Input label={t('business.phone')} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} leftIcon={<Phone className="h-5 w-5" strokeWidth={1.6} />} />
        <Input
          label={t('coupon.offerLabel')}
          placeholder={t('coupon.defaultOffer')}
          hint={t('coupon.offerHint')}
          maxLength={160}
          value={form.couponOffer}
          onChange={(e) => setForm({ ...form, couponOffer: e.target.value })}
          leftIcon={<Ticket className="h-5 w-5" strokeWidth={1.6} />}
        />

        <div className="flex gap-3 pt-1">
          <Button variant="outline" size="lg" onClick={() => navigate('/business/dashboard')}>{t('common.cancel')}</Button>
          <Button size="lg" fullWidth loading={saving} disabled={!form.name || !form.address} onClick={save}>
            {t('bizVenue.save')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function SponsorshipCard({ sponsorship }: { sponsorship: MyBusiness['sponsorship'] }) {
  const { t } = useTranslation();
  const TierIcon = sponsorship ? tierIcon[sponsorship.tier] : Store;
  const unlimited = sponsorship?.limit === 'unlimited';
  const pct =
    sponsorship && !unlimited && typeof sponsorship.limit === 'number' && sponsorship.limit > 0
      ? Math.min(100, Math.round((sponsorship.used / sponsorship.limit) * 100))
      : 0;

  return (
    <section className="mt-5 rounded-card border border-border bg-surface p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-[10px] bg-clay-soft text-clay">
            <TierIcon className="h-5 w-5" strokeWidth={1.7} />
          </span>
          <div>
            <p className="font-display text-h2 font-medium text-ink">
              {sponsorship ? t('sponsor.activeTitle', { tier: t(`sponsor.tier.${sponsorship.tier}`, sponsorship.tier) }) : t('sponsor.noneTitle')}
            </p>
            {sponsorship && (
              <p className="text-meta text-ink-soft">
                {t('bizVenue.priceSince', { price: (sponsorship.monthlyPriceCents / 100).toFixed(2), date: format(new Date(sponsorship.startDate), 'd MMM yyyy') })}
              </p>
            )}
          </div>
        </div>
        <Tag className={cn(sponsorship?.status === 'active' ? 'bg-olive-soft text-olive' : 'bg-surface-sunk text-ink-soft')}>
          {sponsorship?.status === 'active' ? t('upgrades.status.approved') : t('bizVenue.inactive')}
        </Tag>
      </div>

      {sponsorship && (
        <div className="mt-5">
          <div className="flex items-center justify-between text-meta">
            <span className="text-ink-soft">{t('bizVenue.usageLabel')}</span>
            <span className="font-semibold text-ink">
              {unlimited ? `${sponsorship.used} · ${t('bizVenue.unlimited')}` : `${sponsorship.used} / ${sponsorship.limit}`}
            </span>
          </div>
          {!unlimited && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-sunk">
              <div className="h-full rounded-full bg-clay transition-all" style={{ width: `${pct}%` }} />
            </div>
          )}
          <p className="mt-2 text-[12px] text-ink-faint">
            {unlimited
              ? t('bizVenue.unlimitedHint')
              : t('bizVenue.remainingHint', { count: Number(sponsorship.remaining) })}
          </p>
        </div>
      )}
    </section>
  );
}
