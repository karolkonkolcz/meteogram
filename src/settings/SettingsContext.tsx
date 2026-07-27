import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createTranslate, type Translate } from '../i18n';
import { applyTheme, resolveTheme, type ResolvedTheme } from '../lib/theme';
import { readSettings, storeSettings, type Settings } from './settings';

interface SettingsValue {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  resolvedTheme: ResolvedTheme;
  t: Translate;
}

const SettingsContext = createContext<SettingsValue | null>(null);

const DARK_QUERY = '(prefers-color-scheme: dark)';

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => readSettings(navigator.languages ?? []));
  const [systemPrefersDark, setSystemPrefersDark] = useState(
    () => window.matchMedia(DARK_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY);
    const onChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    applyTheme(settings.theme);
    // Jazyk dokumentu musí sledovat volbu – čtečky obrazovky podle něj
    // vybírají výslovnost a prohlížeč nabízí překlad.
    document.documentElement.lang = settings.locale;
  }, [settings.theme, settings.locale]);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((current) => {
      const next = { ...current, ...patch };
      storeSettings(next);
      return next;
    });
  }, []);

  const value = useMemo<SettingsValue>(
    () => ({
      settings,
      update,
      resolvedTheme: resolveTheme(settings.theme, systemPrefersDark),
      t: createTranslate(settings.locale),
    }),
    [settings, systemPrefersDark, update],
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const value = useContext(SettingsContext);
  if (!value) throw new Error('useSettings vyžaduje SettingsProvider');
  return value;
}

/** Zkratka pro komponenty, které potřebují jen překlad. */
export function useT(): Translate {
  return useSettings().t;
}
