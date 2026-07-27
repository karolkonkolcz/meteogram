import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchLocations, type GeocodingResult } from '../api/geocoding';
import { useDebounced } from '../hooks/useDebounced';
import { formatCoordinates, type Location } from '../lib/location';
import { useSettings } from '../settings/SettingsContext';
import styles from './LocationSearch.module.css';

function describe(location: Location): string {
  return [location.admin, location.country].filter(Boolean).join(', ');
}

export function LocationSearch({
  recent,
  onSelect,
  onClose,
}: {
  recent: readonly Location[];
  onSelect: (location: Location) => void;
  onClose: () => void;
}) {
  const { settings, t } = useSettings();
  const [query, setQuery] = useState('');
  const [geolocationError, setGeolocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const debouncedQuery = useDebounced(query);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const results = useQuery({
    queryKey: ['geocoding', debouncedQuery, settings.locale],
    queryFn: ({ signal }) => searchLocations(debouncedQuery, settings.locale, signal),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  // Poloha se zjišťuje jen na vyžádání, nikdy automaticky při otevření.
  const locate = () => {
    if (!navigator.geolocation) {
      setGeolocationError(t('search.noGeolocation'));
      return;
    }
    setLocating(true);
    setGeolocationError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        onSelect({
          name: formatCoordinates(position.coords.latitude, position.coords.longitude),
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      () => {
        setLocating(false);
        setGeolocationError(t('search.geolocationFailed'));
      },
      { timeout: 10_000 },
    );
  };

  const shown: GeocodingResult[] = results.data ?? [];
  const showRecent = debouncedQuery.trim().length < 2 && recent.length > 0;

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClose={onClose} aria-label={t('search.title')}>
      <div className={styles.header}>
        <input
          className={styles.input}
          type="search"
          value={query}
          autoFocus
          placeholder={t('search.placeholder')}
          aria-label={t('search.label')}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="button" className={styles.close} onClick={() => dialogRef.current?.close()}>
          {t('search.close')}
        </button>
      </div>

      <button type="button" className={styles.locate} onClick={locate} disabled={locating}>
        {t(locating ? 'search.locating' : 'search.locate')}
      </button>
      {geolocationError && <p className={styles.error}>{geolocationError}</p>}

      {results.isError && <p className={styles.error}>{t('search.failed')}</p>}
      {results.isFetching && <p className={styles.hint}>{t('search.searching')}</p>}
      {!results.isFetching && debouncedQuery.trim().length >= 2 && shown.length === 0 && (
        <p className={styles.hint}>{t('search.empty')}</p>
      )}

      {showRecent && <p className={styles.hint}>{t('search.recent')}</p>}
      <ul className={styles.results}>
        {(showRecent ? recent : shown).map((location) => (
          <li key={`${location.latitude},${location.longitude}`}>
            <button
              type="button"
              className={styles.result}
              onClick={() => onSelect(location)}
            >
              <span className={styles.name}>{location.name}</span>
              <span className={styles.meta}>
                {describe(location) ||
                  formatCoordinates(location.latitude, location.longitude)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </dialog>
  );
}
