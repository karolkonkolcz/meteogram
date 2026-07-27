export interface Location {
  name: string;
  latitude: number;
  longitude: number;
  /** Kraj/region a stát – odlišují stejnojmenné obce ve výsledcích hledání. */
  admin?: string;
  country?: string;
}

/** Nová Ľubovňa – lokalita z předlohy SHMÚ, použitá při prvním spuštění. */
export const DEFAULT_LOCATION: Location = {
  name: 'Nová Ľubovňa',
  latitude: 49.276,
  longitude: 20.683,
  admin: 'Prešovský kraj',
  country: 'Slovensko',
};

const MAX_NAME_LENGTH = 120;
const RECENT_KEY = 'meteogram.recent';
const MAX_RECENT = 8;

function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Lokalita se drží v URL, aby šel odkaz sdílet a fungoval deep-link.
 * Hodnoty z URL jsou cizí vstup – neplatné se zahodí, nepadá se na nich.
 */
export function parseLocationFromParams(params: URLSearchParams): Location | null {
  const latitude = Number(params.get('lat'));
  const longitude = Number(params.get('lon'));
  if (!params.has('lat') || !params.has('lon')) return null;
  if (!isValidCoordinate(latitude, longitude)) return null;

  const name = (params.get('name') ?? '').trim().slice(0, MAX_NAME_LENGTH);
  return {
    name: name || formatCoordinates(latitude, longitude),
    latitude,
    longitude,
  };
}

export function locationToParams(location: Location): URLSearchParams {
  const params = new URLSearchParams();
  // Pět desetinných míst je ~1 m; delší zápis jen kazí čitelnost odkazu.
  params.set('lat', String(round(location.latitude, 5)));
  params.set('lon', String(round(location.longitude, 5)));
  params.set('name', location.name);
  return params;
}

/**
 * Pozná lokalitu pojmenovanou souřadnicemi. Takové jméno vzniká, když
 * reverzní geokódování selže – při dalším spuštění se zkusí znovu.
 */
export function isCoordinateName(name: string): boolean {
  return /^-?\d{1,3}(\.\d+)?,\s*-?\d{1,3}(\.\d+)?$/.test(name.trim());
}

export function formatCoordinates(latitude: number, longitude: number): string {
  return `${round(latitude, 3)}, ${round(longitude, 3)}`;
}

/** Dvě lokality jsou tatáž, pokud sedí souřadnice na ~10 m. */
export function isSameLocation(a: Location, b: Location): boolean {
  return (
    Math.abs(a.latitude - b.latitude) < 1e-4 && Math.abs(a.longitude - b.longitude) < 1e-4
  );
}

export function addRecent(list: readonly Location[], location: Location): Location[] {
  return [location, ...list.filter((item) => !isSameLocation(item, location))].slice(
    0,
    MAX_RECENT,
  );
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function isLocation(value: unknown): value is Location {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.latitude === 'number' &&
    typeof candidate.longitude === 'number' &&
    isValidCoordinate(candidate.latitude, candidate.longitude)
  );
}

/** Úložiště může být nedostupné nebo poškozené – obojí končí prázdným seznamem. */
export function readRecent(): Location[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isLocation).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function storeRecent(list: readonly Location[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    /* neukládá se – seznam platí jen pro tuto relaci */
  }
}
