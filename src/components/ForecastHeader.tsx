import type { Forecast } from '../api/openMeteo';
import { forecastLengthHours, formatModelRun } from '../lib/time';
import { formatCoordinates, type Location } from '../lib/location';
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
  onOpenSearch,
}: {
  location: Location;
  forecast: Forecast | undefined;
  realElevation: number | null | undefined;
  onOpenSearch: () => void;
}) {
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
          <span className={styles.change}>zmeniť</span>
        </button>
        <p className={`${styles.meta} tabular`}>
          {formatCoordinates(location.latitude, location.longitude)}
          {typeof modelElevation === 'number' && (
            <> · model {Math.round(modelElevation)} m</>
          )}
          {typeof realElevation === 'number' && <> · terén {Math.round(realElevation)} m</>}
        </p>
        {difference !== null && Math.abs(difference) >= 50 && (
          <p className={styles.note}>
            Modelový bod je o {Math.abs(difference)} m {difference > 0 ? 'vyššie' : 'nižšie'} než
            terén, teplota preto môže byť systematicky posunutá.
          </p>
        )}
      </div>

      {forecast && (
        <p className={`${styles.run} tabular`}>
          ECMWF IFS · {formatModelRun(forecast.times[0] ?? 0)} +{' '}
          {forecastLengthHours(forecast.times)} h · {forecast.timezone}
        </p>
      )}
    </header>
  );
}
