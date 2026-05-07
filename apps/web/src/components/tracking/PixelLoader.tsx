'use client';

import { useEffect, useRef } from 'react';
import { hasGivenConsent, loadConsent } from '@/lib/tracking/consent';
import type { TrackingConsentState } from '@/lib/db/types';

interface PixelSnippet {
  kind: string;
  code: string;
}

async function fetchSnippets(): Promise<PixelSnippet[]> {
  try {
    const res = await fetch('/api/track/pixels', { cache: 'no-store' });
    if (!res.ok) return [];
    const body = (await res.json()) as { snippets?: PixelSnippet[] };
    return body.snippets ?? [];
  } catch {
    return [];
  }
}

function injectSnippet(snippet: PixelSnippet, loaded: Set<string>): void {
  if (loaded.has(snippet.kind)) return;
  loaded.add(snippet.kind);
  const script = document.createElement('script');
  script.dataset.trackingPixel = snippet.kind;
  script.text = snippet.code;
  document.head.appendChild(script);
}

function whenIdle(cb: () => void): void {
  type IdleWindow = Window & { requestIdleCallback?: (cb: () => void) => void };
  const w = window as unknown as IdleWindow;
  if (typeof w.requestIdleCallback === 'function') {
    w.requestIdleCallback(cb);
  } else {
    setTimeout(cb, 200);
  }
}

export function PixelLoader(): null {
  const loadedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const load = async (consent: TrackingConsentState): Promise<void> => {
      if (!hasGivenConsent(consent)) return;
      const snippets = await fetchSnippets();
      if (cancelled) return;
      whenIdle(() => {
        for (const snippet of snippets) injectSnippet(snippet, loadedRef.current);
      });
    };
    void load(loadConsent());
    const handler = (evt: Event): void => {
      const detail = (evt as CustomEvent<TrackingConsentState>).detail;
      if (!detail) return;
      void load(detail);
    };
    window.addEventListener('fg:consent-changed', handler);
    return (): void => {
      cancelled = true;
      window.removeEventListener('fg:consent-changed', handler);
    };
  }, []);

  return null;
}
