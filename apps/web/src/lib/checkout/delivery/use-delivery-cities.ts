'use client';

/**
 * CHA-230 — Hook de fetch villes pour l'autocomplete.
 *
 * Stratégie
 * ─────────
 *  - Debounce 200ms côté client pour ne pas spammer le serveur en frappe.
 *  - Cache mémoire keyé par `${countryCode}|${q.toLowerCase()}` :
 *    persistant à la durée de vie du module (re-mount du composant
 *    n'invalide pas le cache). Couplé au cache HTTP `s-maxage=300` côté
 *    Vercel/Next, on tend asymptotiquement vers du gratuit.
 *  - AbortController par requête : si la frappe progresse, on annule la
 *    précédente — pas de race condition d'ordre de réponse.
 *  - Tolérance erreur : sur erreur réseau ou non-200, on retourne le
 *    cache stale précédent + un flag `error` pour la bannière. Jamais
 *    de crash.
 *
 * Feature flag — rollback safety
 * ──────────────────────────────
 *  Si `NEXT_PUBLIC_USE_DB_CITIES === 'false'` (case insensitive), le hook
 *  bascule sur le dataset statique `MOROCCAN_CITIES` (~30 villes) et résout
 *  les recherches localement via `searchCities()`. Ce chemin est volontaire :
 *  en cas d'incident DB (catalogue corrompu, perf, schéma cassé), un kill-
 *  switch dans Vercel suffit pour restaurer le comportement pré-CHA-230.
 *  La valeur par défaut est `true` (DB activée) — c'est le mode normal.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  searchCities as searchStaticCities,
  type MoroccanCity,
} from '@/lib/checkout/data/moroccan-cities';

export interface PublicCity {
  slug: string;
  nameFr: string;
  nameAr: string | null;
  deliveryPriceMad: number;
  deliveryEta: string;
  aliases: string[];
}

interface FetchState {
  query: string;
  items: PublicCity[];
  loading: boolean;
  error: string | null;
}

const INITIAL: FetchState = {
  query: '',
  items: [],
  loading: false,
  error: null,
};

interface UseDeliveryCitiesOptions {
  countryCode?: string;
  /** Taille max des résultats. */
  limit?: number;
  /** Délai debounce en ms. Défaut 200. Passer 0 pour désactiver. */
  debounceMs?: number;
}

// Cache mémoire — partagé entre les instances. Clé `cc|qLower|limit`.
const memoCache = new Map<string, PublicCity[]>();

/**
 * Lit la flag `NEXT_PUBLIC_USE_DB_CITIES`. Défaut = `true` (DB activée).
 * Accepte les chaînes "false", "0", "off", "no" comme désactivation —
 * tolérance à la diversité des configs CI/preview.
 *
 * Exporté pour les tests + pour l'admin/dev visualisation, pas pour
 * usage applicatif (le hook l'évalue lui-même).
 */
export function isDbCitiesEnabled(): boolean {
  const raw = (process.env.NEXT_PUBLIC_USE_DB_CITIES ?? '').trim().toLowerCase();
  if (!raw) return true;
  return !['false', '0', 'off', 'no'].includes(raw);
}

/**
 * Convertit une MoroccanCity statique en PublicCity (forme renvoyée par
 * `/api/delivery-cities/search`). Le prix et l'ETA ne sont pas portés par
 * MOROCCAN_CITIES — on fixe des valeurs par défaut conservatrices (0 MAD,
 * "24-48h"), ce qui matche la copy générique du bloc shipping notice.
 */
function staticCityToPublic(c: MoroccanCity): PublicCity {
  return {
    slug: c.value,
    nameFr: c.label,
    nameAr: c.labelAr,
    deliveryPriceMad: 0,
    deliveryEta: '24-48h',
    aliases: c.aliases ?? [],
  };
}

function searchStaticAsPublic(query: string, limit: number): PublicCity[] {
  // searchCities trie par priorité si query vide, puis filtre par préfixe.
  return searchStaticCities(query, limit).map(staticCityToPublic);
}

export function useDeliveryCities(
  query: string,
  opts: UseDeliveryCitiesOptions = {},
): FetchState {
  const { countryCode = 'MA', limit = 8, debounceMs = 200 } = opts;
  const [state, setState] = useState<FetchState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  const useDb = isDbCitiesEnabled();

  const fetchCities = useCallback(
    async (q: string) => {
      // ── Kill-switch : si le flag DB est off, on ne fait pas de fetch
      // et on résout localement contre le dataset statique.
      if (!useDb) {
        const items = searchStaticAsPublic(q, limit);
        setState({ query: q, items, loading: false, error: null });
        return;
      }

      const cacheKey = `${countryCode}|${q.toLowerCase()}|${limit}`;
      const cached = memoCache.get(cacheKey);
      if (cached) {
        setState({ query: q, items: cached, loading: false, error: null });
        return;
      }

      // Annule la requête précédente en cours, le cas échéant.
      if (abortRef.current) abortRef.current.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setState((s) => ({ ...s, query: q, loading: true, error: null }));
      try {
        const params = new URLSearchParams({
          q,
          limit: String(limit),
          countryCode,
        });
        const res = await fetch(
          `/api/delivery-cities/search?${params.toString()}`,
          { signal: ctrl.signal, headers: { accept: 'application/json' } },
        );
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const body = (await res.json()) as { items?: PublicCity[] };
        const items = Array.isArray(body.items) ? body.items : [];
        memoCache.set(cacheKey, items);
        // Si on a été abort entretemps, ne pas écraser un état plus récent.
        if (!ctrl.signal.aborted) {
          setState({ query: q, items, loading: false, error: null });
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        setState((s) => ({
          ...s,
          loading: false,
          error: (err as Error).message ?? 'fetch_failed',
        }));
      }
    },
    [countryCode, limit, useDb],
  );

  useEffect(() => {
    if (debounceMs <= 0) {
      fetchCities(query);
      return;
    }
    const handle = setTimeout(() => fetchCities(query), debounceMs);
    return () => clearTimeout(handle);
  }, [query, debounceMs, fetchCities]);

  // Annule la requête en vol au démontage.
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return state;
}

/** Utilitaire test : vide le cache mémoire. */
export function __resetDeliveryCitiesCacheForTests(): void {
  memoCache.clear();
}
