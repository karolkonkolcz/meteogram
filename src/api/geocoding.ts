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

const BIG_DATA_CLOUD_URL = 'https://api.bigdatacloud.net/data/reverse-geocode-client';
const PHOTON_URL = 'https://photon.komoot.io/reverse';
const REVERSE_TIMEOUT_MS = 5000;

/**
 * Ze souřadnic GPS udělá jméno místa. Open-Meteo umí jen hledání podle
 * názvu, reverzní směr ne – proto cizí poskytovatelé (bez klíče, s CORS).
 *
 * Zkoušejí se dva za sebou: ani jeden není smluvní závazek a oba můžou
 * kdykoli přestat odpovídat. Když selžou oba, volající lokalitu pojmenuje
 * souřadnicemi jako dosud – jméno je doplněk, ne podmínka.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number,
  language: 'sk' | 'cs',
): Promise<string | null> {
  return (
    (await fromBigDataCloud(latitude, longitude, language)) ??
    (await fromPhoton(latitude, longitude))
  );
}

async function fromBigDataCloud(
  latitude: number,
  longitude: number,
  language: 'sk' | 'cs',
): Promise<string | null> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    localityLanguage: language,
  });
  return requestName(`${BIG_DATA_CLOUD_URL}?${params.toString()}`, pickPlaceName);
}

async function fromPhoton(latitude: number, longitude: number): Promise<string | null> {
  const params = new URLSearchParams({ lat: String(latitude), lon: String(longitude) });
  return requestName(`${PHOTON_URL}?${params.toString()}`, pickPhotonName);
}

async function requestName(
  url: string,
  pick: (payload: unknown) => string | null,
): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(REVERSE_TIMEOUT_MS) });
    if (!response.ok) return null;
    return pick(await response.json());
  } catch {
    return null;
  }
}

function firstNonEmpty(source: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
}

/** Z odpovědi se bere nejkonkrétnější název, který dává smysl ukázat. */
export function pickPlaceName(payload: unknown): string | null {
  const data = asRecord(payload);
  return data ? firstNonEmpty(data, ['city', 'locality', 'principalSubdivision']) : null;
}

/** Photon vrací GeoJSON – jméno je ve vlastnostech prvního prvku. */
export function pickPhotonName(payload: unknown): string | null {
  const features = asRecord(payload)?.features;
  if (!Array.isArray(features)) return null;
  const properties = asRecord(asRecord(features[0])?.properties);
  return properties ? firstNonEmpty(properties, ['city', 'name', 'county', 'state']) : null;
}
