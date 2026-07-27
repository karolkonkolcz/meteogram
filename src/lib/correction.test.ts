import { describe, expect, it } from 'vitest';
import type { Forecast } from '../api/openMeteo';
import { applyElevationCorrection, correctTemperature } from './correction';

function forecast(overrides: Partial<Forecast> = {}): Forecast {
  return {
    latitude: 49.28,
    longitude: 20.68,
    modelElevation: 786,
    timezone: 'Europe/Bratislava',
    utcOffsetSeconds: 7200,
    times: [0, 3600],
    hourly: { temperature_2m: [10, null], apparent_temperature: [9, 8] },
    dailyTimes: [],
    daily: {},
    missing: [],
    ...overrides,
  };
}

describe('correctTemperature', () => {
  it('modelový bod výš než terén znamená v terénu tepleji', () => {
    // 786 − 556 = 230 m → +1,5 °C
    expect(correctTemperature(10, 786, 556)).toBeCloseTo(11.495);
  });

  it('opačný rozdíl ubírá', () => {
    expect(correctTemperature(10, 400, 600)).toBeCloseTo(8.7);
  });
});

describe('applyElevationCorrection', () => {
  it('opraví teplotu i pocitovou teplotu', () => {
    const corrected = applyElevationCorrection(forecast(), 556, true);
    expect(corrected.hourly.temperature_2m?.[0]).toBeCloseTo(11.495);
    expect(corrected.hourly.apparent_temperature?.[0]).toBeCloseTo(10.495);
  });

  it('chybějící hodnotu nedopočítává', () => {
    const corrected = applyElevationCorrection(forecast(), 556, true);
    expect(corrected.hourly.temperature_2m?.[1]).toBeNull();
  });

  it('vypnutá korekce vrací tentýž objekt', () => {
    const original = forecast();
    expect(applyElevationCorrection(original, 556, false)).toBe(original);
  });

  it('bez známé výšky terénu se nic nemění', () => {
    const original = forecast();
    expect(applyElevationCorrection(original, null, true)).toBe(original);
    expect(applyElevationCorrection(original, undefined, true)).toBe(original);
  });

  it('zanedbatelný rozdíl výšek se ignoruje', () => {
    const original = forecast({ modelElevation: 556 });
    expect(applyElevationCorrection(original, 556.4, true)).toBe(original);
  });

  it('nemění ostatní řady', () => {
    const corrected = applyElevationCorrection(
      forecast({ hourly: { temperature_2m: [10], pressure_msl: [1013] } }),
      556,
      true,
    );
    expect(corrected.hourly.pressure_msl?.[0]).toBe(1013);
  });
});
