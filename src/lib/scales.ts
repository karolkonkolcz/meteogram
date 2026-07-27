/**
 * Minimalistické škály. Návrh počítal s `d3-scale`, ale meteogram z něj
 * potřebuje jen lineární mapování a hezké dílky – dvě desítky řádků, které
 * nestojí za dvě závislosti navíc (viz docs §6, poznámka k M2).
 */

export interface LinearScale {
  (value: number): number;
  invert(position: number): number;
  readonly domain: readonly [number, number];
  readonly range: readonly [number, number];
}

export function scaleLinear(
  domain: readonly [number, number],
  range: readonly [number, number],
): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  // Degenerovaný obor (samé stejné hodnoty) by dělil nulou – mapuje se do středu.
  const span = d1 - d0;

  const scale = ((value: number) =>
    span === 0 ? (r0 + r1) / 2 : r0 + ((value - d0) / span) * (r1 - r0)) as {
    (value: number): number;
    invert(position: number): number;
    domain: readonly [number, number];
    range: readonly [number, number];
  };

  scale.invert = (position: number) => {
    if (r1 - r0 === 0) return d0;
    return d0 + ((position - r0) / (r1 - r0)) * span;
  };
  scale.domain = domain;
  scale.range = range;
  return scale;
}

/** Nejbližší „hezký“ krok z řady 1 – 2 – 5 – 10 × 10ⁿ. */
export function niceStep(rawStep: number): number {
  if (!Number.isFinite(rawStep) || rawStep <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const normalized = rawStep / magnitude;
  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

export function ticks(min: number, max: number, targetCount = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  if (min === max) return [min];
  const step = niceStep((max - min) / Math.max(1, targetCount));
  const first = Math.ceil(min / step) * step;
  const result: number[] = [];
  // Zaokrouhlení drží hodnoty jako 0,30000000000000004 mimo popisky osy.
  for (let value = first; value <= max + step / 1000; value += step) {
    result.push(Number((Math.round(value / step) * step).toFixed(10)));
  }
  return result;
}

/** Obor rozšířený na hezké hranice, aby čára nekončila na okraji panelu. */
export function niceDomain(
  min: number,
  max: number,
  targetCount = 5,
): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (min === max) return [min - 1, max + 1];
  const step = niceStep((max - min) / Math.max(1, targetCount));
  return [Math.floor(min / step) * step, Math.ceil(max / step) * step];
}

/** Rozsah řady; hodnoty `null` (které model nedodal) se přeskakují. */
export function extent(
  series: readonly (number | null)[] | undefined,
): [number, number] | null {
  if (!series) return null;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const value of series) {
    if (value === null || !Number.isFinite(value)) continue;
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return Number.isFinite(min) && Number.isFinite(max) ? [min, max] : null;
}
