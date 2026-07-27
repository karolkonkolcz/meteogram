import type { Forecast } from '../api/openMeteo';
import { formatDayLabel, isWeekend, startOfLocalDay, type Locale } from './time';

const HOUR = 3600;
const DAY = 86_400;

/** Po tomto horizontu se předpověď kreslí tlumeně (docs §3.1). */
export const CONFIDENT_DAYS = 10;

export interface DaySpan {
  /** Začátek a konec místního dne v unixových sekundách. */
  start: number;
  end: number;
  label: string;
  weekend: boolean;
}

export interface Interval {
  from: number;
  to: number;
}

/**
 * Místní dny protínající předpověď. Poslední den bývá useknutý – konec se
 * proto ořezává na konec dat, ne na půlnoc, aby pás dnů nepřečníval graf.
 */
export function daySpans(
  times: readonly number[],
  utcOffsetSeconds: number,
  locale: Locale,
): DaySpan[] {
  const first = times[0];
  const last = times[times.length - 1];
  if (first === undefined || last === undefined) return [];

  const spans: DaySpan[] = [];
  let dayStart = startOfLocalDay(first, utcOffsetSeconds);

  while (dayStart <= last) {
    const dayEnd = dayStart + DAY;
    spans.push({
      start: Math.max(dayStart, first),
      end: Math.min(dayEnd, last),
      // Popisek patří dni, ne useknutému začátku – proto se počítá z poledne.
      label: formatDayLabel(dayStart + 12 * HOUR, utcOffsetSeconds, locale),
      weekend: isWeekend(dayStart + 12 * HOUR, utcOffsetSeconds),
    });
    dayStart = dayEnd;
  }
  return spans;
}

/**
 * Noční pásma mezi západem a následujícím východem slunce, oříznutá na
 * rozsah dat. Když model východy/západy nedodá, vrací se prázdno – noc se
 * radši nekreslí, než aby se odhadovala.
 */
export function nightIntervals(forecast: Forecast): Interval[] {
  const sunrise = forecast.daily.sunrise;
  const sunset = forecast.daily.sunset;
  const first = forecast.times[0];
  const last = forecast.times[forecast.times.length - 1];
  if (!sunrise || !sunset || first === undefined || last === undefined) return [];

  const intervals: Interval[] = [];

  // Noc před prvním východem slunce.
  const firstSunrise = sunrise[0];
  if (typeof firstSunrise === 'number' && firstSunrise > first) {
    intervals.push({ from: first, to: Math.min(firstSunrise, last) });
  }

  for (let index = 0; index < sunset.length; index += 1) {
    const from = sunset[index];
    const to = sunrise[index + 1] ?? last;
    if (typeof from !== 'number' || typeof to !== 'number') continue;
    const clippedFrom = Math.max(from, first);
    const clippedTo = Math.min(to, last);
    if (clippedTo > clippedFrom) intervals.push({ from: clippedFrom, to: clippedTo });
  }

  return intervals;
}

/** Okamžik, od kterého se předpověď kreslí tlumeně. */
export function uncertaintyStart(times: readonly number[]): number | null {
  const first = times[0];
  const last = times[times.length - 1];
  if (first === undefined || last === undefined) return null;
  const threshold = first + CONFIDENT_DAYS * DAY;
  return threshold < last ? threshold : null;
}

/**
 * Index nejbližšího času k danému okamžiku – základ crosshairu. Krok modelu
 * je nepravidelný, proto se hledá binárně, ne dělením konstantou.
 */
export function nearestIndex(times: readonly number[], target: number): number {
  if (times.length === 0) return -1;
  let low = 0;
  let high = times.length - 1;

  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (times[middle]! <= target) low = middle;
    else high = middle;
  }

  const lowDistance = Math.abs(times[low]! - target);
  const highDistance = Math.abs(times[high]! - target);
  return lowDistance <= highDistance ? low : high;
}
