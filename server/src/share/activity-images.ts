// Activity → social-share (OpenGraph) image. Mirrors the slugs in the frontend
// imagery system (src/lib/imagery.ts) but renders a 1200×630 crop, the size
// link-preview crawlers (WhatsApp, Facebook, X, iMessage) expect.
const U = 'https://images.unsplash.com/photo-';
const OG = '?auto=format&fit=crop&w=1200&h=630&q=70';
const img = (id: string) => `${U}${id}${OG}`;

const BY_SLUG: Record<string, string> = {
  padel: '1626224583764-f87db24ac4ea',
  football: '1431324155629-1a6deb1dec8d',
  basketball: '1546519638-68e109498ffc',
  beachvolley: '1612872087720-bb876e2e67d1',
  running: '1476480862126-209bfaa8edc8',
  swimming: '1530549387789-4c1017266635',
  yoga: '1544367567-0f2fcb009e0b',
  surfing: '1502680390469-be75c86b636f',
  kitesurf: '1559827260-dc66d52bef19',
  windsurf: '1530870110042-98b2cb110834',
  hiking: '1551632811-561732d1e306',
  trail: '1502904550040-7534597429ae',
  climbing: '1522163182402-834f871fd851',
  cycling: '1485965120184-e220f721d03e',
  horse: '1553284965-83fd3e82fa5a',
  quad: '1469854523086-cc02fe5d8800',
  coffee: '1495474472287-4d71bcdd2085',
  boardgames: '1610890716171-6b1bb98ffd09',
  language: '1543269865-cbf427effbad',
  coworking: '1497366216548-37526070297c',
  citywalk: '1539020140153-e479b8c22e70',
  dinner: '1414235077428-338989a2e8c0',
  bookclub: '1481627834876-b7833e8f5570',
  music: '1511671782779-c97d3d27a1d4',
  art: '1513364776144-60967b0f800f',
  volunteering: '1593113598332-cd288d649433',
  photowalk: '1452587925148-ce544e77e70d',
};

// Warm Marrakech rooftops — branded fallback when the slug is unknown/missing.
const DEFAULT_ID = '1597212618440-806262de4f6b';

/** OG image URL for an activity slug (branded fallback for null/unknown). */
export function ogImageForActivity(slug: string | null | undefined): string {
  return img(slug && BY_SLUG[slug] ? BY_SLUG[slug] : DEFAULT_ID);
}
