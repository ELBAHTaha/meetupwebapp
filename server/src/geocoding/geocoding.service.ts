import { Injectable } from '@nestjs/common';
import { haversineKm } from '../common/utils/haversine';
import { CITY_CENTRES } from '../common/utils/area';

interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Geocoding seam. For now a static ZIP→city lookup for the seed Moroccan
 * cities; swap for a real provider (Google/Nominatim) behind this interface.
 */
@Injectable()
export class GeocodingService {
  // City centres (shared source of truth) used to approximate distance.
  private readonly cities: Record<string, LatLng> = Object.fromEntries(
    Object.entries(CITY_CENTRES).map(([slug, c]) => [slug, { lat: c.lat, lng: c.lng }]),
  );

  // ZIP prefixes (first 2 digits) → city, covering the seed cities.
  private readonly zipPrefix: Record<string, keyof GeocodingService['cities'] | string> = {
    '20': 'casablanca',
    '10': 'rabat',
    '11': 'sale',
    '40': 'marrakech',
    '80': 'agadir',
    '90': 'tangier',
    '44': 'essaouira',
  };

  /** Best-effort coordinates from a ZIP and/or neighborhood string. */
  geocode(zip?: string, neighborhood?: string): LatLng | null {
    if (neighborhood) {
      const key = neighborhood.toLowerCase().replace(/[^a-z]/g, '');
      for (const city of Object.keys(this.cities)) {
        if (key.includes(city)) return this.cities[city];
      }
    }
    if (zip && zip.length >= 2) {
      const city = this.zipPrefix[zip.slice(0, 2)];
      if (city && this.cities[city]) return this.cities[city];
    }
    return null;
  }

  cityCentre(name: string): LatLng | null {
    return this.cities[name.toLowerCase()] ?? null;
  }

  /**
   * Nearest known city to a coordinate, as the lowercase city key (e.g.
   * 'casablanca'). Used to scope the feed to a chosen city. Returns null when
   * the point is further than `maxKm` from every known centre.
   */
  nearestCity(point: LatLng, maxKm = 60): string | null {
    let best: string | null = null;
    let bestKm = Infinity;
    for (const [name, centre] of Object.entries(this.cities)) {
      const km = haversineKm(centre, point);
      if (km < bestKm) {
        bestKm = km;
        best = name;
      }
    }
    return bestKm <= maxKm ? best : null;
  }
}
