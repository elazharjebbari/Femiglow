/**
 * useAnalyticsSSE — connexion SSE au snapshot live + fallback polling.
 * cf. docs/analytics/05-onglets-specs.md §2.2 + §2.6
 *
 * Stratégie de robustesse :
 *  1. Tente SSE sur `/api/admin/analytics/live/stream?window=...`.
 *  2. Reconnect exponentiel sur erreur (1s, 2s, 4s, 8s, max 16s).
 *  3. Si 3 disconnects en 30 s OU si l'endpoint répond ≥ 500 → bascule en
 *     polling sur `/api/admin/analytics/live`.
 *  4. Page Visibility : quand l'onglet passe en background, on ferme
 *     temporairement la connexion (les browsers gel les setIntervals de
 *     toute façon) et on relance au focus.
 *
 * Pause/Resume : exposés pour permettre à l'admin de figer l'écran.
 */
'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { LiveSnapshot, LiveWindow } from '@/lib/analytics/queries/live';

export type AnalyticsSSEStatus =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'polling'
  | 'paused'
  | 'error';

interface UseAnalyticsSSEOptions {
  window?: LiveWindow;
  /** Désactive complètement la connexion (utile pour SSR / tests). */
  enabled?: boolean;
  /** Polling interval ms quand on est en fallback (default 5000). */
  pollIntervalMs?: number;
  /** Force le mode polling immédiatement (sans tenter SSE) — utile pour tests. */
  forcePolling?: boolean;
}

interface UseAnalyticsSSEResult {
  data: LiveSnapshot | null;
  status: AnalyticsSSEStatus;
  /** Erreur la plus récente, effacée au prochain succès. */
  error: string | null;
  /** Pause/resume contrôlée par l'admin. */
  paused: boolean;
  pause: () => void;
  resume: () => void;
}

const DISCONNECT_THRESHOLD = 3;
const DISCONNECT_WINDOW_MS = 30_000;
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_MAX_MS = 16_000;

export function useAnalyticsSSE(
  options: UseAnalyticsSSEOptions = {},
): UseAnalyticsSSEResult {
  const {
    window: windowParam = '1h',
    enabled = true,
    pollIntervalMs = 5_000,
    forcePolling = false,
  } = options;

  const [data, setData] = useState<LiveSnapshot | null>(null);
  const [status, setStatus] = useState<AnalyticsSSEStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);

  const sseRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const disconnectsRef = useRef<number[]>([]);
  const fallbackForcedRef = useRef(forcePolling);

  const cleanupSSE = useCallback(() => {
    if (sseRef.current) {
      sseRef.current.close();
      sseRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const cleanupPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const fetchSnapshot = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/analytics/live?window=${windowParam}`, {
        cache: 'no-store',
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const snap = (await r.json()) as LiveSnapshot;
      setData(snap);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'fetch_failed');
    }
  }, [windowParam]);

  const startPolling = useCallback(() => {
    cleanupSSE();
    cleanupPolling();
    setStatus('polling');
    void fetchSnapshot();
    pollRef.current = setInterval(fetchSnapshot, pollIntervalMs);
  }, [cleanupSSE, cleanupPolling, fetchSnapshot, pollIntervalMs]);

  const recordDisconnect = useCallback((): boolean => {
    const now = Date.now();
    disconnectsRef.current.push(now);
    disconnectsRef.current = disconnectsRef.current.filter(
      (t) => now - t <= DISCONNECT_WINDOW_MS,
    );
    return disconnectsRef.current.length >= DISCONNECT_THRESHOLD;
  }, []);

  const startSSE = useCallback(() => {
    if (typeof EventSource === 'undefined') {
      startPolling();
      return;
    }
    cleanupSSE();
    cleanupPolling();
    setStatus('connecting');

    const es = new EventSource(
      `/api/admin/analytics/live/stream?window=${windowParam}`,
    );
    sseRef.current = es;

    es.addEventListener('open', () => {
      setStatus('open');
      setError(null);
      reconnectAttemptRef.current = 0;
    });

    es.addEventListener('snapshot', (evt) => {
      try {
        const snap = JSON.parse((evt as MessageEvent<string>).data) as LiveSnapshot;
        setData(snap);
        setError(null);
      } catch {
        setError('parse_failed');
      }
    });

    es.addEventListener('error', () => {
      // Le browser émet "error" à chaque hiccup. EventSource va tenter de
      // reconnecter automatiquement — mais on prend le contrôle pour avoir
      // un backoff explicite et un fallback polling au-dessus du seuil.
      const tooManyDisconnects = recordDisconnect();
      if (tooManyDisconnects) {
        startPolling();
        return;
      }
      cleanupSSE();
      setStatus('error');
      const attempt = reconnectAttemptRef.current + 1;
      reconnectAttemptRef.current = attempt;
      const delay = Math.min(
        BACKOFF_BASE_MS * Math.pow(2, attempt - 1),
        BACKOFF_MAX_MS,
      );
      reconnectTimeoutRef.current = setTimeout(() => {
        startSSE();
      }, delay);
    });
  }, [cleanupSSE, cleanupPolling, recordDisconnect, startPolling, windowParam]);

  const start = useCallback(() => {
    if (fallbackForcedRef.current) {
      startPolling();
    } else {
      startSSE();
    }
  }, [startPolling, startSSE]);

  const stop = useCallback(() => {
    cleanupSSE();
    cleanupPolling();
    setStatus('idle');
  }, [cleanupSSE, cleanupPolling]);

  const pause = useCallback(() => {
    cleanupSSE();
    cleanupPolling();
    setPaused(true);
    setStatus('paused');
  }, [cleanupSSE, cleanupPolling]);

  const resume = useCallback(() => {
    setPaused(false);
    start();
  }, [start]);

  useEffect(() => {
    if (!enabled || paused) return;
    start();

    const onVisibility = (): void => {
      if (typeof document === 'undefined') return;
      if (document.visibilityState === 'hidden') {
        cleanupSSE();
        cleanupPolling();
      } else if (!paused) {
        start();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
      stop();
    };
    // `paused` est intentionnellement exclu : pause()/resume() gèrent leur
    // propre cycle de vie pour éviter une boucle d'effets. ESLint rule
    // exhaustive-deps désactivée localement plus bas si nécessaire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, windowParam, start, stop, cleanupSSE, cleanupPolling]);

  return { data, status, error, paused, pause, resume };
}
