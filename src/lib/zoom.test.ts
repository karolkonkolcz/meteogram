import { describe, expect, it } from 'vitest';
import { anchoredScrollLeft, clampZoom, zoomBounds } from './zoom';

describe('zoomBounds', () => {
  it('nejmenší přiblížení vejde celou předpověď do výřezu', () => {
    const bounds = zoomBounds(384, 960);
    expect(bounds.min).toBeCloseTo(2.5);
    expect(384 * bounds.min).toBeCloseTo(960);
  });

  it('největší přiblížení ukáže zhruba šest hodin', () => {
    const bounds = zoomBounds(384, 960);
    expect(960 / bounds.max).toBeCloseTo(6);
  });

  it('u velmi krátké předpovědi se meze nepřekříží', () => {
    const bounds = zoomBounds(2, 960);
    expect(bounds.max).toBeGreaterThanOrEqual(bounds.min);
  });
});

describe('clampZoom', () => {
  const bounds = zoomBounds(384, 960);

  it('drží hodnotu v mezích', () => {
    expect(clampZoom(0.01, bounds)).toBe(bounds.min);
    expect(clampZoom(10_000, bounds)).toBe(bounds.max);
    expect(clampZoom(20, bounds)).toBe(20);
  });

  it('nesmyslný vstup spadne na oddálený pohled', () => {
    expect(clampZoom(Number.NaN, bounds)).toBe(bounds.min);
  });
});

describe('anchoredScrollLeft', () => {
  it('nechá okamžik pod kurzorem na místě', () => {
    // Kurzor 300 px od levého okraje výřezu, posunuto o 1200 px, 4 px/h.
    // Pod kurzorem je hodina (1200 + 300) / 4 = 375.
    const next = anchoredScrollLeft(1200, 300, 4, 8);
    expect((next + 300) / 8).toBeCloseTo(375);
  });

  it('platí i při oddalování', () => {
    const next = anchoredScrollLeft(1200, 300, 8, 4);
    expect((next + 300) / 4).toBeCloseTo((1200 + 300) / 8);
  });

  it('nikdy nevrací záporný posun', () => {
    expect(anchoredScrollLeft(0, 10, 8, 1)).toBe(0);
  });

  it('nulové přiblížení nezpůsobí dělení nulou', () => {
    expect(anchoredScrollLeft(100, 10, 0, 4)).toBe(0);
  });
});
