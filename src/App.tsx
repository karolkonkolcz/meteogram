import { PanelSkeleton, type PanelSeries } from './components/PanelSkeleton';
import { ThemeToggle } from './components/ThemeToggle';
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

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Meteogram</h1>
          <p className={styles.subtitle}>
            Predpoveď na 16 dní z modelu ECMWF. Kostra aplikácie – dáta a výber
            lokality pridá etapa M1.
          </p>
        </div>
        <ThemeToggle preference={preference} onChange={setPreference} />
      </header>

      <main className={styles.panels}>
        {PANELS.map((panel) => (
          <PanelSkeleton key={panel.title} {...panel} />
        ))}
      </main>

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
