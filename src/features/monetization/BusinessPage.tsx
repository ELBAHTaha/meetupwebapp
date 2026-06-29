import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BarChart3, Building2, Check, Lock, Mail, MapPin, Phone, Star, Store, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/Button';
import { DevelopedBy } from '@/components/DevelopedBy';
import { Input, Textarea } from '@/components/Field';
import { Tag } from '@/components/Chip';
import { createSponsorshipCheckout, registerBusiness, signupBusiness } from '@/api';
import { settleCheckout } from '@/lib/paddle';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { AuthBackdrop } from '@/components/AuthBackdrop';
import { cn } from '@/lib/cn';
import type { BillingInterval, SponsorshipTier } from '@/types';

const tiers: {
  id: SponsorshipTier;
  name: string;
  monthlyMad: number;
  tagline: string;
  limit: string;
  icon: LucideIcon;
  popular?: boolean;
  points: string[];
}[] = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyMad: 199,
    tagline: 'Test the waters',
    limit: '2 sponsored activities / month',
    icon: Store,
    points: [
      'Sponsored label on your venue in the map & venue picker',
      'Listed when hosts search for a place',
      'Great for small or new venues',
    ],
  },
  {
    id: 'bronze',
    name: 'Bronze',
    monthlyMad: 490,
    tagline: 'Get discovered by locals',
    limit: '5 sponsored activities / month',
    icon: Building2,
    points: [
      'Sponsored label on your venue in the map & venue picker',
      'Listed when hosts search for a place',
      'Basic business profile',
    ],
  },
  {
    id: 'silver',
    name: 'Silver',
    monthlyMad: 990,
    tagline: 'Grow steady foot traffic',
    limit: '15 sponsored activities / month',
    icon: Star,
    popular: true,
    points: [
      'Everything in Bronze',
      'Full business profile page',
      'Unique coupon codes for attendees',
      'Top placement in the venue picker',
    ],
  },
];

// Prepaid terms: discount off the monthly rate for committing longer.
const INTERVALS: { id: BillingInterval; label: string; months: number; discount: number; save?: string }[] = [
  { id: 'monthly', label: 'Monthly', months: 1, discount: 0 },
  { id: 'quarterly', label: 'Quarterly', months: 3, discount: 0.1, save: 'Save 10%' },
  { id: 'annual', label: 'Annual', months: 12, discount: 0.15, save: 'Save 15%' },
];

const TERM_NOUN: Record<BillingInterval, string> = { monthly: 'mo', quarterly: 'quarter', annual: 'year' };

const benefits: { icon: LucideIcon; label: string }[] = [
  { icon: Users, label: 'Reach active locals' },
  { icon: MapPin, label: 'Featured on the map' },
  { icon: BarChart3, label: 'Monthly usage tracking' },
];

export function BusinessPage() {
  const navigate = useNavigate();
  const setLogin = useSession((s) => s.login);
  const [tier, setTier] = useState<SponsorshipTier>('silver');
  const [interval, setInterval] = useState<BillingInterval>('monthly');
  const [form, setForm] = useState({ name: '', description: '', address: '', contactEmail: '', phone: '', password: '' });
  const [saving, setSaving] = useState(false);

  const selected = tiers.find((x) => x.id === tier)!;
  const intervalCfg = INTERVALS.find((i) => i.id === interval)!;
  // Discounted amount charged up front for the chosen term.
  const termTotal = Math.round(selected.monthlyMad * intervalCfg.months * (1 - intervalCfg.discount));

  async function submit() {
    if (form.password.length < 8) {
      toast('Password must be at least 8 characters.', 'error');
      return;
    }
    setSaving(true);
    try {
      // 1. Create a dedicated business account (role `business`). Business
      //    accounts are separate from personal accounts — if the email is
      //    already in use, signupBusiness rejects and we surface that.
      const user = await signupBusiness({
        name: form.name,
        email: form.contactEmail,
        password: form.password,
        phone: form.phone || undefined,
      });
      setLogin(user);

      // 2. Register the venue and start the sponsorship checkout.
      const business = (await registerBusiness({
        name: form.name,
        description: form.description,
        address: form.address,
        contactEmail: form.contactEmail,
        phone: form.phone,
      })) as { id: string };
      // 3. Open the Paddle sponsorship checkout; on success head into the app.
      const session = await createSponsorshipCheckout(business.id, tier, interval);
      const ok = await settleCheckout(session);
      if (ok) {
        toast('Your venue is registered — welcome to hudlgo! 🎉', 'success');
        navigate('/onboarding', { state: { business: true } });
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not register business', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative min-h-screen">
      {/* Fixed photo-mosaic background — stays in place while the card scrolls */}
      <AuthBackdrop className="fixed inset-0 -z-10" />

      <div className="flex min-h-screen flex-col pb-10">
        {/* Top brand area */}
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
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.8} /> Back
            </button>
          </div>

          <div className="mt-8">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[12px] font-medium text-white/90 backdrop-blur-sm">
              <Building2 className="h-3.5 w-3.5" strokeWidth={1.8} /> For businesses
            </span>
            <h1 className="mt-3 font-display text-display font-medium leading-[1.05] text-white">
              Put your venue where the plans happen
            </h1>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-white/75">
              Every hudlgo meetup needs a place. Sponsored venues show up first when hosts pick where to gather — sending
              a steady stream of new faces through your door.
            </p>
          </div>

          {/* Benefit chips */}
          <div className="mt-5 flex flex-wrap gap-2">
            {benefits.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] font-medium text-white/85 backdrop-blur-sm"
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden="true" /> {label}
              </span>
            ))}
          </div>
        </div>

        {/* Form card */}
        <div className="mx-auto mt-6 w-full max-w-2xl px-4 animate-[sheet-up_0.35s_cubic-bezier(0.16,1,0.3,1)_both]">
          <div className="rounded-[28px] bg-bg px-6 pb-10 pt-7 shadow-[0_-4px_40px_rgba(43,38,32,.18)]">
            <h2 className="font-display text-h1 font-medium text-ink">Choose your sponsorship</h2>
            <p className="mt-1 text-meta text-ink-faint">Monthly, or prepay a quarter/year for a discount · limits reset on the 1st.</p>

            {/* Billing term toggle */}
            <div className="mt-4 inline-flex rounded-full border border-border bg-surface p-1">
              {INTERVALS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setInterval(opt.id)}
                  aria-pressed={interval === opt.id}
                  className={cn(
                    'rounded-full px-3.5 py-1.5 text-[12px] font-medium transition-colors cursor-pointer',
                    interval === opt.id ? 'bg-clay text-white' : 'text-ink-soft hover:text-ink',
                  )}
                >
                  {opt.label}
                  {opt.save && <span className={cn('ml-1', interval === opt.id ? 'text-white/85' : 'text-olive')}>· {opt.save}</span>}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {tiers.map((item) => {
                const active = tier === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setTier(item.id)}
                    aria-pressed={active}
                    className={cn(
                      'relative flex flex-col rounded-card border bg-surface p-4 text-left transition-colors cursor-pointer',
                      active ? 'border-clay ring-1 ring-clay' : 'border-border hover:border-ink/20',
                    )}
                  >
                    {item.popular && (
                      <Tag className="absolute -top-2.5 left-4 bg-clay text-white shadow-sm">Most popular</Tag>
                    )}
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

                    <p className="mt-3 font-display text-h2 font-medium text-ink">{item.name}</p>
                    <p className="text-[12px] text-ink-soft">{item.tagline}</p>

                    <p className="mt-2 font-display text-h1 font-medium text-ink">
                      {item.monthlyMad} MAD
                      <span className="text-[12px] font-normal text-ink-soft">/mo</span>
                    </p>
                    <p className="mt-2 rounded-input bg-surface-sunk px-2.5 py-1.5 text-[11px] font-medium text-ink-soft">
                      {item.limit}
                    </p>

                    <div className="mt-3 flex-1 space-y-1.5 border-t border-border pt-3">
                      {item.points.map((point) => (
                        <p key={point} className="flex items-start gap-1.5 text-[12px] leading-snug text-ink-soft">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-olive" strokeWidth={1.8} /> {point}
                        </p>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Registration */}
            <h2 className="mt-8 font-display text-h1 font-medium text-ink">Tell us about your venue</h2>
            <p className="mt-1 text-meta text-ink-faint">We review new venues before they go live.</p>

            <div className="mt-5 space-y-4">
              <Input label="Business name" placeholder="Café Atlas" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} leftIcon={<Building2 className="h-5 w-5" strokeWidth={1.6} />} />
              <Textarea label="Description" placeholder="What makes your venue great for meetups?" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <Input label="Address" placeholder="Rue Example, Casablanca" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} leftIcon={<MapPin className="h-5 w-5" strokeWidth={1.6} />} />
              <Input label="Phone" type="tel" placeholder="+212…" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} leftIcon={<Phone className="h-5 w-5" strokeWidth={1.6} />} />

              {/* Login credentials — used to sign in later */}
              <div className="rounded-card border border-border bg-surface p-4">
                <p className="text-meta font-semibold text-ink">Your login</p>
                <p className="mt-0.5 text-[12px] text-ink-faint">Use this email and password to sign in to your account later.</p>
                <div className="mt-3 space-y-4">
                  <Input label="Email" type="email" placeholder="you@venue.com" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} leftIcon={<Mail className="h-5 w-5" strokeWidth={1.6} />} />
                  <Input label="Password" type="password" hint="At least 8 characters" placeholder="••••••••" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} leftIcon={<Lock className="h-5 w-5" strokeWidth={1.6} />} minLength={8} />
                </div>
              </div>

              <div className="rounded-input border border-border bg-surface px-4 py-3 text-meta text-ink-soft">
                Selected plan: <span className="font-semibold text-ink">{selected.name}</span> · {selected.limit}
                <span className="mt-0.5 block">
                  You pay <span className="font-semibold text-ink">{termTotal} MAD</span> / {TERM_NOUN[interval]}
                  {interval !== 'monthly' && <span className="text-olive"> ({intervalCfg.save})</span>}
                </span>
              </div>

              <Button
                fullWidth
                size="lg"
                className="!mt-6"
                loading={saving}
                disabled={!form.name || !form.address || !form.contactEmail || form.password.length < 8}
                onClick={submit}
              >
                Create account &amp; continue
              </Button>
              <p className="text-center text-[12px] text-ink-faint">
                Registers your venue on the {selected.name} plan and creates your login.
              </p>

              <DevelopedBy className="mt-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
