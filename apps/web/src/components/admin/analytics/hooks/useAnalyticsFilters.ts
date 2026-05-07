/**
 * useAnalyticsFilters — hook unique pour lire/écrire les filtres analytics.
 * cf. docs/analytics/04-ui-design.md §3.1 et §6.2
 *
 * Source de vérité : URL params (lus via useSearchParams). Persistence
 * secondaire : localStorage (clé `fg_analytics_filters`, TTL 30 j).
 *
 * Ordre d'hydratation au mount :
 *   1. Si l'URL contient des params → utilisés tels quels (et persistés).
 *   2. Sinon, on hydrate depuis localStorage et on push dans l'URL.
 *   3. À défaut → DEFAULT_FILTERS.
 */
'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  type AnalyticsFilters,
  DEFAULT_FILTERS,
  filtersToSearchParams,
  parseFiltersFromSearchParams,
  readStoredFilters,
  writeStoredFilters,
} from '@/lib/analytics/filters';

interface UseAnalyticsFiltersResult {
  filters: AnalyticsFilters;
  setFilters: (next: AnalyticsFilters) => void;
  reset: () => void;
}

export function useAnalyticsFilters(): UseAnalyticsFiltersResult {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hydratedRef = useRef(false);

  const filters = useMemo(
    () => parseFiltersFromSearchParams(searchParams ?? new URLSearchParams()),
    [searchParams],
  );

  // Hydratation initiale depuis localStorage si l'URL est vide
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;
    const hasUrlParams =
      searchParams && Array.from(searchParams.keys()).some((k) =>
        ['period', 'device', 'traffic', 'from', 'to'].includes(k),
      );
    if (hasUrlParams) {
      writeStoredFilters(filters);
      return;
    }
    const stored = readStoredFilters();
    if (stored) {
      const params = filtersToSearchParams(stored);
      const qs = params.toString();
      if (qs) router.replace(`${pathname}?${qs}`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setFilters = useCallback(
    (next: AnalyticsFilters) => {
      const params = filtersToSearchParams(next);
      const qs = params.toString();
      writeStoredFilters(next);
      router.replace(qs ? `${pathname}?${qs}` : pathname ?? '/admin/analytics', {
        scroll: false,
      });
    },
    [router, pathname],
  );

  const reset = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, [setFilters]);

  return { filters, setFilters, reset };
}
