// ---------------------------------------------------------------------------
// Photography system. Every activity, group and seed spot maps to a warm-toned
// images.unsplash.com photo. Images are a progressive enhancement: <SmartImage>
// falls back to a tonal block + line icon if a URL ever fails to load, so the UI
// always looks deliberate.
// ---------------------------------------------------------------------------
import type { ActivityGroup, EnrichedEvent } from '@/types';

const U = 'https://images.unsplash.com/photo-';
const P = '?auto=format&fit=crop&w=900&q=70';
const img = (id: string) => `${U}${id}${P}`;

// Per-activity hero imagery (warm, people-doing-the-thing or the place).
const ACTIVITY_IMAGES: Record<string, string> = {
  padel: img('1626224583764-f87db24ac4ea'),
  football: img('1431324155629-1a6deb1dec8d'),
  basketball: img('1546519638-68e109498ffc'),
  beachvolley: img('1612872087720-bb876e2e67d1'),
  running: img('1476480862126-209bfaa8edc8'),
  swimming: img('1530549387789-4c1017266635'),
  yoga: img('1544367567-0f2fcb009e0b'),
  surfing: img('1502680390469-be75c86b636f'),
  kitesurf: img('1559827260-dc66d52bef19'),
  windsurf: img('1530870110042-98b2cb110834'),
  hiking: img('1551632811-561732d1e306'),
  trail: img('1502904550040-7534597429ae'),
  climbing: img('1522163182402-834f871fd851'),
  cycling: img('1485965120184-e220f721d03e'),
  horse: img('1553284965-83fd3e82fa5a'),
  quad: img('1469854523086-cc02fe5d8800'),
  coffee: img('1495474472287-4d71bcdd2085'),
  boardgames: img('1610890716171-6b1bb98ffd09'),
  language: img('1543269865-cbf427effbad'),
  coworking: img('1497366216548-37526070297c'),
  citywalk: img('1539020140153-e479b8c22e70'),
  dinner: img('1414235077428-338989a2e8c0'),
  bookclub: img('1481627834876-b7833e8f5570'),
  music: img('1511671782779-c97d3d27a1d4'),
  art: img('1513364776144-60967b0f800f'),
  volunteering: img('1593113598332-cd288d649433'),
  photowalk: img('1452587925148-ce544e77e70d'),
};

const GROUP_IMAGES: Record<ActivityGroup, string> = {
  sport: img('1461896836934-ffe607ba8211'),
  outdoor: img('1551632811-561732d1e306'),
  social: img('1543269865-cbf427effbad'),
};

// Seed spots → place imagery (coast / city / nature).
const SPOT_IMAGES: Record<string, string> = {
  s1: img('1626224583764-f87db24ac4ea'), // padel club
  s2: img('1505159940484-eb2b9f2588e2'), // casa corniche
  s3: img('1558370781-d6196949e317'), // park
  s4: img('1431324155629-1a6deb1dec8d'), // pitches
  s5: img('1505159940484-eb2b9f2588e2'), // marina
  s6: img('1469854523086-cc02fe5d8800'), // palmeraie
  s7: img('1539020140153-e479b8c22e70'), // gardens
  s8: img('1559827260-dc66d52bef19'), // agadir bay
  s9: img('1505159940484-eb2b9f2588e2'), // malabata beach
  s10: img('1530870110042-98b2cb110834'), // essaouira bay
  s11: img('1502680390469-be75c86b636f'), // anchor point
  s12: img('1502680390469-be75c86b636f'), // panorama
};

// City welcome / collection imagery.
export const CITY_IMAGE = img('1539020140153-e479b8c22e70'); // warm medina
export const WELCOME_IMAGE = img('1597212618440-806262de4f6b'); // marrakech rooftops

// Auth-screen photo mosaic — what the app is about: people meeting through
// activities (social + outdoor + sport + venues). Tighter crop than `img` since
// each is shown as a small tile. Order is tuned so the grid reads well.
const PM = '?auto=format&fit=crop&w=500&q=65';
const imgM = (id: string) => `${U}${id}${PM}`;
export const WELCOME_MOSAIC: string[] = [
  imgM('1495474472287-4d71bcdd2085'), // coffee meetup
  imgM('1502680390469-be75c86b636f'), // surf
  imgM('1414235077428-338989a2e8c0'), // dinner / foodie
  imgM('1610890716171-6b1bb98ffd09'), // board game night
  imgM('1551632811-561732d1e306'), // hiking
  imgM('1511671782779-c97d3d27a1d4'), // live music
];

export function activityImage(activityId: string, group: ActivityGroup): string {
  return ACTIVITY_IMAGES[activityId] ?? GROUP_IMAGES[group];
}

export function spotImage(spotId?: string): string | null {
  return spotId ? SPOT_IMAGES[spotId] ?? null : null;
}

/** Best hero image for an event: spot photo if available, else activity photo. */
export function eventImage(event: EnrichedEvent): string {
  return spotImage(event.spotId) ?? activityImage(event.activityId, event.activity.group);
}
