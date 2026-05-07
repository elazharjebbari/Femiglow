/**
 * Helpers pour rafraîchir les vues matérialisées analytics.
 * cf. docs/analytics/02-data-model.md §3 et docs/analytics/07-runbook-roadmap.md §4.2
 *
 * On utilise CONCURRENTLY pour ne pas bloquer les SELECTs en cours.
 * En cas d'échec CONCURRENTLY (1ʳᵉ exécution sans données), on tombe en
 * REFRESH non-CONCURRENTLY de manière idempotente.
 */
import { sql } from 'drizzle-orm';

import { db } from '@/lib/db/client';
import { logger } from '@/lib/logging/logger';

export const ANALYTICS_MATVIEWS = [
  'mv_overview_hourly',
  'mv_funnel_daily',
  'mv_cta_performance',
  'mv_checkout_steps',
] as const;

export type AnalyticsMatview = (typeof ANALYTICS_MATVIEWS)[number];

export interface RefreshResult {
  view: AnalyticsMatview;
  durationMs: number;
  ok: boolean;
  error?: string;
  concurrent: boolean;
}

/**
 * Rafraîchit une vue, en tentant CONCURRENTLY puis fallback non-concurrent.
 * Retourne un résultat structuré (jamais throw, pour permettre le batch).
 */
export async function refreshMatview(view: AnalyticsMatview): Promise<RefreshResult> {
  const handle = db();
  if (!handle) {
    return {
      view,
      durationMs: 0,
      ok: false,
      concurrent: false,
      error: 'DATABASE_URL absent — refresh ignoré',
    };
  }
  const startedAt = Date.now();
  try {
    // Tentative CONCURRENTLY (ne bloque pas les lecteurs).
    await handle.execute(sql.raw(`REFRESH MATERIALIZED VIEW CONCURRENTLY "${view}"`));
    return { view, durationMs: Date.now() - startedAt, ok: true, concurrent: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Fallback : la vue n'a jamais été peuplée → CONCURRENTLY échoue.
    try {
      await handle.execute(sql.raw(`REFRESH MATERIALIZED VIEW "${view}"`));
      return {
        view,
        durationMs: Date.now() - startedAt,
        ok: true,
        concurrent: false,
        error: `fallback (concurrent failed: ${msg})`,
      };
    } catch (err2) {
      return {
        view,
        durationMs: Date.now() - startedAt,
        ok: false,
        concurrent: false,
        error: err2 instanceof Error ? err2.message : String(err2),
      };
    }
  }
}

/**
 * Rafraîchit toutes les vues analytics. Continue malgré les échecs.
 */
export async function refreshAllMatviews(): Promise<RefreshResult[]> {
  const results: RefreshResult[] = [];
  for (const view of ANALYTICS_MATVIEWS) {
    const r = await refreshMatview(view);
    results.push(r);
    if (r.ok) {
      logger.info('analytics.matview.refreshed', {
        view: r.view,
        duration_ms: r.durationMs,
        concurrent: r.concurrent,
      });
    } else {
      logger.error('analytics.matview.refresh_failed', {
        view: r.view,
        duration_ms: r.durationMs,
        error: r.error,
      });
    }
  }
  return results;
}
