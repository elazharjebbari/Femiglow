'use client';

/**
 * useUrlFilters — hook partagé pour porter filtres + pagination dans les
 * `searchParams` de l'URL (UX-TRANSVERSE-009).
 *
 * Aujourd'hui chaque liste gère son état d'URL différemment (Events en
 * `<Link href="?source=…">` server-side, le cockpit en `useSearchParams` +
 * `router.replace` côté client) et campaigns/automation/audiences/templates ne
 * portent RIEN dans l'URL → tri/filtre/page ni partageables ni bookmarkables.
 *
 * Ce hook fournit une convention unique pour les listes simples (clé→valeur) :
 *  - `filters` : objet courant lu depuis l'URL (fusionné sur les défauts) ;
 *  - `setFilter(key, value)` : met à jour UNE clé (valeur vide/falsy =
 *    suppression du param) et `router.replace` l'URL (sans recharger, sans
 *    scroll) ;
 *  - `setFilters(patch)` : met à jour plusieurs clés d'un coup ;
 *  - `resetFilters()` : revient aux défauts (URL nettoyée).
 *
 * Les valeurs sont des `string`. Les défauts sont retirés de l'URL pour garder
 * une URL minimale et partageable. `router.replace` (et non `push`) évite de
 * polluer l'historique à chaque frappe de filtre.
 */
import { useCallback, useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export type UrlFilterValues<K extends string> = Record<K, string>;

export interface UseUrlFiltersResult<K extends string> {
  filters: UrlFilterValues<K>;
  setFilter: (key: K, value: string) => void;
  setFilters: (patch: Partial<UrlFilterValues<K>>) => void;
  resetFilters: () => void;
  /** searchParams bruts (lecture seule) pour les cas hors `defaults`. */
  raw: URLSearchParams;
}

export function useUrlFilters<K extends string>(
  defaults: UrlFilterValues<K>,
): UseUrlFiltersResult<K> {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const keys = useMemo(() => Object.keys(defaults) as K[], [defaults]);

  const filters = useMemo(() => {
    const out = { ...defaults };
    for (const key of keys) {
      const v = searchParams.get(key);
      if (v !== null) out[key] = v;
    }
    return out;
  }, [defaults, keys, searchParams]);

  const writeParams = useCallback(
    (patch: Partial<UrlFilterValues<K>>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [k, value] of Object.entries(patch) as Array<[K, string]>) {
        const isDefault = value === defaults[k];
        // Retire le param s'il est vide OU égal au défaut → URL minimale.
        if (value === '' || value == null || isDefault) {
          next.delete(k);
        } else {
          next.set(k, value);
        }
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [defaults, pathname, router, searchParams],
  );

  const setFilter = useCallback(
    (key: K, value: string) => writeParams({ [key]: value } as Partial<UrlFilterValues<K>>),
    [writeParams],
  );

  const setFilters = useCallback(
    (patch: Partial<UrlFilterValues<K>>) => writeParams(patch),
    [writeParams],
  );

  const resetFilters = useCallback(() => {
    const cleared = {} as Partial<UrlFilterValues<K>>;
    for (const key of keys) cleared[key] = defaults[key];
    writeParams(cleared);
  }, [defaults, keys, writeParams]);

  return {
    filters,
    setFilter,
    setFilters,
    resetFilters,
    raw: searchParams as unknown as URLSearchParams,
  };
}
