import { Injectable } from '@nestjs/common';
import { haversineKm } from '../common/utils/haversine';

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
  // City centres used to approximate distance from a user's ZIP/area.
  private readonly cities: Record<string, LatLng> = {
    casablanca: { lat: 33.5731, lng: -7.5898 },
    rabat: { lat: 34.0209, lng: -6.8416 },
    sale: { lat: 34.0531, lng: -6.7985 },
    marrakech: { lat: 31.6295, lng: -7.9811 },
    agadir: { lat: 30.4278, lng: -9.5981 },
    tangier: { lat: 35.7595, lng: -5.834 },
    essaouira: { lat: 31.5085, lng: -9.7595 },
    taghazout: { lat: 30.5447, lng: -9.709 },
  };

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
