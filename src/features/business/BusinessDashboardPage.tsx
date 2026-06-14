import { useNavigate } from 'react-router-dom';
import { CalendarRange, Crown, MapPin, Pencil, Plus, Star, Store, Ticket } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useAsync } from '@/hooks/useAsync';
import { getMyBusiness } from '@/api';
import { useSession } from '@/store/session';
import { Button } from '@/components/Button';
import { Skeleton } from '@/components/Skeleton';
import { Tag } from '@/components/Chip';
import { cn } from '@/lib/cn';
import type { SponsorshipTier } from '@/types';

const tierIcon: Record<SponsorshipTier, LucideIcon> = { bronze: Store, silver: Star, gold: Crown };

export function BusinessDashboardPage() {
  const navigate = useNavigate();
  const { user, dataVersion } = useSession();
  const data = useAsync(() => getMyBusiness(), [dataVersion]);

  if (data.loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-32 w-full rounded-card" />
        <Skeleton className="h-24 w-full rounded-card" />
      </div>
    );
  }

  if (!data.data) {
    return <p className="text-meta text-ink-soft">Could not load your business right now.</p>;
  }

  const { business, sponsorship, activities } = data.data;
  const TierIcon = sponsorship ? tierIcon[sponsorship.tier] : Store;
  const unlimited = sponsorship?.limit === 'unlimited';
  const pct =
    sponsorship && !unlimited && typeof sponsorship.limit === 'number' && sponsorship.limit > 0
      ? Math.min(100, Math.round((sponsorship.used / sponsorship.limit) * 100))
      : 0;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-meta text-ink-soft">Welcome back{user?.name ? `, ${user.name}` : ''}</p>
        <h1 className="font-display text-h1 font-medium text-ink">{business.name}</h1>
      </div>

      {/* Plan & usage */}
      <section className="rounded-card border border-border bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-[10px] bg-clay-soft text-clay">
              <TierIcon className="h-5 w-5" strokeWidth={1.7} />
            </span>
            <div>
              <p className="font-display text-h2 font-medium capitalize text-ink">
                {sponsorship ? `${sponsorship.tier} sponsorship` : 'No active plan'}
              </p>
              {sponsorship && (
                <p className="text-meta text-ink-soft">
                  ${(sponsorship.monthlyPriceCents / 100).toFixed(2)}/mo · since {format(new Date(sponsorship.startDate), 'd MMM yyyy')}
                </p>
              )}
            </div>
          </div>
          <Tag className={cn(sponsorship?.status === 'active' ? 'bg-olive-soft text-olive' : 'bg-surface-sunk text-ink-soft')}>
            {sponsorship?.status ?? 'inactive'}
          </Tag>
        </div>

        {sponsorship && (
          <div className="mt-5">
            <div className="flex items-center justify-between text-meta">
              <span className="text-ink-soft">Sponsored activities this month</span>
              <span className="font-semibold text-ink">
                {unlimited ? `${sponsorship.used} · Unlimited` : `${sponsorship.used} / ${sponsorship.limit}`}
              </span>
            </div>
            {!unlimited && (
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-sunk">
                <div className="h-full rounded-full bg-clay transition-all" style={{ width: `${pct}%` }} />
              </div>
            )}
            <p className="mt-2 text-[12px] text-ink-faint">
              {unlimited
                ? 'Unlimited venue usage on your plan.'
                : `${sponsorship.remaining} remaining — resets on the 1st of the month.`}
            </p>
          </div>
        )}
      </section>

      {/* Venue summary */}
      <section className="rounded-card border border-border bg-surface p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display text-h3 font-medium text-ink">Your venue</p>
            <p className="mt-1 flex items-center gap-1.5 text-meta text-ink-soft">
              <MapPin className="h-4 w-4 shrink-0 text-clay" strokeWidth={1.6} /> {business.address}
            </p>
            {business.description && <p className="mt-2 max-w-prose text-meta text-ink-soft">{business.description}</p>}
            <p className="mt-2 text-[12px] text-ink-faint">
              Status: <span className="font-medium capitalize text-ink-soft">{business.status}</span>
            </p>
          </div>
          <Button variant="outline" leftIcon={<Pencil className="h-4 w-4" />} onClick={() => navigate('/business/venue')}>
            Edit
          </Button>
        </div>
      </section>

      {/* Activities at venue */}
      <section>
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="font-display text-h2 font-medium text-ink">Activities at your venue</h2>
          <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => navigate('/business/create')}>
            Host activity
          </Button>
        </div>
        {activities.length === 0 ? (
          <div className="rounded-card border border-dashed border-border bg-surface p-6 text-center">
            <CalendarRange className="mx-auto h-7 w-7 text-ink-faint" strokeWidth={1.4} />
            <p className="mt-2 text-meta text-ink-soft">No meetups have used your venue yet.</p>
            <p className="text-[12px] text-ink-faint">Hosts will see your venue first when choosing a place.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activities.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-card border border-border bg-surface p-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-surface-sunk text-ink-soft">
                  <CalendarRange className="h-5 w-5" strokeWidth={1.6} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-h3 font-medium text-ink">{a.title}</p>
                  <p className="truncate text-[12px] text-ink-soft">
                    {a.activityType} · {format(new Date(a.startsAt), 'EEE d MMM')} · hosted by {a.hostName}
                  </p>
                </div>
                {a.couponCode && (
                  <Tag leftIcon={<Ticket className="h-3.5 w-3.5" strokeWidth={1.7} />} className="shrink-0 bg-majorelle-soft text-majorelle">
                    {a.couponCode}
                  </Tag>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
