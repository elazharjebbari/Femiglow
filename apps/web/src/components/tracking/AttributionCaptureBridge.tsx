'use client';

/**
 * Bridge client qui capture le canal d'acquisition au mount.
 *
 * Pipeline :
 *  1. Lit `window.location` + `document.referrer`
 *  2. detectChannel() → ChannelTouch
 *  3. mergeTouch(current cookie, newTouch) → mises à jour snapshot
 *  4. writeAttributionCookie(snapshot) — persiste 90j côté navigateur
 *  5. POST /api/track/attribution — persiste côté serveur (DB) pour
 *     debugger admin + bypass des purges cookie (ITP Safari 7j)
 *
 * Le bridge est silencieux quand consent.analytics_storage === 'denied'
 * (respect Consent Mode v2). Une nouvelle capture s'opère dès que le
 * visiteur accepte le bandeau (listener fg:consent-changed).
 *
 * Le POST serveur est best-effort : un échec réseau ne bloque pas la
 * capture côté cookie (l'attribution reste exploitable côté GTM via
 * le dataLayer).
 */
import { useEffect } from 'react';
import { detectChannel } from '@/lib/tracking/attribution/channel-detector';
import {
  mergeTouch,
  readAttributionCookie,
  writeAttributionCookie,
} from '@/lib/tracking/attribution/cookie';
import { hasGivenConsent, loadConsent } from '@/lib/tracking/consent';
import { getAnonymousId } from '@/lib/tracking/identity';
import type { ChannelTouch } from '@/lib/tracking/attribution/types';
import type { TrackingConsentState } from '@/lib/db/types';

async function pushToServer(visitorId: string, touch: ChannelTouch): Promise<void> {
  try {
    const body = JSON.stringify({ visitor_id: visitorId, touch });
    if (typeof navigator !== 'undefined' && navigator.sendBeacon && body.length < 60_000) {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon('/api/track/attribution', blob)) return;
    }
    await fetch('/api/track/attribution', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    });
  } catch {
    // Best-effort : on n'altère pas la capture côté cookie en cas d'échec.
  }
}

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
    // POST serveur best-effort (microtask post-cookie update).
    const visitorId = getAnonymousId();
    if (visitorId) void pushToServer(visitorId, touch);
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
