/**
 * Tests du fallback "degraded" sur getOverview et getInsightsRefreshStatus.
 *
 * Couvre :
 *   - getOverview retourne firstRun:true + KPIs zéro si les fetch DB throw
 *     (cas : tables insights_* absentes en DB, prepared statement stale,
 *     timeout réseau, etc.)
 *   - getInsightsRefreshStatus retourne lastRun:null + defaults si findLastRun
 *     throw (cas : insights_refresh_run absent)
 *
 * Pattern : on mock `@/lib/db/client` pour que `db()` retourne un objet
 * drizzle dont CHAQUE méthode throw synchroneusement. Le try/catch des
 * services doit absorber ces erreurs et retourner un état dégradé.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InsightsFilters } from './contracts';

const dbThrowsHandle = vi.hoisted(() => ({ shouldThrow: false }));

vi.mock('@/lib/db/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/db/client')>();
  return {
    ...actual,
    db: () => {
      if (!dbThrowsHandle.shouldThrow) return null;
      const error = Object.assign(
        new Error('relation "insights_event_daily" does not exist'),
        { code: '42P01' },
      );
      // Throw synchrone sur n'importe quel call drizzle → bubble dans le
      // `await` du service → catch via try/catch du fallback.
      const thrower = () => {
        throw error;
      };
      return {
        select: thrower,
        execute: thrower,
        insert: thrower,
        update: thrower,
        delete: thrower,
      } as unknown;
    },
  };
});

const filters7d: InsightsFilters = {
  window: '7d',
  env: 'all',
  device: 'all',
  locale: 'all',
  trafficSource: 'all',
};

beforeEach(() => {
  dbThrowsHandle.shouldThrow = false;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('getOverview — fallback degraded (T-fix-insights)', () => {
  it('retourne firstRun:true + KPIs à zéro quand les fetch DB throw', async () => {
    dbThrowsHandle.shouldThrow = true;
    const { getOverview } = await import('./services');
    const result = await getOverview(filters7d);
    expect(result.firstRun).toBe(true);
    expect(result.kpis.totalEvents).toBe(0);
    expect(result.kpis.uniqueSessions).toBe(0);
    expect(result.kpis.pageViews).toBe(0);
    expect(result.kpis.conversions).toBe(0);
    expect(result.timeseries).toEqual([]);
    expect(result.heatmap).toEqual([]);
    expect(result.topEvents).toEqual([]);
    expect(result.refreshedAt).toBeNull();
  });

  it("retourne firstRun:true en memory store vide (path nominal)", async () => {
    dbThrowsHandle.shouldThrow = false;
    const { getOverview } = await import('./services');
    const result = await getOverview(filters7d);
    expect(result.firstRun).toBe(true);
    expect(result.kpis.totalEvents).toBe(0);
  });
});

describe('getInsightsRefreshStatus — fallback degraded (T-fix-insights)', () => {
  it('retourne lastRun:null + defaults quand les fetch DB throw', async () => {
    dbThrowsHandle.shouldThrow = true;
    const { getInsightsRefreshStatus } = await import('./refresh');
    const status = await getInsightsRefreshStatus();
    expect(status.lastRun).toBeNull();
    expect(status.lockHeld).toBe(false);
    expect(typeof status.enabled).toBe('boolean');
    expect(typeof status.intervalMinutes).toBe('number');
  });

  it("retourne un status structuré en memory mode (path nominal)", async () => {
    dbThrowsHandle.shouldThrow = false;
    const { getInsightsRefreshStatus } = await import('./refresh');
    const status = await getInsightsRefreshStatus();
    expect(status).toHaveProperty('lastRun');
    expect(status).toHaveProperty('lockHeld');
    expect(status).toHaveProperty('enabled');
    expect(status).toHaveProperty('intervalMinutes');
  });
});
