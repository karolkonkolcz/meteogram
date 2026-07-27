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
