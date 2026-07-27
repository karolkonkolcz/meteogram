import type { Locale } from '../lib/time';
import { cs } from './cs';
import { sk, type Dictionary, type MessageKey } from './sk';

export type { MessageKey };
export type Translate = (key: MessageKey, params?: Record<string, string | number>) => string;

const DICTIONARIES: Record<Locale, Dictionary> = { sk, cs };

export function createTranslate(locale: Locale): Translate {
  const dictionary = DICTIONARIES[locale];
  return (key, params) => {
    const template = dictionary[key];
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  };
}

/**
 * Jazyk se nabídne podle prohlížeče jen při první návštěvě; potom
 * rozhoduje volba uživatele a už se nikdy nepřepne sám (docs §3.7).
 */
export function detectLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const code = language.toLowerCase();
    if (code.startsWith('cs')) return 'cs';
    if (code.startsWith('sk')) return 'sk';
  }
  return 'sk';
}
