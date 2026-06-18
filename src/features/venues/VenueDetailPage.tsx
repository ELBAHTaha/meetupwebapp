import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarRange, Globe, MapPin, Phone, Star, Store } from 'lucide-react';
import { claimVenue, getMyBusinesses, getVenue, submitVenueReview } from '@/api';
import { useAsync } from '@/hooks/useAsync';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Textarea } from '@/components/Field';
import { Tag } from '@/components/Chip';
import { Skeleton } from '@/components/Skeleton';
import { toast } from '@/store/toast';
import { formatRelative } from '@/lib/format';

export function VenueDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);
  const venue = useAsync(() => getVenue(id), [id, version]);
  const myBiz = useAsync(() => getMyBusinesses().catch(() => []), []);

  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [claiming, setClaiming] = useState(false);

  async function submitReview() {
    if (!rating) return toast('Pick a star rating first', 'info');
    setSubmitting(true);
    try {
      await submitVenueReview(id, rating, text || undefined);
      toast('Thanks for your review!', 'success');
      setRating(0);
      setText('');
      setVersion((v) => v + 1);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not submit review', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  async function claim(businessId: string) {
    setClaiming(true);
    try {
      await claimVenue(id, businessId);
      toast('Claim submitted — our team will review it.', 'success');
      setVersion((v) => v + 1);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not submit claim', 'error');
    } finally {
      setClaiming(false);
    }
  }

  if (venue.loading || !venue.data) {
    return (
      <div className="px-5 pt-3 md:px-0">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-3 h-60 w-full rounded-card" />
      </div>
    );
  }

  const v = venue.data;
  const manageableBiz = (myBiz.data ?? []).filter((b) => b.role === 'owner' || b.role === 'manager');
  const canClaim = v.status === 'listed' && !v.businessId && manageableBiz.length > 0;

  return (
    <div>
      <PageHeader back title={v.name} onBack={() => navigate('/venues')} />
      <div className="space-y-4 px-5 pt-3 pb-8 md:px-0">
        {/* Header card */}
        <div className="rounded-card border border-border bg-surface p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-card bg-surface-sunk text-ink-soft">
              {v.photos[0] ? <img src={v.photos[0]} alt="" className="h-full w-full object-cover" /> : <Store className="h-7 w-7" strokeWidth={1.6} />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-h1 font-medium text-ink">{v.name}</h2>
                {v.status === 'verified' && <Tag className="bg-olive-soft text-olive">Verified</Tag>}
                {v.business && <Tag className="bg-majorelle-soft text-majorelle">{v.business.name}</Tag>}
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-meta text-ink-soft"><MapPin className="h-4 w-4" strokeWidth={1.6} /> {v.address}</p>
              <div className="mt-1.5 flex items-center gap-2 text-meta text-ink-soft">
                <span className="flex items-center gap-1"><Star className="h-4 w-4 text-saffron" strokeWidth={1.8} /> {v.avgRating.toFixed(1)}</span>
                <span className="text-ink-faint">· {v.reviewCount} reviews</span>
                <Tag className="bg-surface-sunk text-ink-soft capitalize">{v.category.replace(/_/g, ' ')}</Tag>
              </div>
            </div>
          </div>
          {v.description && <p className="mt-3 text-meta text-ink">{v.description}</p>}
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-soft">
            {v.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" strokeWidth={1.6} /> {v.phone}</span>}
            {v.website && <a href={v.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-clay underline"><Globe className="h-3.5 w-3.5" strokeWidth={1.6} /> Website</a>}
          </div>
          {v.amenities.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {v.amenities.map((a) => <Tag key={a} className="bg-surface-sunk text-ink-soft">{a}</Tag>)}
            </div>
          )}
        </div>

        {/* Claim CTA for unclaimed venues */}
        {canClaim && (
          <div className="rounded-card border border-dashed border-clay/50 bg-clay-soft/30 p-4">
            <p className="font-display text-h3 font-medium text-ink">Is this your venue?</p>
            <p className="mt-1 text-meta text-ink-soft">Claim it to manage its profile and host activities here.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {manageableBiz.map((b) => (
                <Button key={b.id} size="sm" loading={claiming} onClick={() => claim(b.id)}>
                  Claim as {b.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Upcoming events */}
        {v.upcomingEvents.length > 0 && (
          <div className="rounded-card border border-border bg-surface p-5">
            <p className="font-display text-h3 font-medium text-ink">Upcoming here</p>
            <div className="mt-3 space-y-2">
              {v.upcomingEvents.map((e) => (
                <button key={e.id} onClick={() => navigate(`/event/${e.id}`)} className="flex w-full items-center gap-3 rounded-card border border-border bg-bg px-3 py-2.5 text-left hover:border-clay/40 cursor-pointer">
                  <CalendarRange className="h-4 w-4 shrink-0 text-clay" strokeWidth={1.6} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-meta font-medium text-ink">{e.title}</p>
                    <p className="text-[12px] text-ink-soft">{e.activityType} · {e.hostName} · {formatRelative(e.startsAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        <div className="rounded-card border border-border bg-surface p-5">
          <p className="font-display text-h3 font-medium text-ink">Reviews</p>

          {/* Write a review */}
          <div className="mt-3 rounded-card border border-border bg-bg p-3">
            <p className="text-[12px] font-medium text-ink-soft">Attended an activity here? Leave a review.</p>
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`} className="cursor-pointer">
                  <Star className={n <= rating ? 'h-6 w-6 fill-saffron text-saffron' : 'h-6 w-6 text-ink-faint'} strokeWidth={1.6} />
                </button>
              ))}
            </div>
            <Textarea className="mt-2" placeholder="Share what it was like (optional)" value={text} onChange={(e) => setText(e.target.value)} />
            <div className="mt-2 flex justify-end">
              <Button size="sm" loading={submitting} onClick={submitReview}>Submit review</Button>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {v.reviews.length === 0 && <p className="text-meta text-ink-faint">No reviews yet.</p>}
            {v.reviews.map((r) => (
              <div key={r.id} className="rounded-card border border-border bg-bg px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-meta font-medium text-ink">{r.authorName}</span>
                  <span className="flex items-center gap-1 text-[12px] text-saffron"><Star className="h-3.5 w-3.5 fill-saffron" strokeWidth={1.6} /> {r.rating}</span>
                </div>
                {r.text && <p className="mt-1 text-meta text-ink-soft">{r.text}</p>}
                <p className="mt-1 text-[11px] text-ink-faint">{formatRelative(r.createdAt)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
