import { format, formatDistanceToNow, isToday, isTomorrow } from 'date-fns';

/** Haversine distance in km between two lat/lng points. */
export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km < 10 ? km.toFixed(1) : Math.round(km)} km`;
}

export function formatEventDate(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return `Today · ${format(d, 'HH:mm')}`;
  if (isTomorrow(d)) return `Tomorrow · ${format(d, 'HH:mm')}`;
  return format(d, 'EEE d MMM · HH:mm');
}

export function formatDayLong(iso: string): string {
  return format(new Date(iso), 'EEEE d MMMM');
}

export function formatTimeRange(iso: string, durationMins: number): string {
  const start = new Date(iso);
  const end = new Date(start.getTime() + durationMins * 60_000);
  return `${format(start, 'HH:mm')} – ${format(end, 'HH:mm')}`;
}

export function formatRelative(iso: string): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true });
}

export function formatPrice(mad: number): string {
  return mad === 0 ? 'Free' : `${mad} MAD`;
}

export function formatChatTime(iso: string): string {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isTomorrow(d)) return 'Tomorrow';
  return format(d, 'd MMM');
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}
