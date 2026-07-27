/**
 * Přiblížení se počítá v pixelech na hodinu. Vše ostatní (šířka plochy,
 * pozice bodů, posun) z toho plyne, takže zoom i posun zůstávají jedna
 * veličina a nemůžou se rozejít.
 */

export interface ZoomBounds {
  /** Nejmenší přiblížení: celá předpověď se vejde do výřezu. */
  min: number;
  /** Největší přiblížení: zhruba šest hodin přes celý výřez. */
  max: number;
}

const MAX_VISIBLE_HOURS = 6;

export function zoomBounds(totalHours: number, viewportWidth: number): ZoomBounds {
  const width = Math.max(1, viewportWidth);
  const hours = Math.max(1, totalHours);
  const min = width / hours;
  return { min, max: Math.max(min, width / MAX_VISIBLE_HOURS) };
}

export function clampZoom(pxPerHour: number, bounds: ZoomBounds): number {
  if (!Number.isFinite(pxPerHour)) return bounds.min;
  return Math.min(bounds.max, Math.max(bounds.min, pxPerHour));
}

/**
 * Posun, při kterém zůstane okamžik pod prstem (nebo kurzorem) na místě.
 * Bez tohohle přepočtu by se graf při přiblížení „utíkal“ doleva.
 */
export function anchoredScrollLeft(
  scrollLeft: number,
  pointerOffsetX: number,
  oldPxPerHour: number,
  newPxPerHour: number,
): number {
  if (oldPxPerHour <= 0) return 0;
  const hoursUnderPointer = (scrollLeft + pointerOffsetX) / oldPxPerHour;
  return Math.max(0, hoursUnderPointer * newPxPerHour - pointerOffsetX);
}

/** Vzdálenost dvou dotyků – vstup pro štipec. */
export function pointerDistance(a: { x: number }, b: { x: number }): number {
  return Math.abs(a.x - b.x);
}
