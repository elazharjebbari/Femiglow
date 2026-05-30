/**
 * F-PERF-04 — cache court opt-in des queries analytics.
 * cf. docs/analytics-audit-qa-2026-05-30/00-audit/findings-register.csv
 */
import { afterEach, describe, expect, it } from 'vitest';

import { __clearAnalyticsCache, getCachedAnalytics, setCachedAnalytics } from './cache';

afterEach(() => {
  delete process.env.ANALYTICS_CACHE_TTL_MS;
  __clearAnalyticsCache();
});

describe('analytics cache (F-PERF-04)', () => {
  it('désactivé par défaut : ne mémorise rien (fraîcheur temps réel préservée)', () => {
    setCachedAnalytics('k', { v: 1 }, 1000);
    expect(getCachedAnalytics('k', 1000)).toBeNull();
  });

  it('activé : sert la valeur dans la TTL, expire au-delà', () => {
    process.env.ANALYTICS_CACHE_TTL_MS = '30000';
    setCachedAnalytics('k', { v: 1 }, 1000);
    expect(getCachedAnalytics<{ v: number }>('k', 1000 + 10_000)).toEqual({ v: 1 });
    expect(getCachedAnalytics('k', 1000 + 40_000)).toBeNull();
  });

  it('clés distinctes ne collisionnent pas', () => {
    process.env.ANALYTICS_CACHE_TTL_MS = '30000';
    setCachedAnalytics('a', 1, 0);
    setCachedAnalytics('b', 2, 0);
    expect(getCachedAnalytics('a', 0)).toBe(1);
    expect(getCachedAnalytics('b', 0)).toBe(2);
  });

  it('valeur TTL invalide ou ≤ 0 → désactivé', () => {
    process.env.ANALYTICS_CACHE_TTL_MS = 'abc';
    setCachedAnalytics('k', 1, 0);
    expect(getCachedAnalytics('k', 0)).toBeNull();
  });
});
