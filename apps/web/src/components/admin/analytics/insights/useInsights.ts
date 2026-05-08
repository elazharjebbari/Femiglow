/**
 * Hooks Insights : URL ↔ filters + fetch générique.
 */
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_INSIGHTS_FILTERS,
  insightsFiltersSchema,
  type InsightsFilters,
} from '@/lib/analytics/insights/contracts';

const FILTER_KEYS = ['window', 'customFrom', 'customTo', 'env', 'device', 'locale', 'trafficSource'] as const;

export function useInsightsFilters(): {
  filters: InsightsFilters;
  set: (patch: Partial<InsightsFilters>) => void;
  reset: () => void;
} {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = useMemo<InsightsFilters>(() => {
    const raw: Record<string, string> = {};
    for (const k of FILTER_KEYS) {
      const v = searchParams?.get(k);
      if (v) raw[k] = v;
    }
    const parsed = insightsFiltersSchema.safeParse(raw);
    if (parsed.success) {
      return { ...DEFAULT_INSIGHTS_FILTERS, ...parsed.data };
    }
    return DEFAULT_INSIGHTS_FILTERS;
  }, [searchParams]);

  const set = useCallback(
    (patch: Partial<InsightsFilters>) => {
      const next = new URLSearchParams(searchParams?.toString() ?? '');
      for (const [k, v] of Object.entries(patch)) {
        if (v == null || v === 'all' || v === '') next.delete(k);
        else next.set(k, String(v));
      }
      // Quand on quitte le mode custom, on nettoie les bornes orphelines.
      if (patch.window !== undefined && patch.window !== 'custom') {
        next.delete('customFrom');
        next.delete('customTo');
      }
      const qs = next.toString();
      router.replace(qs ? `?${qs}` : '?', { scroll: false });
    },
    [searchParams, router],
  );

  const reset = useCallback(() => {
    router.replace('?', { scroll: false });
  }, [router]);

  return { filters, set, reset };
}

interface FetchState<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useInsightsFetch<T>(url: string | null): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as T;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, error, loading, refresh };
}

export function serializeFilters(filters: InsightsFilters): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v != null && v !== 'all' && v !== '') out.set(k, String(v));
  }
  return out.toString();
}
