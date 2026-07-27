import { detectLocale } from '../i18n';
import type { ThemePreference } from '../lib/theme';
import type { Locale } from '../lib/time';
import type { WindUnit } from '../lib/units';

export type { WindUnit };

export interface Settings {
  locale: Locale;
  theme: ThemePreference;
  windUnit: WindUnit;
  /** Přepočet teploty na výšku terénu; defaultně vypnutý (docs §2.1). */
  elevationCorrection: boolean;
}

const STORAGE_KEY = 'meteogram.settings';

export function defaultSettings(languages: readonly string[]): Settings {
  return {
    locale: detectLocale(languages),
    theme: 'auto',
    windUnit: 'ms',
    elevationCorrection: false,
  };
}

function isLocale(value: unknown): value is Locale {
  return value === 'sk' || value === 'cs';
}

function isTheme(value: unknown): value is ThemePreference {
  return value === 'auto' || value === 'light' || value === 'dark';
}

/**
 * Uložené nastavení je cizí vstup (jiná verze aplikace, ruční úprava).
 * Neznámé hodnoty se proto zahazují po jedné, ne celý objekt najednou.
 */
export function readSettings(languages: readonly string[]): Settings {
  const fallback = defaultSettings(languages);
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return fallback;
    const value = parsed as Record<string, unknown>;

    return {
      locale: isLocale(value.locale) ? value.locale : fallback.locale,
      theme: isTheme(value.theme) ? value.theme : fallback.theme,
      windUnit: value.windUnit === 'kmh' ? 'kmh' : 'ms',
      elevationCorrection: value.elevationCorrection === true,
    };
  } catch {
    return fallback;
  }
}

export function storeSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* neukládá se – volba platí jen pro tuto relaci */
  }
}
