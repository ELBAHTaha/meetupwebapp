import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin } from 'lucide-react';
import { format } from 'date-fns';
import { createEvent, getMyBusiness, listActivities } from '@/api';
import { useAsync } from '@/hooks/useAsync';
import { useSession } from '@/store/session';
import { Button } from '@/components/Button';
import { Input, Textarea } from '@/components/Field';
import { Skeleton } from '@/components/Skeleton';
import { toast } from '@/store/toast';

const FOUR_HOURS = 4 * 60 * 60 * 1000;
const CASA = { lat: 33.5731, lng: -7.5898 };

/** Best-effort geocode of the venue address (Morocco-scoped Nominatim). */
async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ma&accept-language=en` +
      `&q=${encodeURIComponent(address)}`;
    const res = await fetch(url);
    const json = (await res.json()) as { lat: string; lon: string }[];
    if (json[0]) return { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) };
  } catch {
    /* ignore — fall back to a city default */
  }
  return null;
}

export function BusinessCreateActivityPage() {
  const navigate = useNavigate();
  const bump = useSession((s) => s.bumpData);
  const biz = useAsync(() => getMyBusiness(), []);
  const activities = useAsync(() => listActivities(), []);

  const [activityId, setActivityId] = useState('');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(format(new Date(Date.now() + 2 * 86_400_000), 'yyyy-MM-dd'));
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState(90);
  const [capacity, setCapacity] = useState(8);
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const startsAtMs = new Date(`${date}T${time}`).getTime();
  const timeValid = startsAtMs - Date.now() > FOUR_HOURS;

  async function submit() {
    if (!biz.data) return;
    if (!activityId) return toast('Pick an activity type', 'error');
    if (!timeValid) return toast('Start time must be more than 4 hours from now', 'error');
    setSaving(true);
    try {
      const b = biz.data.business;
      let coords = b.lat != null && b.lng != null ? { lat: b.lat, lng: b.lng } : null;
      if (!coords) coords = await geocode(b.address);
      if (!coords) coords = CASA;
      await createEvent({
        activityId,
        title: (title || `${b.name} meetup`).slice(0, 60),
        location: { lat: coords.lat, lng: coords.lng, label: b.name },
        address: b.address,
        startsAt: new Date(startsAtMs).toISOString(),
        durationMins: duration,
        capacity,
        minPlayers: 1,
        skillLevel: 'any',
        price: 0,
        description: description || `Hosted at ${b.name}.`,
        travelersWelcome: true,
        visibility: 'public',
        vibe: 'chill',
        genderPreference: 'any',
        publicPlaceConfirmed: true,
        businessId: b.id,
      });
      bump();
      toast('Activity created 🎉', 'success');
      navigate('/business/dashboard');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not create activity', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (biz.loading) {
    return (
      <div className="mx-auto max-w-xl space-y-3">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-80 w-full rounded-card" />
      </div>
    );
  }

  const venue = biz.data?.business;

  return (
    <div className="mx-auto max-w-xl">
      <button onClick={() => navigate('/business/dashboard')} className="mb-3 inline-flex items-center gap-1.5 text-meta font-medium text-ink-soft hover:text-ink cursor-pointer">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.8} /> Back to dashboard
      </button>
      <h1 className="font-display text-h1 font-medium text-ink">Host an activity</h1>
      <p className="mt-1 text-meta text-ink-soft">Create a meetup at your venue. It counts toward your monthly sponsorship usage.</p>

      <div className="mt-5 space-y-4 rounded-card border border-border bg-surface p-5">
        {/* Venue (fixed) */}
        <div className="flex items-center gap-2 rounded-input border border-border bg-bg px-3.5 py-3 text-meta text-ink-soft">
          <MapPin className="h-4 w-4 shrink-0 text-clay" strokeWidth={1.6} />
          <span className="truncate"><span className="font-medium text-ink">{venue?.name}</span> · {venue?.address}</span>
        </div>

        {/* Activity type */}
        <label className="block">
          <span className="mb-1.5 block text-meta font-medium text-ink-soft">Activity type</span>
          <select
            value={activityId}
            onChange={(e) => setActivityId(e.target.value)}
            className="w-full rounded-input border border-border bg-surface px-3.5 py-3 text-[15px] text-ink transition-colors focus:border-clay focus:ring-2 focus:ring-clay/20"
          >
            <option value="" disabled>{activities.loading ? 'Loading…' : 'Choose an activity'}</option>
            {activities.data?.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </label>

        <Input label="Title" placeholder="e.g. Sunday boardgames night" value={title} onChange={(e) => setTitle(e.target.value)} />

        <div className="grid grid-cols-2 gap-4">
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        {!timeValid && <p className="-mt-1 text-[12px] font-medium text-clay">Pick a time more than 4 hours from now.</p>}

        <div className="grid grid-cols-2 gap-4">
          <Input label="Duration (min)" type="number" min={30} step={15} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
          <Input label="Capacity" type="number" min={2} max={12} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} />
        </div>

        <Textarea label="Description" placeholder="What's the meetup about?" value={description} onChange={(e) => setDescription(e.target.value)} />

        <Button size="lg" fullWidth loading={saving} disabled={!activityId || !timeValid} onClick={submit}>
          Create activity
        </Button>
      </div>
    </div>
  );
}
