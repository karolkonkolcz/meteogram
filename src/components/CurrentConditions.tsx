import type { Forecast } from '../api/openMeteo';
import { nearestIndex } from '../lib/meteogramGeometry';
import { formatTime } from '../lib/time';
import { degreesToCompass, formatNumber } from '../lib/units';
import { useSettings } from '../settings/SettingsContext';
import styles from './CurrentConditions.module.css';

/**
 * Stav v nejbližším kroku modelu. Na telefonu je to první otázka –
 * proto stojí nad denním přehledem a ne v grafu.
 */
export function CurrentConditions({ forecast }: { forecast: Forecast }) {
  const { settings, t } = useSettings();
  const windUnit = t(settings.windUnit === 'kmh' ? 'unit.kmh' : 'unit.ms');

  const now = Date.now() / 1000;
  const first = forecast.times[0];
  const last = forecast.times[forecast.times.length - 1];
  // Mimo rozsah předpovědi by se ukazoval cizí okamžik – radši nic.
  if (first === undefined || last === undefined || now < first || now > last) return null;

  const index = nearestIndex(forecast.times, now);
  const temperature = forecast.hourly.temperature_2m?.[index];
  const apparent = forecast.hourly.apparent_temperature?.[index];
  const wind = forecast.hourly.wind_speed_10m?.[index];
  const gust = forecast.hourly.wind_gusts_10m?.[index];
  const direction = forecast.hourly.wind_direction_10m?.[index];
  const cloud = forecast.hourly.cloud_cover?.[index];

  return (
    <section className={styles.now} aria-label={t('now.title')}>
      <p className={`${styles.temperature} tabular`}>
        {formatNumber(temperature, 1)}
        <span className={styles.degree}>{t('unit.celsius')}</span>
      </p>
      <dl className={styles.details}>
        {typeof apparent === 'number' && (
          <div className={styles.item}>
            <dt className="visually-hidden">{t('table.apparent')}</dt>
            <dd className="tabular">{t('now.apparent', { value: formatNumber(apparent, 0) })}</dd>
          </div>
        )}
        {typeof cloud === 'number' && (
          <div className={styles.item}>
            <dt>{t('table.cloud')}</dt>
            <dd className="tabular">
              {formatNumber(cloud, 0)} {t('unit.percent')}
            </dd>
          </div>
        )}
        {typeof wind === 'number' && (
          <div className={styles.item}>
            <dt>{t('table.wind')}</dt>
            <dd className="tabular">
              {formatNumber(wind, 0)}
              {typeof gust === 'number' && `–${formatNumber(gust, 0)}`} {windUnit}
              {typeof direction === 'number' && ` ${degreesToCompass(direction)}`}
            </dd>
          </div>
        )}
      </dl>
      <p className={styles.stamp}>
        {t('now.title')} · {formatTime(forecast.times[index] ?? now, forecast.utcOffsetSeconds)}
      </p>
    </section>
  );
}
