import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Building2, FileCheck2, Globe, Mail, MapPin, Phone, Plus, Store, Upload } from 'lucide-react';
import {
  createBusinessOrg,
  createVenue,
  getMyBusinesses,
  submitBusinessVerification,
} from '@/api';
import { useAsync } from '@/hooks/useAsync';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Input, Textarea } from '@/components/Field';
import { Tag } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { toast } from '@/store/toast';
import type { BusinessOrg } from '@/types';

const CATEGORIES = ['sports_venue', 'cafe', 'restaurant', 'outdoor', 'coworking', 'wellness', 'other'];

export function BusinessOnboardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const mine = useAsync(() => getMyBusinesses(), [version]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'sports_venue', address: '', contactEmail: '', phone: '', website: '', legalName: '', description: '' });
  const [tos, setTos] = useState(false);

  async function create() {
    if (!tos) return toast(t('bizOnboard.acceptTos'), 'info');
    setCreating(true);
    try {
      await createBusinessOrg({ ...form, acceptBusinessTos: true });
      toast(t('bizOnboard.created'), 'success');
      setForm({ name: '', category: 'sports_venue', address: '', contactEmail: '', phone: '', website: '', legalName: '', description: '' });
      setTos(false);
      setVersion((v) => v + 1);
    } catch (err) {
      toast(err instanceof Error ? err.message : t('bizOnboard.createFailed'), 'error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <PageHeader back title={t('bizOnboard.title')} onBack={() => navigate('/profile')} />
      <div className="space-y-5 px-5 pt-3 pb-8 md:px-0">
        {/* Existing businesses */}
        {mine.data && mine.data.length > 0 ? (
          <div className="space-y-3">
            {mine.data.map((b) => (
              <BusinessCard key={b.id} biz={b} onChanged={() => setVersion((v) => v + 1)} />
            ))}
          </div>
        ) : (
          !mine.loading && <EmptyState icon={Store} title={t('bizOnboard.none')} />
        )}

        {/* Create a new business */}
        <div className="rounded-card border border-border bg-surface p-5">
          <div className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-clay" strokeWidth={1.8} />
            <p className="font-display text-h2 font-medium text-ink">{t('bizOnboard.register')}</p>
          </div>
          <p className="mt-1 text-meta text-ink-soft">{t('bizOnboard.registerHint')}</p>

          <div className="mt-4 space-y-4">
            <Input label={t('business.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} leftIcon={<Building2 className="h-5 w-5" strokeWidth={1.6} />} />
            <Input label={t('bizOnboard.legalName')} value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
            <label className="block">
              <span className="mb-1 block text-meta font-medium text-ink-soft">{t('bizOnboard.categoryLabel')}</span>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-input border border-border bg-bg px-3 py-2.5 text-meta text-ink capitalize">
                {CATEGORIES.map((c) => <option key={c} value={c}>{t(`bizOnboard.category.${c}`)}</option>)}
              </select>
            </label>
            <Textarea label={t('business.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <Input label={t('business.address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} leftIcon={<MapPin className="h-5 w-5" strokeWidth={1.6} />} />
            <Input label={t('bizOnboard.contactEmail')} type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} leftIcon={<Mail className="h-5 w-5" strokeWidth={1.6} />} />
            <Input label={t('auth.phone')} type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} leftIcon={<Phone className="h-5 w-5" strokeWidth={1.6} />} />
            <Input label={t('bizOnboard.website')} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} leftIcon={<Globe className="h-5 w-5" strokeWidth={1.6} />} />

            <label className="flex cursor-pointer items-start gap-2 text-meta text-ink-soft">
              <input type="checkbox" checked={tos} onChange={(e) => setTos(e.target.checked)} className="mt-0.5 h-4 w-4 accent-clay" />
              <span>{t('bizOnboard.tos')}</span>
            </label>

            <Button size="lg" fullWidth loading={creating} disabled={!form.name || !form.address || !form.contactEmail || !tos} onClick={create}>
              {t('bizOnboard.create')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function BusinessCard({ biz, onChanged }: { biz: BusinessOrg; onChanged: () => void }) {
  const { t } = useTranslation();
  const [showVerify, setShowVerify] = useState(false);
  const [showVenue, setShowVenue] = useState(false);
  const statusTone =
    biz.status === 'verified' ? 'bg-olive-soft text-olive' :
    biz.status === 'rejected' ? 'bg-clay text-white' :
    biz.status === 'suspended' ? 'bg-ink text-bg' : 'bg-saffron-soft text-saffron';

  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-card bg-surface-sunk text-ink-soft">
          {biz.logoUrl ? <img src={biz.logoUrl} alt="" className="h-full w-full rounded-card object-cover" /> : <Store className="h-6 w-6" strokeWidth={1.6} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-h2 font-medium text-ink">{biz.name}</p>
            <Tag className={statusTone}>{t(`bizOnboard.status.${biz.status}`, biz.status.replace(/_/g, ' '))}</Tag>
            <Tag className="bg-surface-sunk text-ink-soft">{t(`bizOnboard.role.${biz.role}`, biz.role)}</Tag>
          </div>
          <p className="mt-0.5 text-[12px] text-ink-soft">{t(`bizOnboard.category.${biz.category}`, biz.category.replace(/_/g, ' '))} · {biz.address}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {biz.status !== 'verified' && (biz.role === 'owner') && (
          <Button size="sm" variant="outline" leftIcon={<FileCheck2 className="h-4 w-4" strokeWidth={1.7} />} onClick={() => setShowVerify((s) => !s)}>
            {t('bizOnboard.submitVerification')}
          </Button>
        )}
        {(biz.role === 'owner' || biz.role === 'manager') && (
          <Button size="sm" variant="outline" leftIcon={<Plus className="h-4 w-4" strokeWidth={1.7} />} onClick={() => setShowVenue((s) => !s)}>
            {t('bizOnboard.addVenue')}
          </Button>
        )}
      </div>

      {showVerify && <VerifyForm businessId={biz.id} onDone={() => { setShowVerify(false); onChanged(); }} />}
      {showVenue && <VenueForm businessId={biz.id} onDone={() => { setShowVenue(false); onChanged(); }} />}
    </div>
  );
}

function VerifyForm({ businessId, onDone }: { businessId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const [rc, setRc] = useState('');
  const [ice, setIce] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function submit() {
    setBusy(true);
    try {
      await submitBusinessVerification(businessId, { rcNumber: rc || undefined, iceNumber: ice || undefined, documents: files });
      toast(t('bizOnboard.verificationSent'), 'success');
      onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('bizOnboard.verificationFailed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-card border border-border bg-bg p-4">
      <Input label={t('bizOnboard.rc')} value={rc} onChange={(e) => setRc(e.target.value)} />
      <Input label={t('bizOnboard.ice')} value={ice} onChange={(e) => setIce(e.target.value)} />
      <button onClick={() => fileRef.current?.click()} className="flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-clay/50 bg-clay-soft/30 px-3 py-3 text-meta font-medium text-clay cursor-pointer">
        <Upload className="h-4 w-4" strokeWidth={1.7} /> {files.length ? t('bizOnboard.filesSelected', { count: files.length }) : t('bizOnboard.uploadDocs')}
      </button>
      <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files ?? []))} />
      <Button size="sm" fullWidth loading={busy} onClick={submit}>{t('bizOnboard.submitReview')}</Button>
    </div>
  );
}

function VenueForm({ businessId, onDone }: { businessId: string; onDone: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', category: 'sports_venue', address: '', lat: '', lng: '' });
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      await createVenue({
        businessId,
        name: form.name,
        category: form.category,
        address: form.address,
        lat: Number(form.lat) || 0,
        lng: Number(form.lng) || 0,
      });
      toast(t('bizOnboard.venueAdded'), 'success');
      onDone();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('bizOnboard.venueFailed'), 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-card border border-border bg-bg p-4">
      <Input label={t('bizOnboard.venueName')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <label className="block">
        <span className="mb-1 block text-meta font-medium text-ink-soft">{t('bizOnboard.categoryLabel')}</span>
        <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full rounded-input border border-border bg-bg px-3 py-2.5 text-meta text-ink capitalize">
          {CATEGORIES.map((c) => <option key={c} value={c}>{t(`bizOnboard.category.${c}`)}</option>)}
        </select>
      </label>
      <Input label={t('business.address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} leftIcon={<MapPin className="h-5 w-5" strokeWidth={1.6} />} />
      <div className="flex gap-3">
        <Input label={t('bizOnboard.lat')} value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} />
        <Input label={t('bizOnboard.lng')} value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} />
      </div>
      <Button size="sm" fullWidth loading={busy} disabled={!form.name || !form.address} onClick={submit}>{t('bizOnboard.addVenue')}</Button>
    </div>
  );
}
