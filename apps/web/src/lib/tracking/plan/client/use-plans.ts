/**
 * Hooks React minimalistes pour les Tracking Plans.
 *
 * Pas de TanStack Query (pas installé dans le repo) : on utilise `useState`+`useEffect`
 * avec dépendances explicites, et on expose un `mutate()` qui re-fetch.
 *
 * Suffisant pour les vues admin (faible concurrence). Si on installe TanStack Query
 * plus tard, on substitue ces hooks sans toucher aux composants.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { trackingPlanApi, ApiError } from './api-client';
import type { TrackingPlan } from '../types';

type AsyncState<T> = {
  data: T | undefined;
  error: ApiError | Error | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<ApiError | Error | null>(null);
  const [isLoading, setLoading] = useState(true);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await load();
      if (mounted.current) setData(result);
    } catch (e) {
      if (mounted.current) setError(e as ApiError);
    } finally {
      if (mounted.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  return { data, error, isLoading, refresh };
}

export function usePlans(filter: { status?: string; search?: string } = {}) {
  return useAsync(
    () => trackingPlanApi.list(filter),
    [filter.status, filter.search],
  );
}

export function usePlan(id: string | undefined) {
  return useAsync(
    () => (id ? trackingPlanApi.get(id) : Promise.resolve(undefined as unknown as TrackingPlan)),
    [id],
  );
}

export function useDefaults() {
  return useAsync(() => trackingPlanApi.defaults(), []);
}

export function useAuditLog(planId?: string) {
  return useAsync(() => trackingPlanApi.audit(planId), [planId]);
}
