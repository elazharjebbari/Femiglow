'use client';

/**
 * Freshness — fraîcheur des données + auto-refresh honnête (SOC-F04 / TRV-05,
 * DASH-08).
 *
 * Affiche : âge relatif (« il y a 38 s ») + heure absolue avec TIMEZONE
 * VISIBLE + bouton Rafraîchir. Comportements (spec F01) :
 *   - tick interne 1 s : l'âge court en continu (calculé depuis generatedAt —
 *     il ne se réinitialise JAMAIS sans vrai refresh : honnêteté après veille) ;
 *   - autoRefresh : onRefresh toutes les intervalMs, SUSPENDU onglet caché
 *     (document.hidden) ; au retour visible → un onRefresh immédiat, une fois ;
 *   - bouton : « Rafraîchissement… » + disabled pendant un onRefresh async
 *     (anti double-clic).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_TIMEZONE,
  formatAbsolute,
  formatAge,
  timeZoneLabel,
} from './format-datetime';

export type FreshnessProps = {
  /** ISO de la dernière génération des données affichées. */
  generatedAt: string;
  timeZone?: string;
  autoRefresh?: {
    intervalMs?: number;
    onRefresh: () => void | Promise<void>;
  };
};

const DEFAULT_INTERVAL_MS = 60_000;

export function Freshness({ generatedAt, timeZone = DEFAULT_TIMEZONE, autoRefresh }: FreshnessProps) {
  // Tick 1 s pour faire courir l'âge affiché.
  const [, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1_000);
    return () => clearInterval(t);
  }, []);

  const doRefresh = useCallback(async () => {
    if (refreshingRef.current || !autoRefresh) return;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await autoRefresh.onRefresh();
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [autoRefresh]);

  // Auto-refresh périodique, suspendu onglet caché ; reprise + refresh
  // immédiat (une fois) au retour visible.
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      if (!document.hidden) void doRefresh();
    }, autoRefresh.intervalMs ?? DEFAULT_INTERVAL_MS);
    const onVisibility = () => {
      if (!document.hidden) void doRefresh();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [autoRefresh, doRefresh]);

  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2 text-xs text-stone-500">
      <span>
        {formatAge(generatedAt)} ·{' '}
        <time dateTime={generatedAt}>
          {formatAbsolute(generatedAt, timeZone)} ({timeZoneLabel(timeZone)})
        </time>
      </span>
      {autoRefresh ? (
        <button
          type="button"
          onClick={() => void doRefresh()}
          disabled={refreshing}
          aria-busy={refreshing || undefined}
          className="rounded border border-stone-300 bg-white px-2 py-0.5 font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-60"
        >
          {refreshing ? 'Rafraîchissement…' : '↻ Rafraîchir'}
        </button>
      ) : null}
    </div>
  );
}
