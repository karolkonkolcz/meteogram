import { describe, expect, it } from 'vitest';
import { extent, niceDomain, niceStep, scaleLinear, ticks } from './scales';

describe('scaleLinear', () => {
  it('mapuje obor na rozsah včetně převrácené osy y', () => {
    const scale = scaleLinear([0, 100], [200, 0]);
    expect(scale(0)).toBe(200);
    expect(scale(100)).toBe(0);
    expect(scale(50)).toBe(100);
  });

  it('invert je inverzní k mapování', () => {
    const scale = scaleLinear([-10, 30], [0, 400]);
    expect(scale.invert(scale(12))).toBeCloseTo(12);
  });

  it('degenerovaný obor nedělí nulou', () => {
    const scale = scaleLinear([5, 5], [0, 100]);
    expect(scale(5)).toBe(50);
    expect(Number.isFinite(scale(5))).toBe(true);
    expect(scale.invert(50)).toBe(5);
  });
});

describe('niceStep', () => {
  it('vybírá kroky z řady 1–2–5–10', () => {
    expect(niceStep(0.9)).toBe(1);
    expect(niceStep(1.4)).toBe(2);
    expect(niceStep(3)).toBe(5);
    expect(niceStep(7)).toBe(10);
    expect(niceStep(23)).toBe(50);
  });

  it('nesmyslný vstup nezpůsobí nekonečno', () => {
    expect(niceStep(0)).toBe(1);
    expect(niceStep(Number.NaN)).toBe(1);
  });
});

describe('ticks', () => {
  it('vrací dílky uvnitř rozsahu s hezkým krokem', () => {
    const result = ticks(0, 100, 5);
    expect(result).toEqual([0, 20, 40, 60, 80, 100]);
  });

  it('nenechá v popiskách plovoucí smetí', () => {
    for (const value of ticks(0, 1, 5)) {
      expect(String(value).length).toBeLessThan(6);
    }
  });

  it('zvládne záporné teploty', () => {
    const result = ticks(-13, 7, 4);
    expect(result).toContain(0);
    expect(result.every((value) => value >= -13 && value <= 7)).toBe(true);
  });

  it('u jediné hodnoty vrací jediný dílek', () => {
    expect(ticks(5, 5)).toEqual([5]);
  });
});

describe('niceDomain', () => {
  it('rozšíří obor na hezké hranice', () => {
    expect(niceDomain(2.3, 27.8, 5)).toEqual([0, 30]);
  });

  it('u konstantní řady vytvoří nenulový obor', () => {
    expect(niceDomain(1013, 1013)).toEqual([1012, 1014]);
  });
});

describe('extent', () => {
  it('přeskočí chybějící hodnoty', () => {
    expect(extent([3, null, 7, null, 1])).toEqual([1, 7]);
  });

  it('řada bez jediné hodnoty nemá rozsah', () => {
    expect(extent([null, null])).toBeNull();
    expect(extent(undefined)).toBeNull();
    expect(extent([])).toBeNull();
  });
});
