import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_LOCATION,
  addRecent,
  isSameLocation,
  locationToParams,
  parseLocationFromParams,
  readRecent,
  storeRecent,
  type Location,
} from '../lib/location';

function initialLocation(): Location {
  const fromUrl = parseLocationFromParams(new URLSearchParams(window.location.search));
  if (fromUrl) return fromUrl;
  return readRecent()[0] ?? DEFAULT_LOCATION;
}

/**
 * Lokalita žije v URL, aby šel odkaz sdílet a fungovalo tlačítko zpět.
 * `pushState` je proto záměr, ne detail – historie je součástí ovládání.
 */
export function useLocationState(): {
  location: Location;
  recent: Location[];
  setLocation: (next: Location) => void;
  renameCurrent: (name: string) => void;
} {
  const [location, setLocationState] = useState<Location>(initialLocation);
  const [recent, setRecent] = useState<Location[]>(readRecent);

  useEffect(() => {
    const onPopState = () => {
      const fromUrl = parseLocationFromParams(new URLSearchParams(window.location.search));
      if (fromUrl) setLocationState(fromUrl);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const setLocation = useCallback((next: Location) => {
    setLocationState(next);
    setRecent((current) => {
      const updated = addRecent(current, next);
      storeRecent(updated);
      return updated;
    });
    window.history.pushState({}, '', `?${locationToParams(next).toString()}`);
  }, []);

  /**
   * Doplnění jména k téže lokalitě. Nahrazuje záznam v historii, ne
   * přidává – tlačítko zpět nemá vracet k bezejmenné variantě téhož místa.
   */
  const renameCurrent = useCallback((name: string) => {
    setLocationState((current) => {
      if (current.name === name) return current;
      const renamed = { ...current, name };
      setRecent((list) => {
        const updated = list.map((item) =>
          isSameLocation(item, renamed) ? { ...item, name } : item,
        );
        storeRecent(updated);
        return updated;
      });
      window.history.replaceState({}, '', `?${locationToParams(renamed).toString()}`);
      return renamed;
    });
  }, []);

  return { location, recent, setLocation, renameCurrent };
}
