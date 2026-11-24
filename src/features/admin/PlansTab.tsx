import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Store, UserRound } from 'lucide-react';
import { Button } from '@/components/Button';
import { Input } from '@/components/Field';
import { Tag } from '@/components/Chip';
import { adminSearchUsers, adminSetBusinessSponsorship, adminSetUserPlan, listBusinessesAdmin } from '@/api';
import { useAsync } from '@/hooks/useAsync';
import { toast } from '@/store/toast';
import type { AdminUserPlan } from '@/types';

type Action = 'grant' | 'extend' | 'revoke';
type SellTier = 'starter' | 'bronze' | 'silver';

interface AdminBusinessRow {
  id: string;
  name: string;
  status?: string;
  tier?: string;
  sponsorships?: { tier: string; status: string; endDate?: string | null }[];
}

/**
 * Admin: grant, extend or revoke a person's Pro Host plan or a business's venue
 * sponsorship directly — no request needed (every change is audit-logged).
 */
export function PlansTab({ onChanged }: { onChanged: () => void }) {
  const { t } = useTranslation();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<AdminUserPlan[] | null>(null);
  const [searching, setSearching] = useState(false);
  const businesses = useAsync(() => listBusinessesAdmin() as Promise<AdminBusinessRow[]>, []);

  async function search(e?: React.FormEvent) {
    e?.preventDefault();
    setSearching(true);
    try {
      setResults(await adminSearchUsers(q));
    } catch (err) {
      toast(err instanceof Error ? err.message : t('authFlow.genericError'), 'error');
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 font-display text-h3 font-medium">
          <UserRound className="h-4 w-4" strokeWidth={1.7} /> {t('adminPlans.proTitle')}
        </h3>
        <form onSubmit={search} className="flex gap-2">
          <div className="flex-1">
            <Input placeholder={t('adminPlans.searchPlaceholder')} value={q} onChange={(e) => setQ(e.target.value)} leftIcon={<Search className="h-4 w-4" />} />
          </div>
          <Button type="submit" loading={searching} disabled={q.trim().length < 2}>{t('adminPlans.search')}</Button>
        </form>
        {results?.length === 0 && <p className="text-meta text-ink-faint">{t('adminPlans.noResults')}</p>}
        {results?.map((u) => (
          <UserPlanRow
            key={u.id}
            user={u}
            onUpdated={(fresh) => {
              setResults((cur) => cur?.map((x) => (x.id === fresh.id ? fresh : x)) ?? null);
              onChanged();
            }}
          />
        ))}
      </section>

      <section className="space-y-3">
        <h3 className="flex items-center gap-2 font-display text-h3 font-medium">
          <Store className="h-4 w-4" strokeWidth={1.7} /> {t('adminPlans.sponsorTitle')}
        </h3>
        {(businesses.data ?? []).map((b) => (
          <BusinessPlanRow
            key={b.id}
            business={b}
            onUpdated={() => {
              businesses.reload();
              onChanged();
            }}
          />
        ))}
      </section>
    </div>
  );
}

function PlanControls({ busy, onAct, extra }: { busy: Action | null; onAct: (a: Action, months: number) => void; extra?: React.ReactNode }) {
  const { t } = useTranslation();
  const [months, setMonths] = useState(1);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {extra}
      <select
        value={months}
        onChange={(e) => setMonths(Number(e.target.value))}
        className="rounded-input border border-border bg-bg px-2 py-1.5 text-[13px] text-ink"
        aria-label={t('adminUpgrades.months')}
      >
        {[1, 3, 6, 12].map((m) => (
          <option key={m} value={m}>{t('adminUpgrades.monthsCount', { count: m })}</option>
        ))}
      </select>
      <Button size="sm" loading={busy === 'grant'} disabled={!!busy} onClick={() => onAct('grant', months)}>{t('adminPlans.grant')}</Button>
      <Button size="sm" variant="outline" loading={busy === 'extend'} disabled={!!busy} onClick={() => onAct('extend', months)}>{t('adminPlans.extend')}</Button>
      <Button size="sm" variant="danger" loading={busy === 'revoke'} disabled={!!busy} onClick={() => onAct('revoke', months)}>{t('adminPlans.revoke')}</Button>
    </div>
  );
}

function UserPlanRow({ user, onUpdated }: { user: AdminUserPlan; onUpdated: (u: AdminUserPlan) => void }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState<Action | null>(null);
  async function act(action: Action, months: number) {
    if (action === 'revoke' && !window.confirm(t('adminPlans.confirmRevoke', { name: user.name }))) return;
    setBusy(action);
    try {
      onUpdated(await adminSetUserPlan(user.id, { action, months }));
      toast(t('adminPlans.saved'), 'success');
    } catch (err) {
      toast(err instanceof Error ? err.message : t('authFlow.genericError'), 'error');
    } finally {
      setBusy(null);
    }
  }
  const isPro = user.plan !== 'free';
  return (
    <div className="rounded-card border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-meta font-medium text-ink">{user.name}</p>
          <p className="truncate text-[12px] text-ink-soft">{user.email}</p>
        </div>
        <Tag className={isPro ? 'bg-olive-soft text-olive' : 'bg-surface-sunk text-ink-soft'}>
          {isPro ? `${t('pricing.proName')}${user.endsAt ? ` · ${new Date(user.endsAt).toLocaleDateString()}` : ''}` : t('pricing.freeName')}
        </Tag>
      </div>
      {user.role !== 'business' && <PlanControls busy={busy} onAct={act} />}
    </div>
  );
}

function BusinessPlanRow({ business, onUpdated }: { business: AdminBusinessRow; onUpdated: () => void }) {
  const { t } = useTranslation();
  const latest = business.sponsorships?.[0];
  const activeTier = latest?.status === 'ACTIVE' ? latest.tier.toLowerCase() : business.tier;
  const [tier, setTier] = useState<SellTier>((['starter', 'bronze', 'silver'].includes(activeTier ?? '') ? activeTier : 'starter') as SellTier);
  const [busy, setBusy] = useState<Action | null>(null);

  async function act(action: Action, months: number) {
    if (action === 'revoke' && !window.confirm(t('adminPlans.confirmRevoke', { name: business.name }))) return;
    setBusy(action);
    try {
      await adminSetBusinessSponsorship(business.id, { action, tier, months });
      toast(t('adminPlans.saved'), 'success');
      onUpdated();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('authFlow.genericError'), 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-card border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-meta font-medium text-ink">{business.name}</p>
        <Tag className={activeTier ? 'bg-olive-soft text-olive' : 'bg-surface-sunk text-ink-soft'}>
          {activeTier
            ? `${t(`sponsor.tier.${activeTier}`, activeTier)}${latest?.endDate ? ` · ${new Date(latest.endDate).toLocaleDateString()}` : ''}`
            : t('adminPlans.noSponsorship')}
        </Tag>
      </div>
      <PlanControls
        busy={busy}
        onAct={act}
        extra={
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as SellTier)}
            className="rounded-input border border-border bg-bg px-2 py-1.5 text-[13px] text-ink"
            aria-label={t('adminPlans.tier')}
          >
            {(['starter', 'bronze', 'silver'] as SellTier[]).map((x) => (
              <option key={x} value={x}>{t(`sponsor.tier.${x}`)}</option>
            ))}
          </select>
        }
      />
    </div>
  );
}
