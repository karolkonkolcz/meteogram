import type { Forecast } from '../../api/openMeteo';
import type { MessageKey } from '../../i18n';
import { useSettings } from '../../settings/SettingsContext';
import { formatDayLabel, formatTime } from '../../lib/time';
import { degreesToCompass, formatNumber } from '../../lib/units';
import styles from './Meteogram.module.css';

const ROWS: {
  labelKey: MessageKey;
  key: keyof Forecast['hourly'];
  decimals: number;
  unitKey: MessageKey | 'wind';
  token: string;
}[] = [
  { labelKey: 'table.temperature', key: 'temperature_2m', decimals: 1, unitKey: 'unit.celsius', token: '--temp' },
  { labelKey: 'table.cloud', key: 'cloud_cover', decimals: 0, unitKey: 'unit.percent', token: '--cloud' },
  { labelKey: 'table.precipitation', key: 'precipitation', decimals: 1, unitKey: 'unit.mm', token: '--rain' },
  { labelKey: 'table.pressure', key: 'pressure_msl', decimals: 0, unitKey: 'unit.hpa', token: '--pressure' },
  { labelKey: 'table.wind', key: 'wind_speed_10m', decimals: 1, unitKey: 'wind', token: '--wind' },
  { labelKey: 'table.gust', key: 'wind_gusts_10m', decimals: 1, unitKey: 'wind', token: '--wind-gust' },
];

/**
 * Jedna bublina pro všechny panely – v tom je smysl sdílené osy: uživatel
 * čte celý stav počasí v jednom okamžiku, ne šest hodnot ze šesti panelů.
 */
export function Tooltip({
  forecast,
  index,
  windUnitKey,
  x,
  flip,
  width,
}: {
  forecast: Forecast;
  index: number;
  windUnitKey: MessageKey;
  x: number;
  flip: boolean;
  width: number;
}) {
  const { settings, t } = useSettings();
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
        {formatDayLabel(time, offset, settings.locale)} · {formatTime(time, offset)}
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
                {t(row.labelKey)}
              </dt>
              <dd className="tabular">
                {formatNumber(value, row.decimals)}{' '}
                {t(row.unitKey === 'wind' ? windUnitKey : row.unitKey)}
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
              {t('table.direction')}
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
