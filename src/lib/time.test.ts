import { describe, expect, it } from 'vitest';
import {
  forecastLengthHours,
  formatDayLabel,
  formatHour,
  formatModelRun,
  isSameLocalDay,
  isWeekend,
  localHour,
  startOfLocalDay,
  stepHours,
} from './time';

/** 27. 7. 2026 00:00 UTC = pondělí. Slovensko je v létě UTC+2. */
const MON_00_UTC = Date.UTC(2026, 6, 27, 0, 0, 0) / 1000;
const CEST = 2 * 3600;

describe('místní čas lokality', () => {
  it('posouvá hodinu podle zóny lokality, ne prohlížeče', () => {
    expect(localHour(MON_00_UTC, CEST)).toBe(2);
    expect(formatHour(MON_00_UTC, CEST)).toBe('02');
    expect(formatHour(MON_00_UTC, 0)).toBe('00');
  });

  it('zvládne i zápornou zónu', () => {
    expect(localHour(MON_00_UTC, -5 * 3600)).toBe(19);
    expect(formatDayLabel(MON_00_UTC, -5 * 3600, 'sk')).toBe('Ne 26');
  });

  it('popisky dnů se liší mezi SK a CS', () => {
    const thursday = MON_00_UTC + 3 * 86400;
    expect(formatDayLabel(thursday, CEST, 'sk')).toBe('Št 30');
    expect(formatDayLabel(thursday, CEST, 'cs')).toBe('Čt 30');
  });

  it('víkend se pozná v místní zóně', () => {
    expect(isWeekend(MON_00_UTC, CEST)).toBe(false);
    expect(isWeekend(MON_00_UTC + 5 * 86400, CEST)).toBe(true);
  });
});

describe('startOfLocalDay', () => {
  it('vrací místní půlnoc přepočtenou zpět na UTC', () => {
    // 27. 7. 04:00 místního času (02:00 UTC) patří do dne, který začal
    // v 00:00 místního času, tedy 26. 7. 22:00 UTC.
    const midnight = startOfLocalDay(MON_00_UTC + 2 * 3600, CEST);
    expect(midnight).toBe(Date.UTC(2026, 6, 26, 22) / 1000);
  });

  it('rozdělí den ve správný okamžik i těsně kolem půlnoci', () => {
    const beforeMidnight = Date.UTC(2026, 6, 26, 21, 59) / 1000;
    const afterMidnight = Date.UTC(2026, 6, 26, 22, 1) / 1000;
    expect(isSameLocalDay(beforeMidnight, afterMidnight, CEST)).toBe(false);
  });
});

describe('nerovnoměrný krok modelu', () => {
  it('spočítá krok mezi sousedními časy', () => {
    const hourly = [0, 3600, 7200];
    expect(stepHours(hourly, 0)).toBe(1);
  });

  it('zachytí přechod z 1h na 3h krok', () => {
    const times = [0, 3600, 7200, 18000];
    expect(stepHours(times, 1)).toBe(1);
    expect(stepHours(times, 2)).toBe(3);
  });

  it('u posledního bodu vrací null místo dopočtu', () => {
    expect(stepHours([0, 3600], 1)).toBeNull();
    expect(stepHours([], 0)).toBeNull();
  });
});

describe('hlavička', () => {
  it('formátuje běh modelu jako v předloze', () => {
    expect(formatModelRun(MON_00_UTC)).toBe('27/07/2026 00 UTC');
  });

  it('spočítá délku předpovědi v hodinách', () => {
    const times = [MON_00_UTC, MON_00_UTC + 384 * 3600];
    expect(forecastLengthHours(times)).toBe(384);
    expect(forecastLengthHours([])).toBe(0);
  });
});
