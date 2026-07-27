import type { Forecast } from '../api/openMeteo';
import { formatDayLabel, formatTime, isSameLocalDay } from '../lib/time';
import { degreesToCompass, formatNumber, formatPrecipitation } from '../lib/units';
import styles from './ForecastTable.module.css';

/**
 * Tabulka hodnot. V M1 je hlavním výstupem, v M2 zůstane jako textová
 * alternativa grafu – a je zároveň úlevou pro nízký kontrast sněhu
 * ve světlém motivu (docs §3.0.1), takže nezmizí ani později.
 */
export function ForecastTable({ forecast }: { forecast: Forecast }) {
  const { times, hourly, utcOffsetSeconds } = forecast;

  return (
    <div className={styles.wrapper}>
      <table className={`${styles.table} tabular`}>
        <caption className="visually-hidden">
          Hodinové hodnoty predpovede pre zvolenú lokalitu
        </caption>
        <thead>
          <tr>
            <th scope="col">Čas</th>
            <th scope="col">Teplota °C</th>
            <th scope="col">Pocitová °C</th>
            <th scope="col">Oblačnosť %</th>
            <th scope="col">Zrážky mm</th>
            <th scope="col">Tlak hPa</th>
            <th scope="col">Vietor m/s</th>
            <th scope="col">Nárazy m/s</th>
            <th scope="col">Smer</th>
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
                      {formatDayLabel(time, utcOffsetSeconds, 'sk')}
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
