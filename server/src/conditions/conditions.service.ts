import { Injectable, Logger } from '@nestjs/common';

/** Wire shape — mirrors the frontend `Conditions` type. */
export interface ConditionsResult {
  spotId: string;
  activityType: string;
  updatedAt: string;
  source: 'open-meteo';
  fields: {
    tempC?: number;
    windKts?: number;
    swellM?: number;
    wavePeriodS?: number;
    waterTempC?: number;
    /** Machine key the frontend translates (clear, cloudy, fog, rain, showers, snow, storm, windy). */
    summaryKey: string;
    /** English fallback text. */
    summary: string;
  };
}

interface CacheEntry {
  value: ConditionsResult | null;
  expires: number;
}

const CACHE_TTL_MS = 30 * 60 * 1000;
const CACHE_MAX = 1000;
const FETCH_TIMEOUT_MS = 4000;
/** Open-Meteo forecasts go 16 days out; we stop a bit earlier for reliability. */
const MAX_AHEAD_MS = 15 * 86_400_000;

/** Activities where sea state matters (Open-Meteo Marine API). */
const MARINE_HINTS = ['surf', 'kite', 'windsurf', 'sail', 'swim', 'kayak', 'sup', 'paddle', 'beach', 'div', 'snorkel', 'fish'];

const SUMMARY_TEXT: Record<string, string> = {
  clear: 'Clear skies',
  cloudy: 'Cloudy',
  fog: 'Foggy',
  rain: 'Rain',
  showers: 'Showers',
  snow: 'Snow',
  storm: 'Thunderstorms',
  windy: 'Windy',
};

/** WMO weather code → summary key (https://open-meteo.com/en/docs#weathervariables). */
function summaryFor(code: number | undefined, windKts: number | undefined): string {
  if (code != null && code >= 95) return 'storm';
  if (windKts != null && windKts >= 20) return 'windy';
  if (code == null) return 'clear';
  if (code === 0 || code === 1) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'showers';
  if (code >= 51 && code <= 67) return 'rain';
  return 'cloudy';
}

const round1 = (n: unknown): number | undefined =>
  typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 10) / 10 : undefined;

type Hourly = { time?: string[] } & Record<string, unknown[] | undefined>;

/**
 * Outdoor conditions for an activity (temperature, wind, and — for water
 * sports — waves and sea temperature) from Open-Meteo: free, no API key.
 * Results are cached in memory for 30 minutes per ~1 km cell and hour, and any
 * upstream failure/timeout resolves to `null` so the widget simply hides.
 */
@Injectable()
export class ConditionsService {
  private readonly logger = new Logger(ConditionsService.name);
  private readonly cache = new Map<string, CacheEntry>();

  async get(lat: number, lng: number, at: Date, activity?: string): Promise<ConditionsResult | null> {
    const now = Date.now();
    // Only meaningful for upcoming activities within the forecast horizon.
    if (at.getTime() < now - 3 * 3_600_000 || at.getTime() > now + MAX_AHEAD_MS) return null;

    const hour = new Date(at);
    hour.setUTCMinutes(0, 0, 0);
    const hourIso = hour.toISOString().slice(0, 13) + ':00'; // yyyy-mm-ddThh:00
    const marine = this.wantsMarine(activity);
    const key = `${lat.toFixed(2)},${lng.toFixed(2)},${hourIso},${marine ? 'm' : '-'}`;

    const hit = this.cache.get(key);
    if (hit && hit.expires > now) return hit.value;

    const value = await this.fetchConditions(lat, lng, hourIso, marine, activity);
    this.remember(key, value);
    return value;
  }

  private wantsMarine(activity?: string): boolean {
    const a = (activity ?? '').toLowerCase();
    return MARINE_HINTS.some((h) => a.includes(h));
  }

  private remember(key: string, value: ConditionsResult | null): void {
    if (this.cache.size >= CACHE_MAX) {
      // Drop the oldest entry (Map preserves insertion order).
      const first = this.cache.keys().next().value;
      if (first !== undefined) this.cache.delete(first);
    }
    // Cache failures briefly too, so a down upstream isn't hammered.
    this.cache.set(key, { value, expires: Date.now() + (value ? CACHE_TTL_MS : 5 * 60 * 1000) });
  }

  private async fetchConditions(
    lat: number,
    lng: number,
    hourIso: string,
    marine: boolean,
    activity?: string,
  ): Promise<ConditionsResult | null> {
    const common = `latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}&timezone=UTC&start_hour=${hourIso}&end_hour=${hourIso}`;
    const [weather, sea] = await Promise.all([
      this.fetchHourly(
        `https://api.open-meteo.com/v1/forecast?${common}&hourly=temperature_2m,wind_speed_10m,weather_code&wind_speed_unit=kn`,
      ),
      marine
        ? this.fetchHourly(
            `https://marine-api.open-meteo.com/v1/marine?${common}&hourly=wave_height,wave_period,sea_surface_temperature`,
          )
        : Promise.resolve(null),
    ]);
    if (!weather) return null;

    const tempC = round1(weather.temperature_2m?.[0]);
    const windKts = round1(weather.wind_speed_10m?.[0]);
    const code = typeof weather.weather_code?.[0] === 'number' ? (weather.weather_code[0] as number) : undefined;
    if (tempC === undefined && windKts === undefined) return null;

    const summaryKey = summaryFor(code, windKts);
    return {
      spotId: `${lat.toFixed(2)},${lng.toFixed(2)}`,
      activityType: activity ?? 'outdoor',
      updatedAt: new Date().toISOString(),
      source: 'open-meteo',
      fields: {
        tempC,
        windKts,
        // Inland points return nulls from the marine API — those stay undefined.
        swellM: sea ? round1(sea.wave_height?.[0]) : undefined,
        wavePeriodS: sea ? round1(sea.wave_period?.[0]) : undefined,
        waterTempC: sea ? round1(sea.sea_surface_temperature?.[0]) : undefined,
        summaryKey,
        summary: SUMMARY_TEXT[summaryKey] ?? 'Forecast',
      },
    };
  }

  private async fetchHourly(url: string): Promise<Hourly | null> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'hudlgo-api' } });
      if (!res.ok) return null;
      const body = (await res.json()) as { hourly?: Hourly };
      return body.hourly ?? null;
    } catch (err) {
      this.logger.warn(`Open-Meteo request failed: ${(err as Error).message}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
