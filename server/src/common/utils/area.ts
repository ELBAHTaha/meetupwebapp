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
  kenitra: { name: 'Kenitra', lat: 34.261, lng: -6.5802 },
  mohammedia: { name: 'Mohammedia', lat: 33.6861, lng: -7.3829 },
  marrakech: { name: 'Marrakech', lat: 31.6295, lng: -7.9811 },
  fes: { name: 'Fès', lat: 34.0181, lng: -5.0078 },
  meknes: { name: 'Meknès', lat: 33.8935, lng: -5.5473 },
  tangier: { name: 'Tangier', lat: 35.7595, lng: -5.834 },
  tetouan: { name: 'Tétouan', lat: 35.5785, lng: -5.3684 },
  chefchaouen: { name: 'Chefchaouen', lat: 35.1688, lng: -5.2636 },
  oujda: { name: 'Oujda', lat: 34.6867, lng: -1.9114 },
  nador: { name: 'Nador', lat: 35.1681, lng: -2.9335 },
  eljadida: { name: 'El Jadida', lat: 33.2316, lng: -8.5007 },
  agadir: { name: 'Agadir', lat: 30.4278, lng: -9.5981 },
  essaouira: { name: 'Essaouira', lat: 31.5085, lng: -9.7595 },
  taghazout: { name: 'Taghazout', lat: 30.5447, lng: -9.709 },
  ifrane: { name: 'Ifrane', lat: 33.5228, lng: -5.1106 },
  benimellal: { name: 'Beni Mellal', lat: 32.3373, lng: -6.3498 },
  ouarzazate: { name: 'Ouarzazate', lat: 30.9335, lng: -6.937 },
  dakhla: { name: 'Dakhla', lat: 23.6848, lng: -15.9579 },
  laayoune: { name: 'Laâyoune', lat: 27.1253, lng: -13.1625 },
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
