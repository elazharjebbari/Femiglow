'use client';

/**
 * Progress estimator for AI generation calls (variants + visuals).
 *
 * The actual generation duration is unpredictable per-call (10-60s typical).
 * Rather than guessing or showing an indefinite spinner, we keep a rolling
 * history of the last 20 measured durations in `localStorage` and use the
 * p50 (median) to drive a progress bar that should land close to 100% at
 * the expected end. Past p95 we shift to a "longer than usual" message;
 * past 2×p95 we surface a stronger warning.
 *
 * Storage key prefix `cs-v2:gen-history:` allows separate buckets per
 * operation type ("variants", "visual", …).
 *
 * Cf. plan-content-studio-v2-2026-05-22.md §Phase 3 §3.6.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_PREFIX = 'cs-v2:gen-history:';
const HISTORY_MAX = 20;
const DEFAULT_FALLBACK_MS = 12_000;
const TICK_MS = 200;

export type EstimatorStage = 'idle' | 'running' | 'longer' | 'stuck';

export interface EstimatorAPI {
  /** Stage of the running estimator (or 'idle' when not started). */
  stage: EstimatorStage;
  /** Smoothed progress percent (0-100). Cap is 95 while the call is in flight. */
  progressPct: number;
  /** Elapsed time in ms since `start()`. */
  elapsedMs: number;
  /** Whether the timer is currently running. */
  isRunning: boolean;
  /** Begin a new measurement. */
  start: () => void;
  /** Stop, record the duration in history, and reset to 'idle'. */
  stop: () => void;
  /** Reset without recording (e.g. on error). */
  cancel: () => void;
  /** p50 of the rolling history in ms (or fallback when history is empty). */
  p50Ms: number;
  /** p95 of the rolling history in ms (or fallback when history is empty). */
  p95Ms: number;
  /** Raw rolling history (most recent last). */
  history: number[];
}

interface UseGenerationEstimatorOptions {
  /** Bucket key — separates histories between operation types. */
  bucket: string;
  /** Fallback p50 to use when no history is available. */
  fallbackMs?: number;
  /** Cap on the progress percent while still running. */
  capPct?: number;
  /** Optional storage shim — defaults to `window.localStorage`. */
  storage?: Pick<Storage, 'getItem' | 'setItem'> | null;
}

export function useGenerationEstimator({
  bucket,
  fallbackMs = DEFAULT_FALLBACK_MS,
  capPct = 95,
  storage,
}: UseGenerationEstimatorOptions): EstimatorAPI {
  const [history, setHistory] = useState<number[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const startedAtRef = useRef<number | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Resolve storage lazily to stay SSR-safe.
  const resolvedStorage = useMemo<Pick<Storage, 'getItem' | 'setItem'> | null>(() => {
    if (storage !== undefined) return storage;
    if (typeof window === 'undefined') return null;
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }, [storage]);

  // Hydrate history from storage on mount.
  useEffect(() => {
    if (!resolvedStorage) return;
    try {
      const raw = resolvedStorage.getItem(`${STORAGE_PREFIX}${bucket}`);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const valid = parsed.filter((n): n is number => typeof n === 'number' && n > 0 && Number.isFinite(n));
        setHistory(valid.slice(-HISTORY_MAX));
      }
    } catch {
      /* corrupted storage — ignore */
    }
  }, [bucket, resolvedStorage]);

  const stats = useMemo(() => {
    if (history.length === 0) {
      return { p50: fallbackMs, p95: fallbackMs * 1.5 };
    }
    const sorted = [...history].sort((a, b) => a - b);
    return { p50: percentile(sorted, 0.5), p95: percentile(sorted, 0.95) };
  }, [history, fallbackMs]);

  const stage = useMemo<EstimatorStage>(() => {
    if (!isRunning) return 'idle';
    if (elapsedMs > stats.p95 * 2) return 'stuck';
    if (elapsedMs > stats.p95) return 'longer';
    return 'running';
  }, [isRunning, elapsedMs, stats.p95]);

  const progressPct = useMemo(() => {
    if (!isRunning) return 0;
    const ratio = stats.p50 > 0 ? elapsedMs / stats.p50 : 0;
    // Asymptotic curve: 1 - exp(-x), so it slows near the expected end.
    const eased = 1 - Math.exp(-ratio * 1.6);
    return Math.min(capPct, Math.round(eased * 100));
  }, [isRunning, elapsedMs, stats.p50, capPct]);

  const start = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setIsRunning(true);
    tickRef.current = setInterval(() => {
      if (startedAtRef.current !== null) {
        setElapsedMs(Date.now() - startedAtRef.current);
      }
    }, TICK_MS);
  }, []);

  const stopTicker = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    stopTicker();
    if (startedAtRef.current === null) {
      setIsRunning(false);
      return;
    }
    const duration = Date.now() - startedAtRef.current;
    startedAtRef.current = null;
    setIsRunning(false);
    setHistory((prev) => {
      const next = [...prev, duration].slice(-HISTORY_MAX);
      if (resolvedStorage) {
        try {
          resolvedStorage.setItem(`${STORAGE_PREFIX}${bucket}`, JSON.stringify(next));
        } catch {
          /* quota / private mode — skip */
        }
      }
      return next;
    });
  }, [bucket, resolvedStorage, stopTicker]);

  const cancel = useCallback(() => {
    stopTicker();
    startedAtRef.current = null;
    setIsRunning(false);
    setElapsedMs(0);
  }, [stopTicker]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  return {
    stage,
    progressPct,
    elapsedMs,
    isRunning,
    start,
    stop,
    cancel,
    p50Ms: stats.p50,
    p95Ms: stats.p95,
    history,
  };
}

function percentile(sortedAsc: number[], q: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0] ?? 0;
  const idx = (sortedAsc.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo] ?? 0;
  const loVal = sortedAsc[lo] ?? 0;
  const hiVal = sortedAsc[hi] ?? 0;
  return loVal + (hiVal - loVal) * (idx - lo);
}

// Exports for unit testing the pure stats logic without React.
export const __test = {
  STORAGE_PREFIX,
  HISTORY_MAX,
  DEFAULT_FALLBACK_MS,
  percentile,
};
