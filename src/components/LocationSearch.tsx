import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchLocations, type GeocodingResult } from '../api/geocoding';
import { useDebounced } from '../hooks/useDebounced';
import { formatCoordinates, type Location } from '../lib/location';
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
  const [query, setQuery] = useState('');
  const [geolocationError, setGeolocationError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const debouncedQuery = useDebounced(query);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  const results = useQuery({
    queryKey: ['geocoding', debouncedQuery],
    queryFn: ({ signal }) => searchLocations(debouncedQuery, 'sk', signal),
    enabled: debouncedQuery.trim().length >= 2,
    staleTime: 5 * 60 * 1000,
  });

  // Poloha se zjišťuje jen na vyžádání, nikdy automaticky při otevření.
  const locate = () => {
    if (!navigator.geolocation) {
      setGeolocationError('Prehliadač polohu neposkytuje.');
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
        setGeolocationError('Polohu sa nepodarilo zistiť.');
      },
      { timeout: 10_000 },
    );
  };

  const shown: GeocodingResult[] = results.data ?? [];
  const showRecent = debouncedQuery.trim().length < 2 && recent.length > 0;

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClose={onClose} aria-label="Výber lokality">
      <div className={styles.header}>
        <input
          className={styles.input}
          type="search"
          value={query}
          autoFocus
          placeholder="Hľadať obec alebo mesto"
          aria-label="Hľadať lokalitu"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="button" className={styles.close} onClick={() => dialogRef.current?.close()}>
          Zavrieť
        </button>
      </div>

      <button type="button" className={styles.locate} onClick={locate} disabled={locating}>
        {locating ? 'Zisťujem polohu…' : 'Moja poloha'}
      </button>
      {geolocationError && <p className={styles.error}>{geolocationError}</p>}

      {results.isError && <p className={styles.error}>Vyhľadávanie zlyhalo. Skúste to znova.</p>}
      {results.isFetching && <p className={styles.hint}>Hľadám…</p>}
      {!results.isFetching && debouncedQuery.trim().length >= 2 && shown.length === 0 && (
        <p className={styles.hint}>Nič sa nenašlo.</p>
      )}

      {showRecent && <p className={styles.hint}>Naposledy zobrazené</p>}
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
