import { haversineKm } from './haversine';

interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Known city centres, shared by the geocoding service and the event serializer.
 * Keyed by lowercase slug → display name + coordinates. Single source of truth so
 * coarse "general area" labels stay consistent across the app.
 */
export const CITY_CENTRES: Record<string, { name: string; lat: number; lng: number }> = {
  casablanca: { name: 'Casablanca', lat: 33.5731, lng: -7.5898 },
  rabat: { name: 'Rabat', lat: 34.0209, lng: -6.8416 },
  sale: { name: 'Salé', lat: 34.0531, lng: -6.7985 },
  marrakech: { name: 'Marrakech', lat: 31.6295, lng: -7.9811 },
  agadir: { name: 'Agadir', lat: 30.4278, lng: -9.5981 },
  tangier: { name: 'Tangier', lat: 35.7595, lng: -5.834 },
  essaouira: { name: 'Essaouira', lat: 31.5085, lng: -9.7595 },
  taghazout: { name: 'Taghazout', lat: 30.5447, lng: -9.709 },
};

/** Display name of the nearest known city, or null if none within `maxKm`. */
export function nearestCityName(point: LatLng, maxKm = 80): string | null {
  let best: string | null = null;
  let bestKm = Infinity;
  for (const { name, lat, lng } of Object.values(CITY_CENTRES)) {
    const km = haversineKm({ lat, lng }, point);
    if (km < bestKm) {
      bestKm = km;
      best = name;
    }
  }
  return bestKm <= maxKm ? best : null;
}
