import { describe, expect, it } from 'vitest';
import type { Forecast } from '../api/openMeteo';
import {
  daySpans,
  nearestIndex,
  nightIntervals,
  uncertaintyStart,
} from './meteogramGeometry';

const CEST = 7200;
/** Pondělí 27. 7. 2026, 00:00 místního času (= 26. 7. 22:00 UTC). */
const START = Date.UTC(2026, 6, 26, 22) / 1000;
const DAY = 86_400;

function hourly(count: number, step = 3600): number[] {
  return Array.from({ length: count }, (_, index) => START + index * step);
}

function forecastWith(overrides: Partial<Forecast>): Forecast {
  return {
    latitude: 49.28,
    longitude: 20.68,
    modelElevation: 786,
    timezone: 'Europe/Bratislava',
    utcOffsetSeconds: CEST,
    times: hourly(49),
    hourly: {},
    dailyTimes: [],
    daily: {},
    missing: [],
    ...overrides,
  };
}

describe('daySpans', () => {
  it('rozdělí předpověď na místní dny', () => {
    const spans = daySpans(hourly(49), CEST, 'sk');
    expect(spans).toHaveLength(3);
    expect(spans[0]?.label).toBe('Po 27');
    expect(spans[1]?.label).toBe('Ut 28');
  });

  it('první a poslední den ořízne na rozsah dat, ne na půlnoc', () => {
    const times = hourly(30).map((time) => time + 5 * 3600); // začátek v 05:00
    const spans = daySpans(times, CEST, 'sk');
    expect(spans[0]?.start).toBe(times[0]);
    expect(spans.at(-1)?.end).toBe(times.at(-1));
  });

  it('pozná víkend v místní zóně', () => {
    const spans = daySpans(hourly(8 * 24), CEST, 'sk');
    const weekend = spans.filter((span) => span.weekend).map((span) => span.label);
    expect(weekend).toEqual(['So 1', 'Ne 2']);
  });

  it('prázdná osa nedá žádný den', () => {
    expect(daySpans([], CEST, 'sk')).toEqual([]);
  });
});

describe('nightIntervals', () => {
  it('spojí západ s následujícím východem slunce', () => {
    const forecast = forecastWith({
      times: hourly(49),
      dailyTimes: [START, START + DAY],
      daily: {
        sunrise: [START + 5 * 3600, START + DAY + 5 * 3600],
        sunset: [START + 20 * 3600, START + DAY + 20 * 3600],
      },
    });
    const nights = nightIntervals(forecast);
    // noc na začátku + noc mezi dny + noc po posledním západu
    expect(nights).toHaveLength(3);
    expect(nights[1]).toEqual({ from: START + 20 * 3600, to: START + DAY + 5 * 3600 });
  });

  it('ořízne noc na rozsah dat', () => {
    const forecast = forecastWith({
      times: hourly(10),
      daily: { sunrise: [START - DAY], sunset: [START - 2 * 3600] },
    });
    const nights = nightIntervals(forecast);
    expect(nights[0]?.from).toBe(START);
    expect(nights.at(-1)?.to).toBe(START + 9 * 3600);
  });

  it('bez východů a západů se noc nekreslí', () => {
    expect(nightIntervals(forecastWith({ daily: {} }))).toEqual([]);
  });
});

describe('uncertaintyStart', () => {
  it('vrací hranici desátého dne', () => {
    const times = hourly(16 * 24);
    expect(uncertaintyStart(times)).toBe(START + 10 * DAY);
  });

  it('u kratší předpovědi se nic netlumí', () => {
    expect(uncertaintyStart(hourly(48))).toBeNull();
    expect(uncertaintyStart([])).toBeNull();
  });
});

describe('nearestIndex', () => {
  const times = [0, 3600, 7200, 18000]; // poslední krok je 3h

  it('najde nejbližší čas i při nepravidelném kroku', () => {
    expect(nearestIndex(times, 0)).toBe(0);
    expect(nearestIndex(times, 5000)).toBe(1);
    expect(nearestIndex(times, 8000)).toBe(2);
    expect(nearestIndex(times, 17000)).toBe(3);
  });

  it('mimo rozsah vrací krajní bod', () => {
    expect(nearestIndex(times, -10_000)).toBe(0);
    expect(nearestIndex(times, 999_999)).toBe(3);
  });

  it('prázdná osa nemá index', () => {
    expect(nearestIndex([], 0)).toBe(-1);
  });
});
