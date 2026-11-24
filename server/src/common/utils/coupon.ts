import { createHmac } from 'node:crypto';

// Silver-sponsorship coupons. Each sponsored activity has a code
// (HUDLGO-XXXXXX, on ActivityVenue). Every joined attendee gets a personal
// version — that code + a 4-character suffix derived (HMAC) from the attendee —
// so staff can tell who's redeeming and each attendee redeems only once.

const SUFFIX_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O/1/I/L
const COUPON_RE = /^(HUDLGO-[A-Z0-9]{6})-?([A-Z0-9]{4})?$/;

function secret(): string {
  return process.env.COUPON_SECRET || process.env.JWT_ACCESS_SECRET || 'dev-access-secret';
}

/** The attendee-specific suffix for a sponsored activity. */
export function attendeeSuffix(activityVenueId: string, userId: string): string {
  const digest = createHmac('sha256', secret()).update(`${activityVenueId}:${userId}`).digest();
  let out = '';
  for (let i = 0; i < 4; i++) out += SUFFIX_ALPHABET[digest[i] % SUFFIX_ALPHABET.length];
  return out;
}

export function attendeeCouponCode(activityCode: string, activityVenueId: string, userId: string): string {
  return `${activityCode}-${attendeeSuffix(activityVenueId, userId)}`;
}

/** Normalize what staff typed/pasted ("hudlgo abc123 7kq2" → parts). */
export function parseCouponCode(input: string): { activityCode: string; suffix?: string } | null {
  const compact = input.toUpperCase().replace(/[\s_]+/g, '').replace(/^HUDLGO(?!-)/, 'HUDLGO-');
  const m = COUPON_RE.exec(compact);
  return m ? { activityCode: m[1], suffix: m[2] } : null;
}

/** Calendar day (YYYY-MM-DD) in Morocco — redemption is allowed on the activity's day ± 1. */
function moroccoDay(d: Date): number {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Casablanca', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  return Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)) - 1, Number(s.slice(8, 10))) / 86_400_000;
}

export function withinRedeemWindow(startsAt: Date, now: Date = new Date()): boolean {
  return Math.abs(moroccoDay(now) - moroccoDay(startsAt)) <= 1;
}
