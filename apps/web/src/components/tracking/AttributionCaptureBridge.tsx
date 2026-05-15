'use client';

/**
 * Bridge client qui capture le canal d'acquisition au mount + à
 * chaque navigation soft (Next.js router events).
 *
 * Pipeline :
 *  1. Lit `window.location` + `document.referrer`
 *  2. detectChannel() → ChannelTouch
 *  3. mergeTouch(current cookie, newTouch) → mises à jour snapshot
 *  4. writeAttributionCookie(snapshot) — persiste 90j
 *
 * Le bridge est silencieux quand consent.analytics_storage === 'denied'
 * (respect Consent Mode v2). Une nouvelle capture s'opère dès que le
 * visiteur accepte le bandeau (listener fg:consent-changed).
 */
import { useEffect } from 'react';
import { detectChannel } from '@/lib/tracking/attribution/channel-detector';
import {
  mergeTouch,
  readAttributionCookie,
  writeAttributionCookie,
} from '@/lib/tracking/attribution/cookie';
import { hasGivenConsent, loadConsent } from '@/lib/tracking/consent';
import type { TrackingConsentState } from '@/lib/db/types';

function capture(): void {
  if (typeof window === 'undefined') return;
  try {
    const touch = detectChannel({
      url: window.location.href,
      referrer: document.referrer || null,
    });
    const current = readAttributionCookie();
    const next = mergeTouch(current, touch);
    writeAttributionCookie(next);
  } catch {
    // Pas de fail loud — l'attribution est best-effort.
  }
}

export function AttributionCaptureBridge(): null {
  useEffect(() => {
    const run = (consent: TrackingConsentState): void => {
      if (!hasGivenConsent(consent)) return;
      capture();
    };
    run(loadConsent());

    const onConsent = (evt: Event): void => {
      const detail = (evt as CustomEvent<TrackingConsentState>).detail;
      if (detail) run(detail);
    };
    window.addEventListener('fg:consent-changed', onConsent);
    return () => window.removeEventListener('fg:consent-changed', onConsent);
  }, []);

  return null;
}
