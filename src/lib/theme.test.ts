import { describe, expect, it } from 'vitest';
import { applyTheme, resolveTheme } from './theme';

describe('resolveTheme', () => {
  it('sleduje nastavení OS v režimu auto', () => {
    expect(resolveTheme('auto', true)).toBe('dark');
    expect(resolveTheme('auto', false)).toBe('light');
  });

  it('explicitní volba přebije nastavení OS v obou směrech', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('applyTheme', () => {
  it('zapíše explicitní volbu na kořenový element', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  it('v režimu auto atribut odstraní, aby rozhodla media query', () => {
    applyTheme('light');
    applyTheme('auto');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });
});
