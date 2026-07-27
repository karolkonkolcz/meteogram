import { useEffect, useState } from 'react';

/**
 * Schopnosti zařízení se čtou dotazem, ne z `user-agent` (docs §3.6).
 * Notebook s dotykovým displejem tak dostane obojí a nic se nehádá.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const onChange = (event: MediaQueryListEvent) => setMatches(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export const useCoarsePointer = () => useMediaQuery('(pointer: coarse)');
export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)');
