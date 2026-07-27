import { useState } from 'react';
import { ForecastHeader } from './components/ForecastHeader';
import { ForecastTable } from './components/ForecastTable';
import { LocationSearch } from './components/LocationSearch';
import { Meteogram } from './components/meteogram/Meteogram';
import { ThemeToggle } from './components/ThemeToggle';
import { useElevation, useForecast } from './hooks/useForecast';
import { useLocationState } from './hooks/useLocationState';
import { useTheme } from './hooks/useTheme';
import styles from './App.module.css';

export function App() {
  const { preference, setPreference } = useTheme();
  const { location, recent, setLocation } = useLocationState();
  const [searchOpen, setSearchOpen] = useState(false);
  const forecast = useForecast(location);
  const elevation = useElevation(location);

  return (
    <div className={styles.app}>
      <div className={styles.topbar}>
        <h1 className={styles.appName}>Meteogram</h1>
        <ThemeToggle preference={preference} onChange={setPreference} />
      </div>

      <ForecastHeader
        location={location}
        forecast={forecast.data}
        realElevation={elevation.data}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {forecast.isPending && <p className={styles.status}>Načítavam predpoveď…</p>}

      {forecast.isError && (
        <div className={styles.error} role="alert">
          <p>Predpoveď sa nepodarilo načítať: {forecast.error.message}</p>
          <button type="button" className={styles.retry} onClick={() => forecast.refetch()}>
            Skúsiť znova
          </button>
        </div>
      )}

      {forecast.data && (
        <>
          {forecast.data.missing.length > 0 && (
            <p className={styles.status}>
              Model pre túto lokalitu nedodal: {forecast.data.missing.join(', ')}. Príslušné
              panely zostanú prázdne.
            </p>
          )}

          <Meteogram forecast={forecast.data} />

          <details className={styles.tableToggle}>
            <summary>Tabuľka hodnôt</summary>
            <ForecastTable forecast={forecast.data} />
          </details>
        </>
      )}

      {searchOpen && (
        <LocationSearch
          recent={recent}
          onClose={() => setSearchOpen(false)}
          onSelect={(next) => {
            setLocation(next);
            setSearchOpen(false);
          }}
        />
      )}

      <footer className={styles.footer}>
        Dáta:{' '}
        <a className={styles.link} href="https://open-meteo.com/">
          Open-Meteo
        </a>{' '}
        (CC BY 4.0), model ECMWF IFS.
      </footer>
    </div>
  );
}
