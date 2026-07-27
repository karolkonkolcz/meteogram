import { useMemo } from 'react';
import type { Forecast } from '../api/openMeteo';
import { summarizeDays, temperatureRange } from '../lib/dailySummary';
import { CONFIDENT_DAYS } from '../lib/meteogramGeometry';
import { formatNumber } from '../lib/units';
import { useSettings } from '../settings/SettingsContext';
import styles from './DailyOverview.module.css';

/**
 * Rychlý přehled pro malý displej: jeden řádek na den, žádné vodorovné
 * posouvání. Podrobný graf zůstává dostupný, ale až na vyžádání – na
 * telefonu je hlavní otázka „jaký bude zítřek“, ne průběh po hodinách.
 */
export function DailyOverview({ forecast }: { forecast: Forecast }) {
  const { settings, t } = useSettings();
  const windUnit = t(settings.windUnit === 'kmh' ? 'unit.kmh' : 'unit.ms');

  const days = useMemo(
    () =>
      summarizeDays(forecast, settings.locale)
        // Useknutý den na konci předpovědi má minimum a maximum jen z pár
        // hodin – v přehledu vedle celých dnů by to bylo zavádějící.
        .filter((day) => day.end - day.start >= 12 * 3600),
    [forecast, settings.locale],
  );
  const range = useMemo(() => temperatureRange(days), [days]);

  return (
    <ul className={styles.list}>
      {days.map((day, index) => {
        const uncertain = index >= CONFIDENT_DAYS;
        const bar =
          range && day.temperatureMin !== null && day.temperatureMax !== null
            ? {
                left: ((day.temperatureMin - range[0]) / (range[1] - range[0])) * 100,
                width: ((day.temperatureMax - day.temperatureMin) / (range[1] - range[0])) * 100,
              }
            : null;

        return (
          <li
            key={day.start}
            className={`${styles.row} ${day.weekend ? styles.weekend : ''} ${
              uncertain ? styles.uncertain : ''
            }`}
          >
            <span className={styles.day}>{day.label}</span>

            <span className={`${styles.temperatures} tabular`}>
              <span className={styles.min}>{formatNumber(day.temperatureMin, 0)}°</span>
              <span className={styles.track} aria-hidden="true">
                {bar && (
                  <span
                    className={styles.bar}
                    style={{ left: `${bar.left}%`, width: `${Math.max(bar.width, 3)}%` }}
                  />
                )}
              </span>
              <span className={styles.max}>{formatNumber(day.temperatureMax, 0)}°</span>
            </span>

            <span className={`${styles.extras} tabular`}>
              {day.precipitation !== null && day.precipitation >= 0.1 && (
                <span className={styles.precipitation}>
                  {formatNumber(day.precipitation, 1)} {t('unit.mm')}
                </span>
              )}
              {day.maxGust !== null && (
                <span className={styles.gust}>
                  {formatNumber(day.maxGust, 0)} {windUnit}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
