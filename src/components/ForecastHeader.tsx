import type { Forecast } from '../api/openMeteo';
import { forecastLengthHours, formatModelRun } from '../lib/time';
import { formatCoordinates, type Location } from '../lib/location';
import { useSettings } from '../settings/SettingsContext';
import styles from './ForecastHeader.module.css';

/**
 * Hlavička drží obsah předlohy SHMÚ: lokalita, souřadnice, obě nadmořské
 * výšky a běh modelu. Rozdíl výšek se ukazuje vždy – v horách je to hlavní
 * zdroj systematické chyby teploty (docs §2.1).
 */
export function ForecastHeader({
  location,
  forecast,
  realElevation,
  compact,
  onOpenSearch,
}: {
  location: Location;
  forecast: Forecast | undefined;
  realElevation: number | null | undefined;
  /** Na telefonu se hlavička krátí – přehled má začínat hned, ne pod metadaty. */
  compact: boolean;
  onOpenSearch: () => void;
}) {
  const { settings, t } = useSettings();
  const modelElevation = forecast?.modelElevation;
  const difference =
    typeof modelElevation === 'number' && typeof realElevation === 'number'
      ? Math.round(modelElevation - realElevation)
      : null;

  return (
    <header className={styles.header}>
      <div className={styles.identity}>
        <button type="button" className={styles.locationButton} onClick={onOpenSearch}>
          <span className={styles.name}>{location.name}</span>
          <span className={styles.change}>{t('header.change')}</span>
        </button>
        <p className={`${styles.meta} tabular`}>
          {formatCoordinates(location.latitude, location.longitude)}
          {!compact && typeof modelElevation === 'number' && (
            <> · {t('header.model', { value: Math.round(modelElevation) })}</>
          )}
          {!compact && typeof realElevation === 'number' && (
            <> · {t('header.terrain', { value: Math.round(realElevation) })}</>
          )}
        </p>
        {!compact && difference !== null && Math.abs(difference) >= 50 && (
          <p className={styles.note}>
            {t(difference > 0 ? 'header.elevationHigher' : 'header.elevationLower', {
              value: Math.abs(difference),
            })}
            {settings.elevationCorrection && ` ${t('header.corrected')}`}
          </p>
        )}
      </div>

      {forecast && (
        <p className={`${styles.run} tabular`} title={forecast.timezone}>
          {compact
            ? t('header.runShort', { hours: forecastLengthHours(forecast.times) })
            : t('header.run', {
                run: formatModelRun(forecast.times[0] ?? 0),
                hours: forecastLengthHours(forecast.times),
                zone: forecast.timezone,
              })}
        </p>
      )}
    </header>
  );
}
