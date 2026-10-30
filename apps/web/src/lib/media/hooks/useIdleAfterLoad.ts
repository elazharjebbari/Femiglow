'use client';
import { useEffect, useState } from 'react';

/** Délai de repli quand `requestIdleCallback` n'existe pas (Safari). */
export const IDLE_FALLBACK_DELAY_MS = 1500;

/** Délai max laissé à `requestIdleCallback` avant de forcer l'appel. */
const DEFAULT_IDLE_TIMEOUT_MS = 4000;

interface WindowWithIdle {
  requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number;
  cancelIdleCallback?: (id: number) => void;
}

/**
 * Passe à `true` une fois la page entièrement chargée (`window.load`) PUIS
 * le navigateur au repos (`requestIdleCallback`, repli `setTimeout`).
 *
 * Sert à différer tout ce qui est décoratif (aperçus vidéo…) derrière le
 * LCP, le JS critique et les pixels : rien ne part avant que la page soit
 * utilisable. Toujours `false` au rendu serveur et au premier rendu client
 * (pas de divergence d'hydratation).
 */
export function useIdleAfterLoad(idleTimeoutMs: number = DEFAULT_IDLE_TIMEOUT_MS): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let idleId: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const w = window as unknown as WindowWithIdle;

    const markReady = (): void => {
      if (!cancelled) setReady(true);
    };
    const scheduleIdle = (): void => {
      if (typeof w.requestIdleCallback === 'function') {
        idleId = w.requestIdleCallback(markReady, { timeout: idleTimeoutMs });
      } else {
        timer = setTimeout(markReady, IDLE_FALLBACK_DELAY_MS);
      }
    };

    if (document.readyState === 'complete') scheduleIdle();
    else window.addEventListener('load', scheduleIdle, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener('load', scheduleIdle);
      if (idleId !== undefined) w.cancelIdleCallback?.(idleId);
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [idleTimeoutMs]);

  return ready;
}
