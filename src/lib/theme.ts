export type ThemePreference = 'auto' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'meteogram.theme';

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'auto') return systemPrefersDark ? 'dark' : 'light';
  return preference;
}

/**
 * Pro 'auto' se atribut odstraní, aby o motivu rozhodovala media query.
 * Explicitní volba se zapíše na <html> a přebije nastavení OS v obou směrech.
 */
export function applyTheme(preference: ThemePreference): void {
  const root = document.documentElement;
  if (preference === 'auto') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', preference);
  }
}

function isThemePreference(value: string | null): value is ThemePreference {
  return value === 'auto' || value === 'light' || value === 'dark';
}

/** Úložiště může být nedostupné (Safari v soukromém režimu), pád tím nepadá. */
export function readStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isThemePreference(stored) ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

export function storeTheme(preference: ThemePreference): void {
  try {
    localStorage.setItem(STORAGE_KEY, preference);
  } catch {
    /* neukládá se – volba platí jen pro tuto relaci */
  }
}
