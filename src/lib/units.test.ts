import { describe, expect, it } from 'vitest';
import { applyWindUnit, degreesToCompass, formatNumber, formatPrecipitation } from './units';

describe('degreesToCompass', () => {
  it('mapuje hlavní směry', () => {
    expect(degreesToCompass(0)).toBe('S');
    expect(degreesToCompass(90)).toBe('V');
    expect(degreesToCompass(180)).toBe('J');
    expect(degreesToCompass(270)).toBe('Z');
  });

  it('360° je zase sever, ne devátá hodnota', () => {
    expect(degreesToCompass(360)).toBe('S');
    expect(degreesToCompass(359)).toBe('S');
  });

  it('zaokrouhluje na nejbližší osminu kruhu', () => {
    expect(degreesToCompass(200)).toBe('J');
    expect(degreesToCompass(215)).toBe('JZ');
  });

  it('zvládne i záporný úhel', () => {
    expect(degreesToCompass(-90)).toBe('Z');
  });
});

describe('formátování hodnot', () => {
  it('chybějící hodnota je pomlčka, ne nula', () => {
    expect(formatNumber(null)).toBe('—');
    expect(formatNumber(undefined, 1)).toBe('—');
    expect(formatNumber(Number.NaN)).toBe('—');
    expect(formatNumber(0)).toBe('0');
  });

  it('nulové srážky zůstanou prázdné, chybějící se odliší', () => {
    expect(formatPrecipitation(0)).toBe('');
    expect(formatPrecipitation(null)).toBe('—');
    expect(formatPrecipitation(1.44)).toBe('1.4');
  });
});

describe('applyWindUnit', () => {
  const forecast = {
    latitude: 0, longitude: 0, modelElevation: null, timezone: 'UTC', utcOffsetSeconds: 0,
    times: [0, 3600], dailyTimes: [], daily: {}, missing: [],
    hourly: { wind_speed_10m: [2, null], wind_gusts_10m: [5, 10], temperature_2m: [10, 11] },
  } as const;

  it('metry za sekundu nechává být a vrací tentýž objekt', () => {
    expect(applyWindUnit(forecast, 'ms')).toBe(forecast);
  });

  it('převádí rychlost i nárazy na km/h', () => {
    const converted = applyWindUnit(forecast, 'kmh');
    expect(converted.hourly.wind_speed_10m?.[0]).toBeCloseTo(7.2);
    expect(converted.hourly.wind_gusts_10m?.[1]).toBeCloseTo(36);
  });

  it('chybějící hodnotu nedopočítává a ostatní řady nemění', () => {
    const converted = applyWindUnit(forecast, 'kmh');
    expect(converted.hourly.wind_speed_10m?.[1]).toBeNull();
    expect(converted.hourly.temperature_2m?.[0]).toBe(10);
  });
});
