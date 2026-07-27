import type { Forecast } from '../api/openMeteo';
import { daySpans, type DaySpan } from './meteogramGeometry';
import { startOfLocalDay, type Locale } from './time';

export interface DaySummary extends DaySpan {
  temperatureMin: number | null;
  temperatureMax: number | null;
  precipitation: number | null;
  maxGust: number | null;
  meanCloud: number | null;
}

/**
 * Denní souhrn pro rychlý přehled na malém displeji. Počítá se z hodinových
 * řad, ne z denních polí modelu – jen tak se v přehledu projeví nastavení
 * (jednotka větru, přepočet teploty na výšku terénu), které už je v datech.
 */
export function summarizeDays(forecast: Forecast, locale: Locale): DaySummary[] {
  const { times, hourly, utcOffsetSeconds } = forecast;

  // Každý čas patří právě jednomu dni. Porovnávání s rozsahem dne by
  // půlnoční hodinu započítalo dvakrát – do včerejška i do dneška.
  const dayOfIndex = times.map((time) => startOfLocalDay(time, utcOffsetSeconds));

  return daySpans(times, utcOffsetSeconds, locale).map((day) => {
    const key = startOfLocalDay(day.start, utcOffsetSeconds);
    let temperatureMin = Number.POSITIVE_INFINITY;
    let temperatureMax = Number.NEGATIVE_INFINITY;
    let precipitation: number | null = null;
    let maxGust: number | null = null;
    let cloudSum = 0;
    let cloudCount = 0;

    for (let index = 0; index < times.length; index += 1) {
      if (dayOfIndex[index] !== key) continue;

      const temperature = hourly.temperature_2m?.[index];
      if (typeof temperature === 'number') {
        if (temperature < temperatureMin) temperatureMin = temperature;
        if (temperature > temperatureMax) temperatureMax = temperature;
      }

      const rain = hourly.precipitation?.[index];
      if (typeof rain === 'number') precipitation = (precipitation ?? 0) + rain;

      const gust = hourly.wind_gusts_10m?.[index];
      if (typeof gust === 'number' && (maxGust === null || gust > maxGust)) maxGust = gust;

      const cloud = hourly.cloud_cover?.[index];
      if (typeof cloud === 'number') {
        cloudSum += cloud;
        cloudCount += 1;
      }
    }

    return {
      ...day,
      temperatureMin: Number.isFinite(temperatureMin) ? temperatureMin : null,
      temperatureMax: Number.isFinite(temperatureMax) ? temperatureMax : null,
      precipitation,
      maxGust,
      meanCloud: cloudCount > 0 ? cloudSum / cloudCount : null,
    };
  });
}

/** Společný teplotní rozsah všech dnů – pruhy v přehledu musí mít jedno měřítko. */
export function temperatureRange(days: readonly DaySummary[]): [number, number] | null {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (const day of days) {
    if (day.temperatureMin !== null && day.temperatureMin < min) min = day.temperatureMin;
    if (day.temperatureMax !== null && day.temperatureMax > max) max = day.temperatureMax;
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return min === max ? [min - 1, max + 1] : [min, max];
}
