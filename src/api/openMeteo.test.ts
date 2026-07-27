import { describe, expect, it } from 'vitest';
import { buildForecastUrl, OpenMeteoError, parseForecast } from './openMeteo';

/**
 * Syntetická odpoveď – skutočné správanie IFS nie je overené (docs §11).
 * Fixture preto zámerne obsahuje to, čo od modelu čakáme: 3h krok v chvoste
 * a chýbajúcu premennú.
 */
const BASE = Date.UTC(2026, 6, 27, 0) / 1000;
const TIMES = [BASE, BASE + 3600, BASE + 7200, BASE + 7200 + 10800];

function fixture(overrides: Record<string, unknown> = {}) {
  return {
    latitude: 49.28,
    longitude: 20.68,
    elevation: 786,
    timezone: 'Europe/Bratislava',
    utc_offset_seconds: 7200,
    hourly: {
      time: TIMES,
      temperature_2m: [17.2, 16.8, null, 21.5],
      apparent_temperature: [16.1, 15.9, 15.4, 20.8],
      cloud_cover: [60, 40, 90, 10],
      precipitation: [0, 1.4, 0, 0],
      rain: [0, 1.4, 0, 0],
      snowfall: [0, 0, 0, 0],
      pressure_msl: [1008, 1009, 1010, 1012],
      wind_speed_10m: [1.2, 2.4, 3.1, 2.0],
      wind_gusts_10m: [4.5, 9.1, 12.3, 6.0],
      wind_direction_10m: [180, 200, 215, 190],
      weather_code: [1, 61, 3, 0],
    },
    daily: {
      time: [BASE],
      sunrise: [BASE + 16000],
      sunset: [BASE + 70000],
      precipitation_sum: [11.4],
      temperature_2m_min: [12.1],
      temperature_2m_max: [24.6],
    },
    ...overrides,
  };
}

describe('buildForecastUrl', () => {
  it('žiada model z predlohy, 16 dní a jednotky naplno', () => {
    const url = new URL(buildForecastUrl({ name: 'x', latitude: 49.276, longitude: 20.683 }));
    expect(url.searchParams.get('models')).toBe('ecmwf_ifs025');
    expect(url.searchParams.get('forecast_days')).toBe('16');
    expect(url.searchParams.get('timeformat')).toBe('unixtime');
    expect(url.searchParams.get('timezone')).toBe('auto');
    expect(url.searchParams.get('wind_speed_unit')).toBe('ms');
    expect(url.searchParams.get('hourly')).toContain('wind_gusts_10m');
  });
});

describe('parseForecast', () => {
  it('prečíta hlavičku aj hodinové rady', () => {
    const forecast = parseForecast(fixture());
    expect(forecast.modelElevation).toBe(786);
    expect(forecast.utcOffsetSeconds).toBe(7200);
    expect(forecast.times).toHaveLength(4);
    expect(forecast.hourly.temperature_2m?.[0]).toBe(17.2);
    expect(forecast.missing).toEqual([]);
  });

  it('zachová medzeru namiesto dopočtu chýbajúcej hodnoty', () => {
    const forecast = parseForecast(fixture());
    expect(forecast.hourly.temperature_2m?.[2]).toBeNull();
  });

  it('nepredpokladá pravidelný krok – chvost je po 3 h', () => {
    const forecast = parseForecast(fixture());
    const times = forecast.times;
    expect((times[2]! - times[1]!) / 3600).toBe(1);
    expect((times[3]! - times[2]!) / 3600).toBe(3);
  });

  it('premennú, ktorú model nedodal, ohlási ako chýbajúcu', () => {
    const payload = fixture();
    delete (payload.hourly as Record<string, unknown>).snowfall;
    const forecast = parseForecast(payload);
    expect(forecast.missing).toContain('snowfall');
    expect(forecast.hourly.snowfall).toBeUndefined();
  });

  it('odmietne radu s inou dĺžkou, než má časová os', () => {
    const payload = fixture();
    (payload.hourly as Record<string, unknown>).cloud_cover = [10, 20];
    const forecast = parseForecast(payload);
    // Kratšia rada by tichto posunula hodnoty proti času – radšej chýba.
    expect(forecast.missing).toContain('cloud_cover');
  });

  it('preloží chybovú odpoveď API na zrozumiteľnú výnimku', () => {
    expect(() => parseForecast({ error: true, reason: 'Invalid model' })).toThrow(
      OpenMeteoError,
    );
    expect(() => parseForecast({ error: true, reason: 'Invalid model' })).toThrow(
      /Invalid model/,
    );
  });

  it('bez časovej osi je odpoveď nepoužiteľná', () => {
    expect(() => parseForecast({ hourly: {} })).toThrow(OpenMeteoError);
    expect(() => parseForecast(null)).toThrow(OpenMeteoError);
  });

  it('prečíta denné rady vrátane úhrnu zrážok', () => {
    const forecast = parseForecast(fixture());
    expect(forecast.daily.precipitation_sum?.[0]).toBe(11.4);
    expect(forecast.dailyTimes).toHaveLength(1);
  });
});
