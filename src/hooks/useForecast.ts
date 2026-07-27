import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchForecast, type Forecast } from '../api/openMeteo';
import { fetchElevation } from '../api/geocoding';
import type { Location } from '../lib/location';

/**
 * Běh modelu se mění dvakrát denně, data proto stárnou pomalu. Deset minut
 * drží provoz hluboko pod fair-use limity Open-Meteo (docs §4) a zároveň
 * nenutí uživatele čekat při přepínání mezi lokalitami.
 */
const STALE_TIME = 10 * 60 * 1000;

export function useForecast(location: Location): UseQueryResult<Forecast, Error> {
  return useQuery({
    queryKey: ['forecast', location.latitude, location.longitude],
    queryFn: ({ signal }) => fetchForecast(location, signal),
    staleTime: STALE_TIME,
    retry: 1,
  });
}

/** Skutečná výška terénu; její výpadek nesmí shodit meteogram. */
export function useElevation(location: Location): UseQueryResult<number | null, Error> {
  return useQuery({
    queryKey: ['elevation', location.latitude, location.longitude],
    queryFn: ({ signal }) => fetchElevation(location.latitude, location.longitude, signal),
    staleTime: Infinity,
    retry: false,
  });
}
