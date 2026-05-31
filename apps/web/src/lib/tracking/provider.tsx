'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { TrackingClient } from '@/lib/tracking/client';
import {
  DENIED_CONSENT,
  GRANTED_CONSENT,
  loadConsent,
  saveConsent,
} from '@/lib/tracking/consent';
import { getAnonymousId, getSessionId } from '@/lib/tracking/identity';
import {
  DEFAULT_ATTRIBUTION_STRATEGY,
  type AttributionStrategy,
} from '@/lib/tracking/attribution/types';
import type { TrackingConsentState } from '@/lib/db/types';
import { isLocale, DEFAULT_LOCALE, LOCALE_COOKIE_NAME } from '@/i18n.config';

/**
 * Locale **du site** (langue active `fr`/`ar`/`en`) pour `page.locale` du
 * dataLayer — pas la langue du navigateur. Permet à GA4 de répondre à
 * « quelle langue convertit le plus » (param `page_locale`).
 *
 * Priorité : préfixe URL (stratégie 'always' → `/[locale]/…`) → cookie
 * `NEXT_LOCALE` (choix explicite) → langue navigateur (2 lettres si supportée)
 * → `DEFAULT_LOCALE`.
 */
function resolveSiteLocale(): string {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const seg = window.location.pathname.split('/')[1];
  if (isLocale(seg)) return seg;
  if (typeof document !== 'undefined') {
    const m = document.cookie.match(
      new RegExp(`(?:^|;\\s*)${LOCALE_COOKIE_NAME}=([^;]+)`),
    );
    if (m && isLocale(m[1])) return m[1]!;
  }
  const nav =
    typeof navigator !== 'undefined' ? (navigator.language || '').slice(0, 2) : '';
  return isLocale(nav) ? nav : DEFAULT_LOCALE;
}

export interface TrackingContextValue {
  client: TrackingClient;
  consent: TrackingConsentState;
  isReady: boolean;
  bannerEnabled: boolean;
}

export const TrackingContext = createContext<TrackingContextValue | null>(null);

export interface TrackingProviderProps {
  children: React.ReactNode;
  endpoint?: string;
  /**
   * Bandeau de consentement actif (par défaut true). Si false, l'état
   * initial est piloté par `defaultGranted` (granted ou denied) sans
   * jamais montrer de bandeau.
   */
  bannerEnabled?: boolean;
  /**
   * Quand le bandeau est désactivé, indique si on doit considérer le
   * consentement comme accordé par défaut (juridictions sans obligation).
   */
  defaultGranted?: boolean;
  /**
   * Stratégie d'attribution multi-canal, injectée depuis le serveur
   * (RSC root layout → tracking_settings.attribution_strategy).
   * Par défaut `last_paid_touch`.
   */
  attributionStrategy?: AttributionStrategy;
}

export function TrackingProvider({
  children,
  endpoint,
  bannerEnabled = true,
  defaultGranted = false,
  attributionStrategy = DEFAULT_ATTRIBUTION_STRATEGY,
}: TrackingProviderProps): JSX.Element {
  const initialConsent: TrackingConsentState =
    !bannerEnabled && defaultGranted ? GRANTED_CONSENT : DENIED_CONSENT;
  const [consent, setConsent] = useState<TrackingConsentState>(initialConsent);
  const [isReady, setIsReady] = useState(false);
  const consentRef = useRef(consent);
  consentRef.current = consent;
  const strategyRef = useRef(attributionStrategy);
  strategyRef.current = attributionStrategy;

  const client = useMemo(
    () =>
      new TrackingClient({
        endpoint,
        consent: () => consentRef.current,
        user: () => ({ anonymous_id: getAnonymousId(), session_id: getSessionId() }),
        page: () => ({
          url: typeof window !== 'undefined' ? window.location.href : '',
          path: typeof window !== 'undefined' ? window.location.pathname : '',
          title: typeof document !== 'undefined' ? document.title : '',
          referrer: typeof document !== 'undefined' ? document.referrer : '',
          // Locale du site (langue active), pas navigator.language — pour
          // suivre quelle langue convertit (GA4 `page_locale`).
          locale: resolveSiteLocale(),
        }),
        // Lecture via ref pour refléter un changement de stratégie sans
        // recréer le client (rare, mais utile pour les tests).
        attributionStrategy: () => strategyRef.current,
      }),
    [endpoint],
  );

  useEffect(() => {
    // Bandeau actif : on lit la valeur stockée (denied par défaut Consent
    // Mode v2). Bandeau désactivé : on applique l'état souhaité par
    // l'admin (granted si juridiction ne l'exige pas, denied sinon).
    if (!bannerEnabled) {
      const next = defaultGranted ? GRANTED_CONSENT : DENIED_CONSENT;
      setConsent(next);
      // Si l'admin a demandé `defaultGranted=true` mais qu'aucun consent
      // n'est encore en localStorage, on persiste le `GRANTED_CONSENT` et
      // on dispatch `fg:consent-changed`. Sans ça, le `PixelLoader` lit un
      // localStorage vide, retombe sur `DENIED_CONSENT` et n'injecte aucun
      // snippet — même si le provider est `enabled` côté DB.
      if (defaultGranted) {
        const stored = loadConsent();
        if (stored.analytics_storage !== 'granted') {
          saveConsent(next);
        }
      }
    } else {
      setConsent(loadConsent());
    }
    setIsReady(true);
    const handler = (event: Event): void => {
      const detail = (event as CustomEvent<TrackingConsentState>).detail;
      if (detail) setConsent(detail);
    };
    window.addEventListener('fg:consent-changed', handler);
    const flushOnHide = (): void => {
      client.flushSync();
    };
    window.addEventListener('visibilitychange', flushOnHide);
    window.addEventListener('pagehide', flushOnHide);
    return (): void => {
      window.removeEventListener('fg:consent-changed', handler);
      window.removeEventListener('visibilitychange', flushOnHide);
      window.removeEventListener('pagehide', flushOnHide);
    };
  }, [client, bannerEnabled, defaultGranted]);

  const value = useMemo<TrackingContextValue>(
    () => ({ client, consent, isReady, bannerEnabled }),
    [client, consent, isReady, bannerEnabled],
  );

  return <TrackingContext.Provider value={value}>{children}</TrackingContext.Provider>;
}

export function useTrackingContext(): TrackingContextValue {
  const ctx = useContext(TrackingContext);
  if (!ctx) {
    throw new Error('useTracking must be used inside <TrackingProvider>');
  }
  return ctx;
}
