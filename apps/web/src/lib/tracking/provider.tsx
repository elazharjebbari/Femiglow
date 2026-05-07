'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { TrackingClient } from '@/lib/tracking/client';
import { DENIED_CONSENT, GRANTED_CONSENT, loadConsent } from '@/lib/tracking/consent';
import { getAnonymousId, getSessionId } from '@/lib/tracking/identity';
import type { TrackingConsentState } from '@/lib/db/types';

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
}

export function TrackingProvider({
  children,
  endpoint,
  bannerEnabled = true,
  defaultGranted = false,
}: TrackingProviderProps): JSX.Element {
  const initialConsent: TrackingConsentState =
    !bannerEnabled && defaultGranted ? GRANTED_CONSENT : DENIED_CONSENT;
  const [consent, setConsent] = useState<TrackingConsentState>(initialConsent);
  const [isReady, setIsReady] = useState(false);
  const consentRef = useRef(consent);
  consentRef.current = consent;

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
          locale:
            typeof navigator !== 'undefined' ? navigator.language || 'fr-FR' : 'fr-FR',
        }),
      }),
    [endpoint],
  );

  useEffect(() => {
    // Bandeau actif : on lit la valeur stockée (denied par défaut Consent
    // Mode v2). Bandeau désactivé : on applique l'état souhaité par
    // l'admin (granted si juridiction ne l'exige pas, denied sinon).
    if (!bannerEnabled) {
      setConsent(defaultGranted ? GRANTED_CONSENT : DENIED_CONSENT);
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
