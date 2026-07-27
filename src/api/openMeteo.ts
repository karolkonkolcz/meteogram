import type { Location } from '../lib/location';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

/** Model z předlohy SHMÚ. Přepínač modelů přijde až ve fázi 2 (docs §0). */
export const MODEL = 'ecmwf_ifs025';
export const FORECAST_DAYS = 16;

export const HOURLY_VARIABLES = [
  'temperature_2m',
  'apparent_temperature',
  'cloud_cover',
  'precipitation',
  'rain',
  'snowfall',
  'pressure_msl',
  'wind_speed_10m',
  'wind_gusts_10m',
  'wind_direction_10m',
  'weather_code',
] as const;

export const DAILY_VARIABLES = [
  'sunrise',
  'sunset',
  'precipitation_sum',
  'temperature_2m_min',
  'temperature_2m_max',
] as const;

export type HourlyVariable = (typeof HOURLY_VARIABLES)[number];
export type DailyVariable = (typeof DAILY_VARIABLES)[number];

/** Hodnota chybí, když ji model nedodal – nikdy se nedopočítává. */
export type Series = readonly (number | null)[];

export interface Forecast {
  latitude: number;
  longitude: number;
  /** Nadmořská výška modelového bodu (`model_alt` v hlavičce předlohy). */
  modelElevation: number | null;
  timezone: string;
  utcOffsetSeconds: number;
  /** Unixové sekundy v UTC; rozestup nemusí být pravidelný (docs §2.1). */
  times: readonly number[];
  hourly: Partial<Record<HourlyVariable, Series>>;
  dailyTimes: readonly number[];
  daily: Partial<Record<DailyVariable, Series>>;
  /** Proměnné, které model pro tuto lokalitu nevrátil – UI je nepředstírá. */
  missing: readonly HourlyVariable[];
}

export class OpenMeteoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OpenMeteoError';
  }
}

export function buildForecastUrl(location: Location): string {
  const params = new URLSearchParams({
    latitude: String(location.latitude),
    longitude: String(location.longitude),
    models: MODEL,
    forecast_days: String(FORECAST_DAYS),
    hourly: HOURLY_VARIABLES.join(','),
    daily: DAILY_VARIABLES.join(','),
    timezone: 'auto',
    timeformat: 'unixtime',
    // Jednotky žádáme explicitně, ať nezávisí na výchozím nastavení API.
    temperature_unit: 'celsius',
    wind_speed_unit: 'ms',
    precipitation_unit: 'mm',
  });
  return `${FORECAST_URL}?${params.toString()}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function parseTimes(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === 'number');
}

/**
 * Řada se přijme jen tehdy, když sedí délka s časovou osou. Kratší nebo
 * delší pole by tiše posunulo hodnoty proti času, což je horší než chybějící
 * panel – proto se taková proměnná označí za chybějící.
 */
function parseSeries(value: unknown, expectedLength: number): Series | null {
  if (!Array.isArray(value) || value.length !== expectedLength) return null;
  return value.map((item) => (typeof item === 'number' && Number.isFinite(item) ? item : null));
}

export function parseForecast(payload: unknown): Forecast {
  const root = asRecord(payload);
  if (!root) throw new OpenMeteoError('Odpoveď API nemá očakávaný tvar.');

  if (root.error === true) {
    const reason = typeof root.reason === 'string' ? root.reason : 'neznáma chyba';
    throw new OpenMeteoError(`Open-Meteo odmietlo požiadavku: ${reason}`);
  }

  const hourlyBlock = asRecord(root.hourly);
  const times = parseTimes(hourlyBlock?.time);
  if (times.length === 0) {
    throw new OpenMeteoError('Odpoveď neobsahuje hodinovú časovú os.');
  }

  const hourly: Partial<Record<HourlyVariable, Series>> = {};
  const missing: HourlyVariable[] = [];
  for (const variable of HOURLY_VARIABLES) {
    const series = parseSeries(hourlyBlock?.[variable], times.length);
    if (series) {
      hourly[variable] = series;
    } else {
      missing.push(variable);
    }
  }

  const dailyBlock = asRecord(root.daily);
  const dailyTimes = parseTimes(dailyBlock?.time);
  const daily: Partial<Record<DailyVariable, Series>> = {};
  for (const variable of DAILY_VARIABLES) {
    const series = parseSeries(dailyBlock?.[variable], dailyTimes.length);
    if (series) daily[variable] = series;
  }

  return {
    latitude: typeof root.latitude === 'number' ? root.latitude : Number.NaN,
    longitude: typeof root.longitude === 'number' ? root.longitude : Number.NaN,
    modelElevation: typeof root.elevation === 'number' ? root.elevation : null,
    timezone: typeof root.timezone === 'string' ? root.timezone : 'UTC',
    utcOffsetSeconds:
      typeof root.utc_offset_seconds === 'number' ? root.utc_offset_seconds : 0,
    times,
    hourly,
    dailyTimes,
    daily,
    missing,
  };
}

export async function fetchForecast(
  location: Location,
  signal?: AbortSignal,
): Promise<Forecast> {
  const response = await fetch(buildForecastUrl(location), { signal });
  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const reason = asRecord(payload)?.reason;
    throw new OpenMeteoError(
      typeof reason === 'string' ? reason : `Open-Meteo vrátilo stav ${response.status}.`,
    );
  }
  return parseForecast(payload);
}
