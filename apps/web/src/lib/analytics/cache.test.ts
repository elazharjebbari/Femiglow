/**
 * F-PERF-04 + snapshot des longues fenêtres (approche validée 2026-05-30).
 * cf. docs/analytics-audit-qa-2026-05-30/00-audit/findings-register.csv
 */
import { afterEach, describe, expect, it } from 'vitest';

import {
  __clearAnalyticsCache,
  analyticsCacheTtlMs,
  getCachedAnalytics,
  setCachedAnalytics,
} from './cache';

afterEach(() => {
  delete process.env.ANALYTICS_CACHE_TTL_MS;
  delete process.env.ANALYTICS_LONG_WINDOW_CACHE_TTL_MS;
  __clearAnalyticsCache();
});

describe('analytics cache — store', () => {
  it('TTL ≤ 0 → désactivé (ne mémorise rien)', () => {
    setCachedAnalytics('k', { v: 1 }, 0, 1000);
    expect(getCachedAnalytics('k', 0, 1000)).toBeNull();
  });

  it('TTL > 0 → sert dans la fenêtre, expire au-delà', () => {
    setCachedAnalytics('k', { v: 1 }, 30_000, 1000);
    expect(getCachedAnalytics<{ v: number }>('k', 30_000, 11_000)).toEqual({ v: 1 });
    expect(getCachedAnalytics('k', 30_000, 41_000)).toBeNull();
  });

  it('clés distinctes ne collisionnent pas', () => {
    setCachedAnalytics('a', 1, 30_000, 0);
    setCachedAnalytics('b', 2, 30_000, 0);
    expect(getCachedAnalytics('a', 30_000, 0)).toBe(1);
    expect(getCachedAnalytics('b', 30_000, 0)).toBe(2);
  });
});

describe('analyticsCacheTtlMs — stratégie par fenêtre', () => {
  const day = 86_400_000;

  it('courte fenêtre (7 j) → 0 par défaut (temps réel)', () => {
    expect(analyticsCacheTtlMs({ from: new Date(0), to: new Date(7 * day) })).toBe(0);
  });

  it('courte fenêtre + ANALYTICS_CACHE_TTL_MS → activée', () => {
    process.env.ANALYTICS_CACHE_TTL_MS = '20000';
    expect(analyticsCacheTtlMs({ from: new Date(0), to: new Date(7 * day) })).toBe(20_000);
  });

  it('longue fenêtre (≥ 30 j) → snapshot par défaut (5 min)', () => {
    expect(analyticsCacheTtlMs({ from: new Date(0), to: new Date(30 * day) })).toBe(300_000);
  });

  it('longue fenêtre + override ANALYTICS_LONG_WINDOW_CACHE_TTL_MS', () => {
    process.env.ANALYTICS_LONG_WINDOW_CACHE_TTL_MS = '600000';
    expect(analyticsCacheTtlMs({ from: new Date(0), to: new Date(90 * day) })).toBe(600_000);
  });
});
