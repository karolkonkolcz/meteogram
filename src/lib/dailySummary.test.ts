import { describe, expect, it } from 'vitest';
import type { Forecast } from '../api/openMeteo';
import { summarizeDays, temperatureRange } from './dailySummary';

const CEST = 7200;
/** Pondělí 27. 7. 2026, 00:00 místního času. */
const START = Date.UTC(2026, 6, 26, 22) / 1000;

function forecast(overrides: Partial<Forecast> = {}): Forecast {
  const times = Array.from({ length: 48 }, (_, index) => START + index * 3600);
  return {
    latitude: 50,
    longitude: 14,
    modelElevation: 149,
    timezone: 'Europe/Prague',
    utcOffsetSeconds: CEST,
    times,
    hourly: {
      // První den 10–21 °C, druhý den 5–16 °C.
      temperature_2m: times.map((_, index) => (index < 24 ? 10 + (index % 12) : 5 + (index % 12))),
      precipitation: times.map((_, index) => (index < 24 ? 0.5 : 0)),
      wind_gusts_10m: times.map((_, index) => (index === 5 ? 22 : 6)),
      cloud_cover: times.map(() => 50),
    },
    dailyTimes: [],
    daily: {},
    missing: [],
    ...overrides,
  };
}

describe('summarizeDays', () => {
  it('rozdělí předpověď na dny a spočítá krajní teploty', () => {
    const days = summarizeDays(forecast(), 'cs');
    expect(days).toHaveLength(2);
    expect(days[0]?.label).toBe('Po 27');
    expect(days[0]?.temperatureMin).toBe(10);
    expect(days[0]?.temperatureMax).toBe(21);
    expect(days[1]?.temperatureMin).toBe(5);
  });

  it('sečte srážky a najde nejsilnější náraz větru', () => {
    const days = summarizeDays(forecast(), 'cs');
    expect(days[0]?.precipitation).toBeCloseTo(12);
    expect(days[0]?.maxGust).toBe(22);
    expect(days[1]?.precipitation).toBe(0);
  });

  it('zprůměruje oblačnost', () => {
    expect(summarizeDays(forecast(), 'cs')[0]?.meanCloud).toBe(50);
  });

  it('chybějící řadu hlásí jako neznámou, ne jako nulu', () => {
    const days = summarizeDays(forecast({ hourly: {} }), 'cs');
    expect(days[0]?.temperatureMin).toBeNull();
    expect(days[0]?.precipitation).toBeNull();
    expect(days[0]?.maxGust).toBeNull();
    expect(days[0]?.meanCloud).toBeNull();
  });

  it('nepravidelný krok modelu nevadí', () => {
    const times = [START, START + 3600, START + 3600 + 10800];
    const days = summarizeDays(
      forecast({ times, hourly: { temperature_2m: [10, 12, 20] } }),
      'cs',
    );
    expect(days[0]?.temperatureMax).toBe(20);
  });
});

describe('temperatureRange', () => {
  it('vrací společné měřítko přes všechny dny', () => {
    expect(temperatureRange(summarizeDays(forecast(), 'cs'))).toEqual([5, 21]);
  });

  it('u konstantní teploty vytvoří nenulový rozsah', () => {
    const days = summarizeDays(
      forecast({ times: [START], hourly: { temperature_2m: [8] } }),
      'cs',
    );
    expect(temperatureRange(days)).toEqual([7, 9]);
  });

  it('bez teplot nemá měřítko', () => {
    expect(temperatureRange(summarizeDays(forecast({ hourly: {} }), 'cs'))).toBeNull();
  });
});
