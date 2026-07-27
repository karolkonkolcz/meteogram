import { describe, expect, it } from 'vitest';
import { createTranslate, detectLocale } from './index';
import { sk } from './sk';
import { cs } from './cs';

describe('createTranslate', () => {
  it('vrací text ve zvoleném jazyce', () => {
    expect(createTranslate('sk')('app.retry')).toBe('Skúsiť znova');
    expect(createTranslate('cs')('app.retry')).toBe('Zkusit znovu');
  });

  it('doplní parametry do šablony', () => {
    const t = createTranslate('cs');
    expect(t('header.model', { value: 786 })).toBe('model 786 m');
  });

  it('nezná-li parametr, nechá zástupný text být', () => {
    expect(createTranslate('sk')('header.model', { other: 1 })).toContain('{value}');
  });
});

describe('slovníky', () => {
  it('mají shodnou sadu klíčů', () => {
    expect(Object.keys(cs).sort()).toEqual(Object.keys(sk).sort());
  });

  it('nemají prázdné texty', () => {
    for (const [key, value] of Object.entries({ ...sk, ...cs })) {
      expect(value, key).not.toBe('');
    }
  });
});

describe('detectLocale', () => {
  it('rozpozná češtinu i slovenštinu včetně regionu', () => {
    expect(detectLocale(['cs-CZ', 'en'])).toBe('cs');
    expect(detectLocale(['sk-SK'])).toBe('sk');
  });

  it('u ostatních jazyků nabídne slovenštinu', () => {
    expect(detectLocale(['en-US', 'de'])).toBe('sk');
    expect(detectLocale([])).toBe('sk');
  });

  it('rozhoduje první srozumitelný jazyk v pořadí', () => {
    expect(detectLocale(['de', 'cs', 'sk'])).toBe('cs');
  });
});
