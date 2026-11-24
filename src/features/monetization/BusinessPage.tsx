import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, BarChart3, Building2, Check, Lock, Mail, MapPin, Phone, Star, Store, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/Button';
import { DevelopedBy } from '@/components/DevelopedBy';
import { Input, Textarea } from '@/components/Field';
import { Tag } from '@/components/Chip';
import { createUpgradeRequest, registerBusiness, signupBusiness } from '@/api';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { AuthBackdrop } from '@/components/AuthBackdrop';
import { cn } from '@/lib/cn';
import type { BillingInterval, UpgradeRequest } from '@/types';
import { SPONSOR_MONTHLY_MAD, SPONSOR_PRODUCT, formatMad, termTotalMad } from './pricing';
import type { SellableTier } from './SponsorshipPicker';
import { UpgradeRequestCard } from './UpgradeRequestCard';

const TIERS: { id: SellableTier; icon: LucideIcon; popular?: boolean; points: number }[] = [
  { id: 'starter', icon: Store, points: 3 },
  { id: 'bronze', icon: Building2, points: 3 },
  { id: 'silver', icon: Star, popular: true, points: 4 },
];
const INTERVALS: BillingInterval[] = ['monthly', 'quarterly', 'annual'];
const BENEFITS: { icon: LucideIcon; key: string }[] = [
  { icon: Users, key: 'business.benefitReach' },
  { icon: MapPin, key: 'business.benefitMap' },
  { icon: BarChart3, key: 'business.benefitUsage' },
];

/**
 * Public business signup: pick a sponsorship, create a business account and
 * register the venue, then get payment instructions. The sponsorship is
 * activated by an admin once the offline payment arrives.
 */
export function BusinessPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const setLogin = useSession((s) => s.login);
  const [tier, setTier] = useState<SellableTier>('silver');
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [form, setForm] = useState({ name: '', description: '', address: '', contactEmail: '', phone: '', password: '' });
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<UpgradeRequest | null>(null);

  const termTotal = termTotalMad(SPONSOR_MONTHLY_MAD[tier], interval);

  async function submit() {
    if (form.password.length < 8) {
      toast(t('authFlow.passwordTooShort'), 'error');
      return;
    }
    setSaving(true);
    try {
      // 1. A dedicated business account (role `business`) — separate from personal
      //    accounts; signupBusiness rejects an email that's already in use.
      const user = await signupBusiness({
        name: form.name,
        email: form.contactEmail,
        password: form.password,
        phone: form.phone || undefined,
        locale: i18n.language,
      });
      setLogin(user);
      // 2. Register the venue (reviewed by an admin).
      const business = (await registerBusiness({
        name: form.name,
        description: form.description,
        address: form.address,
        contactEmail: form.contactEmail,
        phone: form.phone,
      })) as { id: string };
      setLogin({ ...user, businessId: business.id });
      // 3. Request the chosen sponsorship — paid offline, activated by an admin.
      const req = await createUpgradeRequest({ product: SPONSOR_PRODUCT[tier], interval, businessId: business.id, locale: i18n.language });
      setCreated(req);
    } catch (err) {
      toast(err instanceof Error ? err.message : t('business.registerFailed'), 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative min-h-screen">
      <AuthBackdrop className="fixed inset-0 -z-10" />

      <div className="flex min-h-screen flex-col pb-10">
        <div className="mx-auto w-full max-w-2xl px-6 pt-12 animate-fade-in">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate(-1)} className="flex items-center gap-2.5 cursor-pointer">
              <img src="/jmaa.svg" alt="hudlgo" className="h-9 w-9" />
              <span className="font-display text-h1 font-medium tracking-tight text-white">hudlgo</span>
            </button>
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[12px] font-medium text-white/90 backdrop-blur-sm hover:bg-white/15 cursor-pointer transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" strokeWidth={1.8} /> {t('common.back')}
            </button>
          </div>

          <div className="mt-8">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[12px] font-medium text-white/90 backdrop-blur-sm">
              <Building2 className="h-3.5 w-3.5" strokeWidth={1.8} /> {t('business.badge')}
            </span>
            <h1 className="mt-3 font-display text-display font-medium leading-[1.05] text-white">{t('business.heroTitle')}</h1>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-white/75">{t('business.heroBody')}</p>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {BENEFITS.map(({ icon: Icon, key }) => (
              <span
                key={key}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] font-medium text-white/85 backdrop-blur-sm"
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" /> {t(key)}
              </span>
            ))}
          </div>
        </div>

        <div className="mx-auto mt-6 w-full max-w-2xl px-4 animate-[sheet-up_0.35s_cubic-bezier(0.16,1,0.3,1)_both]">
          <div className="rounded-[28px] bg-bg px-6 pb-10 pt-7 shadow-[0_-4px_40px_rgba(43,38,32,.18)]">
            {created ? (
              <div className="space-y-4">
                <h2 className="font-display text-h1 font-medium text-ink">{t('business.doneTitle')}</h2>
                <p className="text-meta text-ink-soft">{t('business.doneBody')}</p>
                <UpgradeRequestCard request={created} />
                <Button fullWidth size="lg" onClick={() => navigate('/onboarding', { state: { business: true } })}>
                  {t('authFlow.continue')}
                </Button>
              </div>
            ) : (
              <>
                <h2 className="font-display text-h1 font-medium text-ink">{t('business.chooseTitle')}</h2>
                <p className="mt-1 text-meta text-ink-faint">{t('business.chooseSubtitle')}</p>

                <div className="mt-4 inline-flex rounded-full border border-border bg-surface p-1">
                  {INTERVALS.map((id) => (
                    <button
                      key={id}
                      onClick={() => setInterval(id)}
                      aria-pressed={interval === id}
                      className={cn(
                        'rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors cursor-pointer',
                        interval === id ? 'bg-clay text-white' : 'text-ink-soft hover:text-ink',
                      )}
                    >
                      {t(`upgrades.interval.${id}`)}
                      {id !== 'monthly' && (
                        <span className={cn('ms-1', interval === id ? 'text-white/85' : 'text-olive')}>· {t(`sponsor.save.${id}`)}</span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  {TIERS.map((item) => {
                    const active = tier === item.id;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setTier(item.id)}
                        aria-pressed={active}
                        className={cn(
                          'relative flex flex-col rounded-card border bg-surface p-4 text-start transition-colors cursor-pointer',
                          active ? 'border-clay ring-1 ring-clay' : 'border-border hover:border-ink/20',
                        )}
                      >
                        {item.popular && <Tag className="absolute -top-2.5 start-4 bg-clay text-white shadow-sm">{t('pricing.popular')}</Tag>}
                        <div className="flex items-center justify-between">
                          <span className={cn('grid h-9 w-9 place-items-center rounded-[10px]', active ? 'bg-clay text-white' : 'bg-clay-soft text-clay')}>
                            <Icon className="h-5 w-5" strokeWidth={1.7} />
                          </span>
                          <span
                            className={cn(
                              'grid h-5 w-5 place-items-center rounded-full border',
                              active ? 'border-clay bg-clay text-white' : 'border-border text-transparent',
                            )}
                          >
                            <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                          </span>
                        </div>
                        <p className="mt-3 font-display text-h2 font-medium text-ink">{t(`sponsor.tier.${item.id}`)}</p>
                        <p className="text-[12px] text-ink-soft">{t(`sponsor.tagline.${item.id}`)}</p>
                        <p className="mt-2 font-display text-h1 font-medium text-ink">
                          {formatMad(SPONSOR_MONTHLY_MAD[item.id])}
                          <span className="text-[12px] font-normal text-ink-soft">{t('pricing.perMonth')}</span>
                        </p>
                        <p className="mt-2 rounded-input bg-surface-sunk px-2.5 py-1.5 text-[11px] font-medium text-ink-soft">
                          {t(`sponsor.limit.${item.id}`)}
                        </p>
                        <div className="mt-3 flex-1 space-y-1.5 border-t border-border pt-3">
                          {Array.from({ length: item.points }).map((_, i) => (
                            <p key={i} className="flex items-start gap-1.5 text-[12px] leading-snug text-ink-soft">
                              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-olive" strokeWidth={1.8} /> {t(`sponsor.points.${item.id}.${i}`)}
                            </p>
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>

                <h2 className="mt-8 font-display text-h1 font-medium text-ink">{t('business.venueTitle')}</h2>
                <p className="mt-1 text-meta text-ink-faint">{t('business.venueSubtitle')}</p>

                <div className="mt-5 space-y-4">
                  <Input label={t('business.name')} placeholder="Café Atlas" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} leftIcon={<Building2 className="h-5 w-5" strokeWidth={1.6} />} />
                  <Textarea label={t('business.description')} placeholder={t('business.descriptionPlaceholder')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  <Input label={t('business.address')} placeholder={t('business.addressPlaceholder')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} leftIcon={<MapPin className="h-5 w-5" strokeWidth={1.6} />} />
                  <Input label={t('business.phone')} type="tel" placeholder="+212…" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} leftIcon={<Phone className="h-5 w-5" strokeWidth={1.6} />} />

                  <div className="rounded-card border border-border bg-surface p-4">
                    <p className="text-meta font-semibold text-ink">{t('business.loginTitle')}</p>
                    <p className="mt-0.5 text-[12px] text-ink-faint">{t('business.loginHint')}</p>
                    <div className="mt-3 space-y-4">
                      <Input label={t('auth.email')} type="email" placeholder="you@venue.com" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} leftIcon={<Mail className="h-5 w-5" strokeWidth={1.6} />} />
                      <Input label={t('auth.password')} type="password" hint={t('authFlow.passwordRule')} placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} leftIcon={<Lock className="h-5 w-5" strokeWidth={1.6} />} minLength={8} />
                    </div>
                  </div>

                  <div className="rounded-input border border-border bg-surface px-4 py-3 text-meta text-ink-soft">
                    {t('business.selectedPlan')}: <span className="font-semibold text-ink">{t(`sponsor.tier.${tier}`)}</span> · {t(`sponsor.limit.${tier}`)}
                    <span className="mt-0.5 block">
                      {t('sponsor.totalDue', { amount: formatMad(termTotal), term: t(`upgrades.interval.${interval}`).toLowerCase() })}
                    </span>
                    <span className="mt-1 block text-[12px] text-ink-faint">{t('business.manualPayNote')}</span>
                  </div>

                  <Button
                    fullWidth
                    size="lg"
                    className="!mt-6"
                    loading={saving}
                    disabled={!form.name || !form.address || !form.contactEmail || form.password.length < 8}
                    onClick={submit}
                  >
                    {t('business.submit')}
                  </Button>
                  <p className="text-center text-[12px] text-ink-faint">{t('business.submitHint', { plan: t(`sponsor.tier.${tier}`) })}</p>
                </div>
              </>
            )}
            <DevelopedBy className="mt-6" />
          </div>
        </div>
      </div>
    </div>
  );
}
