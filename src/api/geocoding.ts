import type { Location } from '../lib/location';

const GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const ELEVATION_URL = 'https://api.open-meteo.com/v1/elevation';

export interface GeocodingResult extends Location {
  id: number;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function toResult(value: unknown): GeocodingResult | null {
  const item = asRecord(value);
  if (!item) return null;
  const { id, name, latitude, longitude, admin1, country } = item;
  if (typeof name !== 'string' || typeof latitude !== 'number' || typeof longitude !== 'number') {
    return null;
  }
  return {
    id: typeof id === 'number' ? id : latitude * 1000 + longitude,
    name,
    latitude,
    longitude,
    ...(typeof admin1 === 'string' ? { admin: admin1 } : {}),
    ...(typeof country === 'string' ? { country } : {}),
  };
}

export function parseGeocodingResults(payload: unknown): GeocodingResult[] {
  const results = asRecord(payload)?.results;
  if (!Array.isArray(results)) return [];
  return results
    .map(toResult)
    .filter((item): item is GeocodingResult => item !== null);
}

export async function searchLocations(
  query: string,
  language: 'sk' | 'cs',
  signal?: AbortSignal,
): Promise<GeocodingResult[]> {
  const trimmed = query.trim();
  // Jednopísmenný dotaz vrací šum; hledá se až od dvou znaků.
  if (trimmed.length < 2) return [];

  const params = new URLSearchParams({
    name: trimmed,
    count: '8',
    language,
    format: 'json',
  });
  const response = await fetch(`${GEOCODING_URL}?${params.toString()}`, { signal });
  if (!response.ok) throw new Error(`Vyhľadávanie zlyhalo (stav ${response.status}).`);
  return parseGeocodingResults(await response.json());
}

/** Skutečná nadmořská výška z DEM – `real_alt` v hlavičce (docs §2.2). */
export async function fetchElevation(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<number | null> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  });
  const response = await fetch(`${ELEVATION_URL}?${params.toString()}`, { signal });
  if (!response.ok) return null;
  const elevation = asRecord(await response.json())?.elevation;
  return Array.isArray(elevation) && typeof elevation[0] === 'number' ? elevation[0] : null;
}

const REVERSE_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';

/**
 * Ze souřadnic GPS udělá jméno místa. Open-Meteo umí jen hledání podle
 * názvu, reverzní směr ne – proto jiný poskytovatel (bez klíče, s CORS).
 *
 * Selhání není chyba: volající pak lokalitu pojmenuje souřadnicemi,
 * jako dosud. Kvůli tomu se také nečeká déle než pár sekund.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  language: 'sk' | 'cs',
): Promise<string | null> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    localityLanguage: language,
  });

  try {
    const response = await fetch(`${REVERSE_URL}?${params.toString()}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return null;
    return pickPlaceName(await response.json());
  } catch {
    return null;
  }
}

/** Z odpovědi se bere nejkonkrétnější název, který dává smysl ukázat. */
export function pickPlaceName(payload: unknown): string | null {
  const data = asRecord(payload);
  if (!data) return null;

  for (const key of ['city', 'locality', 'principalSubdivision'] as const) {
    const value = data[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
}
