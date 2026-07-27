import type { Forecast } from '../../api/openMeteo';
import { formatDayLabel, formatTime } from '../../lib/time';
import { degreesToCompass, formatNumber } from '../../lib/units';
import styles from './Meteogram.module.css';

const ROWS: {
  label: string;
  key: keyof Forecast['hourly'];
  decimals: number;
  unit: string;
  token: string;
}[] = [
  { label: 'Teplota', key: 'temperature_2m', decimals: 1, unit: '°C', token: '--temp' },
  { label: 'Oblačnosť', key: 'cloud_cover', decimals: 0, unit: '%', token: '--cloud' },
  { label: 'Zrážky', key: 'precipitation', decimals: 1, unit: 'mm', token: '--rain' },
  { label: 'Tlak', key: 'pressure_msl', decimals: 0, unit: 'hPa', token: '--pressure' },
  { label: 'Vietor', key: 'wind_speed_10m', decimals: 1, unit: 'm/s', token: '--wind' },
  { label: 'Nárazy', key: 'wind_gusts_10m', decimals: 1, unit: 'm/s', token: '--wind-gust' },
];

/**
 * Jedna bublina pro všechny panely – v tom je smysl sdílené osy: uživatel
 * čte celý stav počasí v jednom okamžiku, ne šest hodnot ze šesti panelů.
 */
export function Tooltip({
  forecast,
  index,
  x,
  flip,
  width,
}: {
  forecast: Forecast;
  index: number;
  x: number;
  flip: boolean;
  width: number;
}) {
  const time = forecast.times[index];
  if (time === undefined) return null;

  const direction = forecast.hourly.wind_direction_10m?.[index];
  const offset = forecast.utcOffsetSeconds;

  return (
    <div
      className={styles.tooltip}
      style={{ left: x, width, transform: flip ? 'translateX(calc(-100% - 12px))' : undefined }}
      role="status"
    >
      <p className={styles.tooltipTime}>
        {formatDayLabel(time, offset, 'sk')} · {formatTime(time, offset)}
      </p>
      <dl className={styles.tooltipList}>
        {ROWS.map((row) => {
          const value = forecast.hourly[row.key]?.[index];
          if (value === undefined) return null;
          return (
            <div key={row.key} className={styles.tooltipRow}>
              <dt>
                <span
                  className={styles.swatch}
                  style={{ background: `var(${row.token})` }}
                  aria-hidden="true"
                />
                {row.label}
              </dt>
              <dd className="tabular">
                {formatNumber(value, row.decimals)} {row.unit}
              </dd>
            </div>
          );
        })}
        {direction !== undefined && (
          <div className={styles.tooltipRow}>
            <dt>
              <span
                className={styles.swatch}
                style={{ background: 'var(--wind-dir)' }}
                aria-hidden="true"
              />
              Smer
            </dt>
            <dd className="tabular">
              {direction === null ? '—' : `${degreesToCompass(direction)} (${Math.round(direction)}°)`}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
