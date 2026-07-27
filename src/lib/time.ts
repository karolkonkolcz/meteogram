/**
 * Čas v meteogramu je vždy **místní čas lokality**, ne prohlížeče:
 * předpověď pro slovenskou obec ukazuje slovenský čas i uživateli v jiné zóně.
 *
 * Open-Meteo vrací časy jako unixové sekundy (UTC) plus `utc_offset_seconds`
 * pro zvolenou zónu. Posunutý okamžik proto čteme UTC gettery – tím dostaneme
 * místní hodnoty bez závislosti na zóně prohlížeče a bez knihovny.
 */

export type Locale = 'sk' | 'cs';

const DAY_NAMES: Record<Locale, readonly string[]> = {
  sk: ['Ne', 'Po', 'Ut', 'St', 'Št', 'Pi', 'So'],
  cs: ['Ne', 'Po', 'Út', 'St', 'Čt', 'Pá', 'So'],
};

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/** Okamžik posunutý do místní zóny lokality; čte se výhradně UTC gettery. */
function shifted(epochSeconds: number, utcOffsetSeconds: number): Date {
  return new Date((epochSeconds + utcOffsetSeconds) * 1000);
}

export function localHour(epochSeconds: number, utcOffsetSeconds: number): number {
  return shifted(epochSeconds, utcOffsetSeconds).getUTCHours();
}

/** Dvojciferná hodina pro popisky osy: `00`, `06`, `12`, `18`. */
export function formatHour(epochSeconds: number, utcOffsetSeconds: number): string {
  return String(localHour(epochSeconds, utcOffsetSeconds)).padStart(2, '0');
}

export function formatTime(epochSeconds: number, utcOffsetSeconds: number): string {
  const date = shifted(epochSeconds, utcOffsetSeconds);
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${formatHour(epochSeconds, utcOffsetSeconds)}:${minutes}`;
}

/** Popisek dne pod osou, jako v předloze: `Pon 27` → zde `Po 27`. */
export function formatDayLabel(
  epochSeconds: number,
  utcOffsetSeconds: number,
  locale: Locale,
): string {
  const date = shifted(epochSeconds, utcOffsetSeconds);
  const names = DAY_NAMES[locale];
  const name = names[date.getUTCDay()] ?? '';
  return `${name} ${date.getUTCDate()}`;
}

export function isWeekend(epochSeconds: number, utcOffsetSeconds: number): boolean {
  const day = shifted(epochSeconds, utcOffsetSeconds).getUTCDay();
  return day === 0 || day === 6;
}

/** Půlnoc místního dne, vrácená zpět jako unixové sekundy (UTC). */
export function startOfLocalDay(epochSeconds: number, utcOffsetSeconds: number): number {
  const date = shifted(epochSeconds, utcOffsetSeconds);
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  return midnight / 1000 - utcOffsetSeconds;
}

export function isSameLocalDay(
  a: number,
  b: number,
  utcOffsetSeconds: number,
): boolean {
  return startOfLocalDay(a, utcOffsetSeconds) === startOfLocalDay(b, utcOffsetSeconds);
}

/**
 * Krok mezi po sobě jdoucími časy v hodinách. ECMWF IFS přechází zhruba
 * po 90 h z 1h na 3h krok, panely proto nesmí předpokládat pevný rozestup.
 */
export function stepHours(times: readonly number[], index: number): number | null {
  const current = times[index];
  const next = times[index + 1];
  if (current === undefined || next === undefined) return null;
  return (next - current) / 3600;
}

/** Běh modelu jako v hlavičce předlohy: `27/07/2026 00 UTC`. */
export function formatModelRun(epochSeconds: number): string {
  const date = new Date(epochSeconds * 1000);
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const hour = String(date.getUTCHours()).padStart(2, '0');
  return `${day}/${month}/${date.getUTCFullYear()} ${hour} UTC`;
}

/** Délka předpovědi v hodinách – druhá polovina hlavičky (`+ 384 H`). */
export function forecastLengthHours(times: readonly number[]): number {
  const first = times[0];
  const last = times[times.length - 1];
  if (first === undefined || last === undefined) return 0;
  return Math.round((last - first) / 3600);
}

export { HOUR_MS, DAY_MS };
