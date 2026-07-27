import type { Forecast, Series } from '../api/openMeteo';

/** Suchoadiabatický gradient: 0,65 °C na 100 m (docs §2.1). */
export const LAPSE_RATE_PER_M = 0.0065;

/**
 * Model počítá v jiné nadmořské výšce než skutečný terén. Je-li modelový
 * bod výš, je v něm chladněji, než ve skutečnosti bývá dole – korekce
 * proto rozdíl výšek promítne do teploty.
 *
 * Zůstává volitelná a defaultně vypnutá: je to hrubý odhad, ne fyzika.
 */
export function correctTemperature(
  value: number,
  modelElevation: number,
  realElevation: number,
): number {
  return value + (modelElevation - realElevation) * LAPSE_RATE_PER_M;
}

function correctSeries(
  series: Series | undefined,
  modelElevation: number,
  realElevation: number,
): Series | undefined {
  if (!series) return undefined;
  return series.map((value) =>
    value === null ? null : correctTemperature(value, modelElevation, realElevation),
  );
}

/**
 * Vrací novou předpověď s opravenou teplotou. Beze změny vrací původní
 * objekt, aby na něm mohly dál stát `useMemo` závislosti.
 */
export function applyElevationCorrection(
  forecast: Forecast,
  realElevation: number | null | undefined,
  enabled: boolean,
): Forecast {
  const modelElevation = forecast.modelElevation;
  if (
    !enabled ||
    typeof modelElevation !== 'number' ||
    typeof realElevation !== 'number' ||
    Math.abs(modelElevation - realElevation) < 1
  ) {
    return forecast;
  }

  const temperature = correctSeries(forecast.hourly.temperature_2m, modelElevation, realElevation);
  const apparent = correctSeries(
    forecast.hourly.apparent_temperature,
    modelElevation,
    realElevation,
  );

  return {
    ...forecast,
    hourly: {
      ...forecast.hourly,
      ...(temperature ? { temperature_2m: temperature } : {}),
      ...(apparent ? { apparent_temperature: apparent } : {}),
    },
  };
}
