import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { format, formatDistanceToNowStrict } from 'date-fns';
import { AlertTriangle, Building2, Check, Loader2, MapPin, Minus, Plus, Search, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/Button';
import { Input, Textarea } from '@/components/Field';
import { Chip } from '@/components/Chip';
import { ActivityIcon, resolveIcon } from '@/components/ActivityIcon';
import { MapView } from '@/components/MapView';
import { Sheet } from '@/components/Sheet';
import { useAsync } from '@/hooks/useAsync';
import { createCustomActivity, createEvent, getSubscriptionSummary, listActivities, listSponsoredVenues, listSpots } from '@/api';
import { ExpressPaymentBox } from '@/features/monetization/ExpressPaymentBox';
import { CITIES, GROUP_LABELS } from '@/api/catalog';
import { useSession } from '@/store/session';
import { toast } from '@/store/toast';
import { activityColor } from '@/lib/activityColors';
import type { Activity, ActivityGroup, EventLocation, GenderPreference, PriorityLevel, Visibility } from '@/types';
import { cn } from '@/lib/cn';

const ICON_OPTIONS = ['Sparkles', 'Coffee', 'Dices', 'Music', 'Palette', 'BookOpen', 'Camera', 'UtensilsCrossed', 'Languages', 'Laptop', 'Bike', 'Mountain', 'Waves', 'Goal', 'Dribbble', 'Footprints', 'Compass', 'Trees', 'HeartHandshake', 'Flower2'];
const STEP_COUNT = 5;
const FOUR_HOURS = 4 * 60 * 60 * 1000;
const groups: ActivityGroup[] = ['sport', 'outdoor', 'social'];
const genders: GenderPreference[] = ['any', 'women', 'men'];

// Soft client-side check for private-home venues (reporting catches the rest).
const PRIVATE_KEYWORDS = ['my place', 'my apartment', 'apartment', 'my home', 'my flat', 'my house', 'rooftop', 'chez moi', 'chez nous', 'villa', 'riad', 'home address'];
const looksPrivate = (s: string) => PRIVATE_KEYWORDS.some((k) => s.toLowerCase().includes(k));

export function CreateEventPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { city, bumpData, dataVersion } = useSession();

  const [step, setStep] = useState(0);
  const [publishing, setPublishing] = useState(false);

  const [activity, setActivity] = useState<Activity | null>(null);
  const [customOpen, setCustomOpen] = useState(false);

  const [spotId, setSpotId] = useState<string | undefined>();
  const [point, setPoint] = useState<EventLocation | null>(null);
  const [mapCity, setMapCity] = useState(city);
  // Map viewport — decoupled from clicks so picking a point doesn't recenter,
  // but switching city or searching a place does.
  const [mapCenter, setMapCenter] = useState(() => {
    const c = CITIES.find((x) => x.name === city) ?? CITIES[0];
    return { lat: c.lat, lng: c.lng };
  });
  const [mapZoom, setMapZoom] = useState(12);

  const [date, setDate] = useState(format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'));
  const [time, setTime] = useState('18:00');
  const [duration, setDuration] = useState(90);

  const [title, setTitle] = useState('');
  const [capacity, setCapacity] = useState(8);
  const [minPlayers, setMinPlayers] = useState(1);
  const [genderPref, setGenderPref] = useState<GenderPreference>('any');
  const [price, setPrice] = useState(0);
  const [description, setDescription] = useState('');
  const [travelers, setTravelers] = useState(true);
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [publicConfirmed, setPublicConfirmed] = useState(false);
  const [areaLabel, setAreaLabel] = useState('');
  const [priorityLevel, setPriorityLevel] = useState<PriorityLevel>('standard');
  const [expressPaymentIntentId, setExpressPaymentIntentId] = useState<string | undefined>();
  const [businessId, setBusinessId] = useState<string | undefined>();

  const startsAtMs = new Date(`${date}T${time}`).getTime();
  const timeValid = startsAtMs - Date.now() > FOUR_HOURS;

  const activities = useAsync(() => listActivities(), [dataVersion, customOpen]);
  const subscription = useAsync(() => getSubscriptionSummary(), [dataVersion]);
  const sponsoredVenues = useAsync(() => listSponsoredVenues(), [dataVersion]);
  const cityCenter = CITIES.find((c) => c.name === mapCity) ?? CITIES[0];
  const spots = useAsync(() => listSpots(mapCity), [mapCity]);

  const resolvedLocation: EventLocation | null = spotId
    ? (() => {
        const s = spots.data?.find((x) => x.id === spotId);
        return s ? { lat: s.lat, lng: s.lng, label: s.name } : null;
      })()
    : point;

  function pickActivity(a: Activity) {
    setActivity(a);
  }

  async function handleCustomActivity(input: { name: string; lucideIcon: string; group: ActivityGroup; outdoor: boolean }) {
    const a = await createCustomActivity({
      ...input,
      vibe: 'chill',
      category: input.group === 'social' ? 'social' : 'other',
    });
    bumpData();
    pickActivity(a);
    setCustomOpen(false);
    toast(`${a.name} added`, 'success');
  }

  async function publish() {
    if (!activity || !resolvedLocation) return;
    setPublishing(true);
    try {
      const created = await createEvent({
        activityId: activity.id,
        title: (title || `${activity.name} meetup`).slice(0, 60),
        spotId,
        location: spotId ? undefined : resolvedLocation,
        areaLabel: areaLabel.trim() || undefined,
        startsAt: new Date(startsAtMs).toISOString(),
        durationMins: duration,
        capacity,
        minPlayers: Math.min(minPlayers, capacity),
        skillLevel: 'any',
        price,
        description: description || `Join me for ${activity.name}!`,
        travelersWelcome: travelers,
        visibility,
        vibe: 'chill',
        genderPreference: genderPref,
        publicPlaceConfirmed: publicConfirmed,
        priorityLevel,
        expressPaymentIntentId,
        businessId,
      });
      bumpData();
      toast(created.approvedAt ? t('create.published') : t('create.submitted'), 'success');
      navigate(`/event/${created.id}`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not publish', 'error');
    } finally {
      setPublishing(false);
    }
  }

  // The host still has their free weekly activity if they aren't out of credits.
  // ('unlimited' for subscribers, a positive number otherwise; undefined while
  // loading — treated as available so the flow isn't blocked.)
  const freeAvailable = subscription.data?.remaining !== 0;

  const privateWarn = looksPrivate(`${title} ${resolvedLocation?.label ?? ''}`);
  const canNext =
    step === 0 ? !!activity
    : step === 1 ? !!resolvedLocation && publicConfirmed
    : step === 2 ? timeValid
    : step === 3 ? title.trim().length > 0
    : step === 4 ? (freeAvailable ? priorityLevel === 'standard' || !!expressPaymentIntentId : !!expressPaymentIntentId)
    : true;
  const isLast = step === STEP_COUNT - 1;

  // Group the catalog by high-level group for step 1.
  const grouped = groups.map((g) => ({ group: g, items: (activities.data ?? []).filter((a) => a.group === g) }));

  return (
    <div className="flex min-h-screen flex-col bg-bg md:min-h-0">
      <PageHeader title={t('create.title')} back={step > 0} onBack={() => setStep((s) => s - 1)} />
      <div className="mx-auto flex w-full max-w-app flex-1 flex-col px-5 pb-6 md:max-w-md">
        <div className="mb-5 mt-3 flex items-center gap-3">
          <div className="flex flex-1 gap-1.5">
            {Array.from({ length: STEP_COUNT }).map((_, i) => (
              <div key={i} className={cn('h-1 flex-1 rounded-full transition-colors duration-300', i <= step ? 'bg-clay' : 'bg-border')} />
            ))}
          </div>
          <span className="text-[12px] font-medium text-ink-faint">{t('create.step', { n: step + 1, total: STEP_COUNT })}</span>
        </div>

        <div className="flex-1 animate-fade-in" key={step}>
          {/* STEP 1 — activity */}
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="font-display text-h1 font-medium">{t('create.chooseActivity')}</h2>
              <div className="rounded-card border border-border bg-surface p-3 text-meta text-ink-soft">
                Host plan: <span className="font-semibold capitalize text-ink">{subscription.data?.plan ?? 'free'}</span>
                <span className="mx-1">·</span>
                Remaining free activities: <span className="font-semibold text-ink">{subscription.data?.remaining ?? '...'}</span>
              </div>
              {grouped.map(({ group, items }) => (
                <div key={group}>
                  <p className="mb-2 text-meta font-semibold uppercase tracking-wide text-ink-faint">{GROUP_LABELS[group]}</p>
                  <div className="grid grid-cols-3 gap-2.5">
                    {items.map((a) => {
                      const on = activity?.id === a.id;
                      return (
                        <button
                          key={a.id}
                          onClick={() => pickActivity(a)}
                          className={cn('relative flex flex-col items-center gap-2 rounded-card border p-3 transition-colors cursor-pointer', on ? 'border-clay bg-clay-soft' : 'border-border bg-surface hover:border-ink/20')}
                        >
                          {on && <span className="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-clay text-white"><Check className="h-3 w-3" strokeWidth={2.4} /></span>}
                          <ActivityIcon activity={a} size="md" tile />
                          <span className="text-center text-[12px] font-medium leading-tight text-ink-soft">{a.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button onClick={() => setCustomOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-card border border-dashed border-clay/50 bg-clay-soft/50 py-3.5 text-meta font-semibold text-clay cursor-pointer hover:bg-clay-soft">
                <Plus className="h-4 w-4" strokeWidth={1.8} /> {t('create.orCustom')}
              </button>
            </div>
          )}

          {/* STEP 2 — place */}
          {step === 1 && (
            <div>
              <h2 className="font-display text-h1 font-medium">{t('create.placeTitle')}</h2>
              {(sponsoredVenues.data?.length ?? 0) > 0 && (
                <div className="mt-3 rounded-card border border-border bg-surface p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-meta font-semibold text-ink">
                    <Building2 className="h-4 w-4 text-majorelle" strokeWidth={1.7} /> Sponsored venues
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {sponsoredVenues.data!.map((v) => (
                      <Chip
                        key={v.id}
                        active={businessId === v.id}
                        onClick={() => setBusinessId((prev) => (prev === v.id ? undefined : v.id))}
                        activeClassName="bg-majorelle text-white"
                      >
                        {v.name} · <span className="capitalize">{v.tier}</span>
                      </Chip>
                    ))}
                  </div>
                  {businessId && <p className="mt-1.5 text-[12px] text-ink-faint">Venue sponsor selected. Your activity will be linked to their profile.</p>}
                </div>
              )}
              <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1">
                {CITIES.map((c) => (
                  <Chip key={c.id} active={mapCity === c.name} onClick={() => { setMapCity(c.name); setSpotId(undefined); setPoint(null); setMapCenter({ lat: c.lat, lng: c.lng }); setMapZoom(12); }} activeClassName="bg-clay text-white">{c.name}</Chip>
                ))}
              </div>
              <p className="mb-2 mt-4 text-meta font-semibold text-ink">{t('create.savedSpots')}</p>
              <div className="mb-4 flex flex-wrap gap-2">
                {spots.data?.map((s) => (
                  <Chip key={s.id} active={spotId === s.id} onClick={() => { setSpotId(s.id); setPoint(null); }} leftIcon={<MapPin className="h-3.5 w-3.5" strokeWidth={1.6} />} activeClassName="bg-olive text-white">{s.name}</Chip>
                ))}
              </div>
              <p className="mb-2 text-meta font-semibold text-ink">Search a place</p>
              <PlaceSearch
                city={mapCity}
                cityCenter={cityCenter}
                onSelect={(p) => {
                  setPoint({ lat: p.lat, lng: p.lng, label: p.label });
                  setSpotId(undefined);
                  setMapCenter({ lat: p.lat, lng: p.lng });
                  setMapZoom(15);
                }}
              />
              <p className="mb-2 mt-4 text-meta font-semibold text-ink">{t('create.pickOnMap')}</p>
              <MapView center={mapCenter} zoom={mapZoom} onPick={(lat, lng) => { setPoint({ lat, lng, label: `Custom point · ${mapCity}` }); setSpotId(undefined); }} pickedPoint={point} className="h-56 rounded-card border border-border" />
              {resolvedLocation && (
                <p className="mt-2 flex items-center gap-1.5 text-meta font-medium text-olive"><MapPin className="h-4 w-4" strokeWidth={1.6} /> {resolvedLocation.label}</p>
              )}
              {privateWarn && (
                <div className="mt-3 flex items-start gap-2 rounded-card border border-saffron/40 bg-saffron-soft px-3 py-2.5 text-meta text-ink">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-saffron" strokeWidth={1.7} />
                  <span>{t('create.privateWarn')}</span>
                </div>
              )}
              <button onClick={() => setPublicConfirmed((v) => !v)} className={cn('mt-3 flex w-full items-start gap-3 rounded-card border p-3.5 text-left transition-colors cursor-pointer', publicConfirmed ? 'border-olive bg-olive-soft' : 'border-border bg-surface hover:border-ink/20')}>
                <span className={cn('mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border', publicConfirmed ? 'border-olive bg-olive text-white' : 'border-ink/30')}>
                  {publicConfirmed && <Check className="h-3.5 w-3.5" strokeWidth={2.6} />}
                </span>
                <span className="flex items-center gap-1.5 text-meta font-medium text-ink"><ShieldCheck className="h-4 w-4 text-olive" strokeWidth={1.7} /> {t('create.publicPlace')}</span>
              </button>
              <div className="mt-4">
                <Input
                  label={t('create.areaLabel')}
                  hint={t('create.areaHint')}
                  placeholder={t('create.areaPlaceholder')}
                  value={areaLabel}
                  onChange={(e) => setAreaLabel(e.target.value)}
                />
              </div>
            </div>
          )}

          {/* STEP 3 — when */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-display text-h1 font-medium">{t('create.whenTitle')}</h2>
              <Input type="date" label={t('create.date')} value={date} onChange={(e) => setDate(e.target.value)} />
              <Input type="time" label={t('create.time')} value={time} onChange={(e) => setTime(e.target.value)} />
              <p className={cn('flex items-center gap-1.5 text-[12px]', timeValid ? 'text-ink-faint' : 'text-clay')}>
                <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.7} /> {timeValid ? t('create.timeRuleHint') : t('create.timeRuleError')}
              </p>
              <div>
                <span className="mb-1.5 block text-meta font-medium text-ink-soft">{t('create.duration')}</span>
                <div className="flex flex-wrap gap-2">
                  {[60, 90, 120, 150, 180].map((d) => (
                    <Chip key={d} active={duration === d} onClick={() => setDuration(d)} activeClassName="bg-clay text-white">{d} min</Chip>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 4 — details */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-display text-h1 font-medium">{t('create.detailsTitle')}</h2>
              <div>
                <Input label={t('create.eventTitle')} placeholder={t('create.titlePlaceholder')} value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
                <p className="mt-1 text-right text-[12px] text-ink-faint">{t('create.titleCount', { n: title.length })}</p>
              </div>
              <div>
                <span className="mb-1.5 block text-meta font-medium text-ink-soft">{t('create.genderPref')}</span>
                <div className="flex gap-2">
                  {genders.map((g) => (
                    <Chip key={g} active={genderPref === g} onClick={() => setGenderPref(g)} activeClassName="bg-clay text-white">
                      {t(`create.gender${g === 'any' ? 'Any' : g === 'women' ? 'Women' : 'Men'}`)}
                    </Chip>
                  ))}
                </div>
              </div>
              <Stepper label={t('create.capacity')} value={capacity} min={2} max={12} onChange={(v) => { setCapacity(v); if (minPlayers > v) setMinPlayers(v); }} />
              <Stepper label={t('create.minPlayers')} hint={t('create.minPlayersHint')} value={minPlayers} min={1} max={capacity} onChange={setMinPlayers} />
              <div>
                <span className="mb-1.5 block text-meta font-medium text-ink-soft">{t('create.price')}</span>
                <div className="flex items-center gap-3">
                  <button onClick={() => setPrice(0)} className={cn('rounded-input px-4 py-2.5 text-meta font-medium transition-colors cursor-pointer', price === 0 ? 'bg-olive text-white' : 'border border-border bg-surface text-ink-soft')}>{t('create.priceFree')}</button>
                  <input type="number" min={0} value={price || ''} onChange={(e) => setPrice(Math.max(0, Number(e.target.value)))} placeholder="0" className="w-28 rounded-input border border-border bg-surface px-4 py-2.5 text-[15px]" />
                  <span className="text-meta text-ink-soft">MAD</span>
                </div>
              </div>
              <Textarea label={t('create.description')} placeholder={t('create.descPlaceholder')} value={description} onChange={(e) => setDescription(e.target.value)} />
              <ToggleRow label={t('create.travelersWelcome')} on={travelers} onToggle={() => setTravelers((v) => !v)} />
              <div>
                <span className="mb-1.5 block text-meta font-medium text-ink-soft">{t('create.visibility')}</span>
                <div className="flex gap-2">
                  <Chip active={visibility === 'public'} onClick={() => setVisibility('public')} activeClassName="bg-ink text-bg">{t('create.public')}</Chip>
                  <Chip active={visibility === 'invite'} onClick={() => setVisibility('invite')} activeClassName="bg-ink text-bg">{t('create.invite')}</Chip>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5 — review + extra-activity fee */}
          {step === 4 && activity && resolvedLocation && (
            <div className="space-y-4">
              <h2 className="font-display text-h1 font-medium">{t('create.review')}</h2>
              <div className="overflow-hidden rounded-card border border-border bg-surface">
                <div className="flex items-center gap-3 p-4">
                  <ActivityIcon activity={activity} size="lg" tile />
                  <div>
                    <p className={`text-[12px] font-medium ${activityColor(activity.colorToken).text}`}>{activity.name}</p>
                    <h3 className="font-display text-h2 font-medium leading-tight">{title || `${activity.name} meetup`}</h3>
                  </div>
                </div>
                <dl className="divide-y divide-border border-t border-border text-meta">
                  <Row k={t('event.location')} v={resolvedLocation.label} />
                  <Row k={t('create.date')} v={`${format(new Date(`${date}T${time}`), 'EEE d MMM')} · ${time}`} />
                  <Row k={t('create.capacity')} v={`${capacity} · min ${minPlayers}`} />
                  <Row k={t('create.price')} v={price === 0 ? t('create.priceFree') : `${price} MAD`} />
                  <Row k={t('create.travelersWelcome')} v={travelers ? t('common.done') : '—'} />
                </dl>
              </div>
              {subscription.data?.remaining === 'unlimited' ? (
                <p className="rounded-card border border-border bg-surface p-4 text-meta text-ink-soft">
                  Your {subscription.data.plan} plan includes unlimited hosting — no extra fee.
                </p>
              ) : (
                <>
                  {subscription.data?.remaining === 0 && (
                    <p className="rounded-input border border-saffron/40 bg-saffron-soft px-3 py-2 text-[12px] font-medium text-ink">
                      {subscription.data.resetsAt
                        ? `Next free activity in ${formatDistanceToNowStrict(new Date(subscription.data.resetsAt))}. Choose a paid option below to host now.`
                        : 'You’ve used your free activity this week. Choose a paid option below to host another.'}
                    </p>
                  )}
                  <ExpressPaymentBox
                    value={priorityLevel}
                    paymentIntentId={expressPaymentIntentId}
                    freeAvailable={freeAvailable}
                    onChange={(level, intentId) => {
                      setPriorityLevel(level);
                      setExpressPaymentIntentId(intentId);
                    }}
                  />
                </>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex gap-3">
          {step > 0 && <Button variant="outline" size="lg" onClick={() => setStep((s) => s - 1)}>{t('create.back')}</Button>}
          <Button size="lg" fullWidth disabled={!canNext} loading={publishing} onClick={() => (isLast ? publish() : setStep((s) => s + 1))}>
            {isLast ? t('create.publish') : t('create.next')}
          </Button>
        </div>
      </div>

      <CustomActivitySheet open={customOpen} onClose={() => setCustomOpen(false)} onCreate={handleCustomActivity} />
    </div>
  );
}

interface PlaceResult {
  lat: number;
  lng: number;
  label: string;
}

function placeLabel(r: { name?: string; display_name?: string }): string {
  const name = r.name?.trim();
  if (name) return name;
  return (r.display_name ?? '').split(',').slice(0, 2).join(', ').trim();
}

/**
 * Place search scoped to the chosen city. Geocodes via OpenStreetMap Nominatim
 * (free, no key, CORS-enabled). Results bias to a box around the city centre.
 * Nominatim asks for ≤1 req/s, so the query is debounced; for production, swap
 * in a paid geocoder or a self-hosted instance.
 */
function PlaceSearch({
  city,
  cityCenter,
  onSelect,
}: {
  city: string;
  cityCenter: { lat: number; lng: number };
  onSelect: (p: PlaceResult) => void;
}) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const d = 0.25; // ~25km bias box around the city centre
        const viewbox = `${cityCenter.lng - d},${cityCenter.lat + d},${cityCenter.lng + d},${cityCenter.lat - d}`;
        const url =
          `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6` +
          `&countrycodes=ma&accept-language=en&viewbox=${viewbox}&bounded=0` +
          `&q=${encodeURIComponent(`${query}, ${city}`)}`;
        const res = await fetch(url, { signal: ctrl.signal });
        const json = (await res.json()) as { lat: string; lon: string; name?: string; display_name?: string }[];
        setResults(json.map((r) => ({ lat: parseFloat(r.lat), lng: parseFloat(r.lon), label: placeLabel(r) })));
      } catch (err) {
        if (!(err instanceof DOMException)) setResults([]);
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q, city, cityCenter.lat, cityCenter.lng]);

  return (
    <div className="mb-1">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-ink-faint" strokeWidth={1.6} />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setTouched(true); }}
          placeholder={`Search a place in ${city}…`}
          className="w-full rounded-input border border-border bg-surface py-3 pl-11 pr-10 text-[15px] placeholder:text-ink-faint focus:border-clay"
        />
        {loading && <Loader2 className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-ink-faint" strokeWidth={1.8} />}
      </div>
      {results.length > 0 && (
        <ul className="mt-2 overflow-hidden rounded-card border border-border bg-surface">
          {results.map((r, i) => (
            <li key={`${r.lat}-${r.lng}-${i}`}>
              <button
                type="button"
                onClick={() => { onSelect(r); setQ(r.label); setResults([]); }}
                className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left text-meta text-ink hover:bg-surface-sunk cursor-pointer transition-colors"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-clay" strokeWidth={1.6} />
                <span className="leading-snug">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {touched && !loading && q.trim().length >= 3 && results.length === 0 && (
        <p className="mt-2 text-[12px] text-ink-faint">No places found in {city}. Try another name or pick on the map.</p>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-2.5">
      <dt className="text-ink-soft">{k}</dt>
      <dd className="text-right font-medium text-ink">{v}</dd>
    </div>
  );
}

function Stepper({ label, hint, value, min, max, onChange }: { label: string; hint?: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div>
      <span className="mb-1.5 block text-meta font-medium text-ink-soft">{label}</span>
      <div className="flex items-center gap-4 rounded-input border border-border bg-surface p-1.5">
        <button onClick={() => onChange(Math.max(min, value - 1))} className="grid h-9 w-9 place-items-center rounded-[8px] bg-surface-sunk cursor-pointer hover:bg-border" aria-label="Decrease"><Minus className="h-4 w-4" strokeWidth={1.8} /></button>
        <span className="flex-1 text-center font-display text-h2 font-medium">{value}</span>
        <button onClick={() => onChange(Math.min(max, value + 1))} className="grid h-9 w-9 place-items-center rounded-[8px] bg-surface-sunk cursor-pointer hover:bg-border" aria-label="Increase"><Plus className="h-4 w-4" strokeWidth={1.8} /></button>
      </div>
      {hint && <span className="mt-1.5 block text-[12px] text-ink-faint">{hint}</span>}
    </div>
  );
}

function ToggleRow({ label, on, onToggle }: { label: string; on: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} className="flex w-full items-center justify-between rounded-input border border-border bg-surface px-4 py-3.5 cursor-pointer">
      <span className="text-[15px] font-medium text-ink">{label}</span>
      <span className={cn('relative h-6 w-11 rounded-full transition-colors', on ? 'bg-clay' : 'bg-border')}>
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-transform', on ? 'translate-x-[22px]' : 'translate-x-0.5')} />
      </span>
    </button>
  );
}

function CustomActivitySheet({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (i: { name: string; lucideIcon: string; group: ActivityGroup; outdoor: boolean }) => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICON_OPTIONS[0]);
  const [group, setGroup] = useState<ActivityGroup>('social');
  const [outdoor, setOutdoor] = useState(false);

  return (
    <Sheet open={open} onClose={onClose} title={t('create.orCustom')}>
      <div className="space-y-4">
        <Input label={t('create.customName')} placeholder="e.g. Frisbee" value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <span className="mb-1.5 block text-meta font-medium text-ink-soft">{t('create.customIcon')}</span>
          <div className="grid grid-cols-8 gap-2">
            {ICON_OPTIONS.map((key) => {
              const Glyph = resolveIcon(key);
              return (
                <button key={key} onClick={() => setIcon(key)} className={cn('grid h-9 place-items-center rounded-[9px] border transition-colors cursor-pointer', icon === key ? 'border-clay bg-clay-soft text-clay' : 'border-border bg-surface text-ink-soft hover:border-ink/20')}>
                  <Glyph className="h-[18px] w-[18px]" strokeWidth={1.6} />
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <span className="mb-1.5 block text-meta font-medium text-ink-soft">{t('create.customGroup')}</span>
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => (
              <Chip key={g} active={group === g} onClick={() => setGroup(g)} activeClassName="bg-clay text-white">{GROUP_LABELS[g]}</Chip>
            ))}
          </div>
        </div>
        <ToggleRow label={t('create.outdoor')} on={outdoor} onToggle={() => setOutdoor((v) => !v)} />
        <Button size="lg" fullWidth disabled={!name.trim()} onClick={() => onCreate({ name: name.trim(), lucideIcon: icon, group, outdoor })}>
          {t('create.addActivity')}
        </Button>
      </div>
    </Sheet>
  );
}
