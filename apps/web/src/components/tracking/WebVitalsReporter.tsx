'use client';

import { useCallback, useContext, useEffect, useRef } from 'react';
import { useReportWebVitals } from 'next/web-vitals';

import { DEFAULT_LOCALE } from '@/i18n.config';
import type { TrackingConsentState } from '@/lib/db/types';
import { loadConsent } from '@/lib/tracking/consent';
import { getAnonymousId, getSessionId } from '@/lib/tracking/identity';
import { TrackingContext } from '@/lib/tracking/provider';
import {
  buildWebVitalsBatch,
  consentAllowsWebVitals,
  isSampledIn,
  sampleRateForRoute,
  shapeWebVitalParams,
  type ReportedMetric,
  type WebVitalParams,
} from '@/lib/tracking/web-vitals';

/** Envoi anticipé des premières mesures (TTFB, FCP…) si l'onglet reste ouvert. */
export const WEB_VITALS_FLUSH_DELAY_MS = 10_000;

interface PageSample {
  route: string;
  rate: number;
  sampled: boolean;
}

export interface WebVitalsReporterProps {
  endpoint?: string;
  /** Injectable pour les tests (tirage d'échantillonnage). */
  random?: () => number;
}

function send(endpoint: string, body: string): void {
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    try {
      const blob = new Blob([body], { type: 'application/json' });
      if (navigator.sendBeacon(endpoint, blob)) return;
    } catch {
      // repli fetch ci-dessous
    }
  }
  if (typeof fetch !== 'function') return;
  void fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
}

/**
 * Kit CRO v2 §1 — remonte LCP, FCP, CLS, INP et TTFB des pages publiques vers
 * le pipeline first-party `/api/track` (événement `web_vitals`).
 *
 * - Échantillonnage décidé UNE fois par chargement de page (les Web Vitals
 *   sont mesurés par chargement complet, pas par navigation client) :
 *   100 % sur `/kit`, 20 % ailleurs, jamais sur `/admin` ni `/api`.
 * - Mesures regroupées en lot, envoyées via `sendBeacon` au masquage de
 *   l'onglet (`visibilitychange`/`pagehide`, moment où CLS et INP sont
 *   finalisés) ou après `WEB_VITALS_FLUSH_DELAY_MS`.
 * - Hors `dataLayer` : aucun tag GTM ni pixel publicitaire ne les voit ; côté
 *   serveur, `web_vitals` est exclu du dispatch providers.
 * - Consentement respecté (même règle que `/api/track`).
 *
 * Ne rend rien.
 */
export function WebVitalsReporter({
  endpoint = '/api/track',
  random = Math.random,
}: WebVitalsReporterProps): null {
  const tracking = useContext(TrackingContext);
  const consentRef = useRef<TrackingConsentState | null>(tracking?.consent ?? null);
  consentRef.current = tracking?.consent ?? null;

  const sampleRef = useRef<PageSample | null>(null);
  const queueRef = useRef<WebVitalParams[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const randomRef = useRef(random);
  randomRef.current = random;

  const resolveSample = useCallback((): PageSample => {
    if (sampleRef.current) return sampleRef.current;
    const route = window.location.pathname || '/';
    const rate = sampleRateForRoute(route);
    sampleRef.current = { route, rate, sampled: isSampledIn(rate, randomRef.current) };
    return sampleRef.current;
  }, []);

  const flush = useCallback((): void => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const metrics = queueRef.current;
    if (metrics.length === 0) return;
    queueRef.current = [];
    const consent = consentRef.current ?? loadConsent();
    if (!consentAllowsWebVitals(consent)) return;
    const batch = buildWebVitalsBatch(metrics, {
      consent,
      user: { anonymous_id: getAnonymousId(), session_id: getSessionId() },
      page: {
        url: window.location.href,
        path: window.location.pathname,
        title: document.title,
        referrer: document.referrer,
        // Locale réellement servie (posée par le serveur sur <html lang>),
        // juste même quand `/kit` est réécrit vers `/fr/kit`.
        locale: document.documentElement.lang || DEFAULT_LOCALE,
      },
    });
    send(endpoint, JSON.stringify(batch));
  }, [endpoint]);

  useEffect(() => {
    // Fige la route d'atterrissage avant toute navigation client.
    resolveSample();
    const onVisibility = (): void => {
      if (document.visibilityState === 'hidden') flush();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [flush, resolveSample]);

  const report = useCallback(
    (metric: ReportedMetric): void => {
      const sample = resolveSample();
      if (!sample.sampled) return;
      const params = shapeWebVitalParams(metric, sample.route, sample.rate);
      if (!params) return;
      // `reportAllChanges` est désactivé : une métrique = une valeur finale,
      // mais on remplace par sécurité une éventuelle valeur déjà en file.
      queueRef.current = [
        ...queueRef.current.filter((m) => m.name !== params.name),
        params,
      ];
      if (!timerRef.current) {
        timerRef.current = setTimeout(flush, WEB_VITALS_FLUSH_DELAY_MS);
      }
    },
    [flush, resolveSample],
  );

  useReportWebVitals(report);
  return null;
}
