import { useEffect, useMemo, useRef, useState } from 'react';
import { CurrentConditions } from './components/CurrentConditions';
import { DailyOverview } from './components/DailyOverview';
import { ForecastHeader } from './components/ForecastHeader';
import { ForecastTable } from './components/ForecastTable';
import { LocationSearch } from './components/LocationSearch';
import { SettingsDialog } from './components/SettingsDialog';
import { Meteogram } from './components/meteogram/Meteogram';
import { useElevation, useForecast } from './hooks/useForecast';
import { useLocationState } from './hooks/useLocationState';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useSettings } from './settings/SettingsContext';
import { reverseGeocode } from './api/geocoding';
import { applyElevationCorrection } from './lib/correction';
import { isCoordinateName } from './lib/location';
import { applyWindUnit } from './lib/units';
import styles from './App.module.css';

export function App() {
  const { settings, t } = useSettings();
  // Na telefonu je hlavní pohled denní přehled; graf po hodinách je až
  // druhá otázka a vyžadoval by vodorovné tažení hned na úvod.
  const compact = useMediaQuery('(max-width: 599px)');
  const { location, recent, setLocation, renameCurrent } = useLocationState();
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Graf i tabulka jsou drahé (stovky prvků). Ve sbalené sekci by se
  // vykreslily zbytečně, proto se montují až při rozbalení.
  const [chartOpen, setChartOpen] = useState(false);
  const [tableOpen, setTableOpen] = useState(false);
  const forecast = useForecast(location);
  const elevation = useElevation(location);

  /**
   * Lokalita z GPS se mohla uložit jen jako souřadnice – buď proto, že
   * reverzní geokódování tehdy selhalo, nebo pochází ze starší verze.
   * Jméno se proto zkusí doplnit i dodatečně, jednou na dané souřadnice.
   */
  const renameAttempts = useRef(new Set<string>());
  useEffect(() => {
    if (!isCoordinateName(location.name)) return;
    const key = `${location.latitude},${location.longitude}`;
    if (renameAttempts.current.has(key)) return;
    renameAttempts.current.add(key);

    let cancelled = false;
    reverseGeocode(location.latitude, location.longitude, settings.locale)
      .then((name) => {
        if (!cancelled && name) renameCurrent(name);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [location.name, location.latitude, location.longitude, settings.locale, renameCurrent]);

  /**
   * Nastavení se promítne do dat jednou, tady. Panely, bublina i tabulka
   * pak nemůžou ukázat různá čísla pro tutéž veličinu.
   */
  const prepared = useMemo(() => {
    if (!forecast.data) return undefined;
    const corrected = applyElevationCorrection(
      forecast.data,
      elevation.data,
      settings.elevationCorrection,
    );
    return applyWindUnit(corrected, settings.windUnit);
  }, [forecast.data, elevation.data, settings.elevationCorrection, settings.windUnit]);

  return (
    <div className={styles.app}>
      <div className={styles.topbar}>
        <h1 className={styles.appName}>{t('app.name')}</h1>
        <button
          type="button"
          className={styles.settingsButton}
          onClick={() => setSettingsOpen(true)}
        >
          {t('app.settings')}
        </button>
      </div>

      <ForecastHeader
        location={location}
        forecast={prepared}
        realElevation={elevation.data}
        compact={compact}
        onOpenSearch={() => setSearchOpen(true)}
      />

      {forecast.isPending && <p className={styles.status}>{t('app.loading')}</p>}

      {forecast.isError && (
        <div className={styles.error} role="alert">
          <p>{t('app.error', { message: forecast.error.message })}</p>
          <button type="button" className={styles.retry} onClick={() => forecast.refetch()}>
            {t('app.retry')}
          </button>
        </div>
      )}

      {prepared && (
        <>
          {prepared.missing.length > 0 && (
            <p className={styles.status}>{t('app.missing', { list: prepared.missing.join(', ') })}</p>
          )}

          {compact ? (
            <>
              <CurrentConditions forecast={prepared} />

              <h2 className={styles.sectionTitle}>{t('overview.title')}</h2>
              <DailyOverview forecast={prepared} />

              <details
                className={styles.tableToggle}
                onToggle={(event) => setChartOpen(event.currentTarget.open)}
              >
                <summary>{t('app.detailChart')}</summary>
                {chartOpen && <Meteogram forecast={prepared} />}
              </details>
            </>
          ) : (
            <Meteogram forecast={prepared} />
          )}

          <details
            className={styles.tableToggle}
            onToggle={(event) => setTableOpen(event.currentTarget.open)}
          >
            <summary>{t('app.table')}</summary>
            {tableOpen && <ForecastTable forecast={prepared} />}
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

      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}

      <footer className={styles.footer}>
        <a className={styles.link} href="https://open-meteo.com/">
          {t('app.attribution')}
        </a>
      </footer>
    </div>
  );
}
