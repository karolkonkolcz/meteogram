import { useState } from 'react';
import { ForecastHeader } from './components/ForecastHeader';
import { ForecastTable } from './components/ForecastTable';
import { LocationSearch } from './components/LocationSearch';
import { PanelSkeleton, type PanelSeries } from './components/PanelSkeleton';
import { ThemeToggle } from './components/ThemeToggle';
import { useElevation, useForecast } from './hooks/useForecast';
import { useLocationState } from './hooks/useLocationState';
import { useTheme } from './hooks/useTheme';
import styles from './App.module.css';

/** Poradie panelov je prevzaté z predlohy SHMÚ a v ďalších etapách sa nemení. */
const PANELS: { title: string; unit: string; series: PanelSeries[] }[] = [
  {
    title: 'Teplota v 2 m nad povrchom',
    unit: '°C',
    series: [
      { label: 'teplota', token: '--temp' },
      { label: 'pocitová', token: '--temp-soft' },
    ],
  },
  {
    title: 'Celková oblačnosť',
    unit: '%',
    series: [{ label: 'oblačnosť', token: '--cloud' }],
  },
  {
    title: 'Úhrn zrážok',
    unit: 'mm',
    series: [
      { label: 'dážď', token: '--rain' },
      { label: 'sneh', token: '--snow' },
    ],
  },
  {
    title: 'Tlak redukovaný na hladinu mora',
    unit: 'hPa',
    series: [{ label: 'tlak', token: '--pressure' }],
  },
  {
    title: 'Rýchlosť a nárazy vetra v 10 m',
    unit: 'm/s',
    series: [
      { label: 'rýchlosť', token: '--wind' },
      { label: 'nárazy', token: '--wind-gust' },
    ],
  },
  {
    title: 'Smer vetra v 10 m',
    unit: 'svetové strany',
    series: [{ label: 'smer', token: '--wind-dir' }],
  },
];

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

          <section className={styles.panels} aria-label="Meteogram">
            {PANELS.map((panel) => (
              <PanelSkeleton key={panel.title} {...panel} />
            ))}
          </section>
          <p className={styles.status}>
            Panely vykreslí etapa M2. Dovtedy sú hodnoty v tabuľke nižšie.
          </p>

          <ForecastTable forecast={forecast.data} />
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
