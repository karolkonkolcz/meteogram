import { describe, expect, it } from 'vitest';
import { degreesToCompass, formatNumber, formatPrecipitation } from './units';

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
