import type { Forecast } from '../api/openMeteo';
import { useSettings } from '../settings/SettingsContext';
import { formatDayLabel, formatTime, isSameLocalDay } from '../lib/time';
import { degreesToCompass, formatNumber, formatPrecipitation } from '../lib/units';
import styles from './ForecastTable.module.css';

/**
 * Tabulka hodnot. V M1 je hlavním výstupem, v M2 zůstane jako textová
 * alternativa grafu – a je zároveň úlevou pro nízký kontrast sněhu
 * ve světlém motivu (docs §3.0.1), takže nezmizí ani později.
 */
export function ForecastTable({ forecast }: { forecast: Forecast }) {
  const { settings, t } = useSettings();
  const { times, hourly, utcOffsetSeconds } = forecast;
  const windUnit = t(settings.windUnit === 'kmh' ? 'unit.kmh' : 'unit.ms');

  return (
    <div className={styles.wrapper}>
      <table className={`${styles.table} tabular`}>
        <caption className="visually-hidden">{t('table.caption')}</caption>
        <thead>
          <tr>
            <th scope="col">{t('table.time')}</th>
            <th scope="col">{t('table.temperature')} {t('unit.celsius')}</th>
            <th scope="col">{t('table.apparent')} {t('unit.celsius')}</th>
            <th scope="col">{t('table.cloud')} {t('unit.percent')}</th>
            <th scope="col">{t('table.precipitation')} {t('unit.mm')}</th>
            <th scope="col">{t('table.pressure')} {t('unit.hpa')}</th>
            <th scope="col">{t('table.wind')} {windUnit}</th>
            <th scope="col">{t('table.gust')} {windUnit}</th>
            <th scope="col">{t('table.direction')}</th>
          </tr>
        </thead>
        <tbody>
          {times.map((time, index) => {
            const previous = times[index - 1];
            const newDay = previous === undefined || !isSameLocalDay(previous, time, utcOffsetSeconds);
            const direction = hourly.wind_direction_10m?.[index];

            return (
              <tr key={time} className={newDay ? styles.dayStart : undefined}>
                <th scope="row" className={styles.time}>
                  {newDay && (
                    <span className={styles.day}>
                      {formatDayLabel(time, utcOffsetSeconds, settings.locale)}
                    </span>
                  )}
                  {formatTime(time, utcOffsetSeconds)}
                </th>
                <td>{formatNumber(hourly.temperature_2m?.[index], 1)}</td>
                <td>{formatNumber(hourly.apparent_temperature?.[index], 1)}</td>
                <td>{formatNumber(hourly.cloud_cover?.[index])}</td>
                <td>{formatPrecipitation(hourly.precipitation?.[index])}</td>
                <td>{formatNumber(hourly.pressure_msl?.[index])}</td>
                <td>{formatNumber(hourly.wind_speed_10m?.[index], 1)}</td>
                <td>{formatNumber(hourly.wind_gusts_10m?.[index], 1)}</td>
                <td>
                  {direction === null || direction === undefined
                    ? '—'
                    : degreesToCompass(direction)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
