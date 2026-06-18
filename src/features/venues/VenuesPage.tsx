import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Search, Star, Store } from 'lucide-react';
import { listVenues } from '@/api';
import { useAsync } from '@/hooks/useAsync';
import { PageHeader } from '@/components/PageHeader';
import { Input } from '@/components/Field';
import { Tag } from '@/components/Chip';
import { EmptyState } from '@/components/EmptyState';
import { Skeleton } from '@/components/Skeleton';
import type { VenueCard } from '@/types';

export function VenuesPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const venues = useAsync(() => listVenues(), []);

  const filtered = (venues.data ?? []).filter((v) =>
    q ? v.name.toLowerCase().includes(q.toLowerCase()) || v.address.toLowerCase().includes(q.toLowerCase()) : true,
  );

  return (
    <div>
      <PageHeader back title="Venues" onBack={() => navigate('/discover')} />
      <div className="px-5 pt-3 md:px-0">
        <p className="text-meta text-ink-soft">Places that host activities — cafés, clubs, gardens and more.</p>

        <div className="mt-4">
          <Input
            placeholder="Search venues"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            leftIcon={<Search className="h-5 w-5" strokeWidth={1.6} />}
          />
        </div>

        <div className="mt-4 grid gap-3 pb-8 sm:grid-cols-2">
          {venues.loading ? (
            <>
              <Skeleton className="h-28 w-full rounded-card" />
              <Skeleton className="h-28 w-full rounded-card" />
            </>
          ) : filtered.length > 0 ? (
            filtered.map((v) => <VenueListCard key={v.id} venue={v} onOpen={() => navigate(`/venues/${v.id}`)} />)
          ) : (
            <div className="sm:col-span-2">
              <EmptyState icon={Store} title="No venues found" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function VenueListCard({ venue, onOpen }: { venue: VenueCard; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="flex gap-3 rounded-card border border-border bg-surface p-4 text-left transition-colors hover:border-clay/40 cursor-pointer">
      <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-card bg-surface-sunk text-ink-soft">
        {venue.photos[0] ? <img src={venue.photos[0]} alt="" className="h-full w-full object-cover" /> : <Store className="h-6 w-6" strokeWidth={1.6} />}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-display text-h3 font-medium text-ink">{venue.name}</p>
          {venue.status === 'verified' && <Tag className="bg-olive-soft text-olive">Verified</Tag>}
        </div>
        <p className="mt-0.5 flex items-center gap-1 truncate text-[12px] text-ink-soft">
          <MapPin className="h-3.5 w-3.5 shrink-0" strokeWidth={1.6} /> {venue.address}
        </p>
        <div className="mt-1.5 flex items-center gap-2 text-[12px] text-ink-soft">
          <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-saffron" strokeWidth={1.8} /> {venue.avgRating.toFixed(1)}</span>
          <span className="text-ink-faint">· {venue.reviewCount} reviews</span>
          <Tag className="bg-surface-sunk text-ink-soft capitalize">{venue.category.replace(/_/g, ' ')}</Tag>
        </div>
      </div>
    </button>
  );
}
