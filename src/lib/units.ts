/** Světové strany jsou v SK i CS shodné, jazyk je proto nerozlišuje. */
const COMPASS = ['S', 'SV', 'V', 'JV', 'J', 'JZ', 'Z', 'SZ'] as const;

export type CompassPoint = (typeof COMPASS)[number];

/**
 * Meteorologický směr = odkud vítr fouká. 0° i 360° je sever, proto se
 * zaokrouhluje na osminy kruhu a vrací se do rozsahu 0–7.
 */
export function degreesToCompass(degrees: number): CompassPoint {
  const index = Math.round(degrees / 45) % COMPASS.length;
  return COMPASS[(index + COMPASS.length) % COMPASS.length]!;
}

/** Pořadí na svislé ose panelu směru: S dole i nahoře, jako v předloze. */
export const COMPASS_ORDER: readonly CompassPoint[] = COMPASS;

export function formatNumber(value: number | null | undefined, decimals = 0): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return value.toFixed(decimals);
}

/** Nulové srážky se v tabulce nepíšou jako `0,0` – prázdno se čte líp. */
export function formatPrecipitation(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  if (value === 0) return '';
  return value.toFixed(1);
}
