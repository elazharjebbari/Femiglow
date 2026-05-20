/**
 * Google Ads adapter — client-side gtag.js avec ID conversion `AW-XXXXXXXXX`.
 *
 * Particularité : Google Ads partage le runtime `gtag.js` avec Google Analytics 4.
 * Si GA4 est déjà chargé, on n'ajoute QUE `gtag('config', 'AW-…')`. Sinon, on
 * charge la balise `gtag.js?id=AW-…` puis on initialise.
 *
 * Côté serveur (`dispatch`) : no-op. Les conversions Google Ads passent par GTM
 * ou par l'API offline conversions (hors scope de ce client). Le snippet front
 * est suffisant pour que Tag Assistant détecte la balise Google.
 */
import type { TrackingProvider, TrackingProviderResult } from '@/lib/db/types';
import type { ProviderAdapter } from './types';

export const googleAdsAdapter: ProviderAdapter = {
  kind: 'google_ads',

  supports(): boolean {
    // Le dispatch serveur est no-op ; on ne déclare aucun event supporté
    // pour éviter d'apparaître dans la liste de routing serveur.
    return false;
  },

  async dispatch(): Promise<TrackingProviderResult> {
    return { status: 'skipped', latencyMs: 0, attempts: 0, error: 'client_only_provider' };
  },

  clientSnippet(): string | null {
    // Google Ads est bootstrapé via GTM (tag awct dans le container
    // exporté). L'injection standalone gtag.js créait des doublons :
    //   - double `gtag('config','AW-XXX')`
    //   - double conversion event (1× par tag awct GTM, 1× par
    //     auto-tracking gtag du config standalone)
    // Le user observait `gtag("event","purchase",{send_to:"AW-XXX"})`
    // après chaque event GTM complet : c'était l'auto-tracking.
    // Source unique = GTM container. Cf. google.ts pour le même fix
    // côté GA4.
    return null;
  },

  cspHosts() {
    return {
      scriptSrc: [
        'https://www.googletagmanager.com',
        'https://www.googleadservices.com',
        'https://pagead2.googlesyndication.com',
      ],
      connectSrc: [
        'https://www.google.com',
        'https://www.google.fr',
        'https://www.google.ma',
        'https://googleads.g.doubleclick.net',
        'https://www.googletagmanager.com',
        'https://*.google-analytics.com',
        // Endpoint conversion ping — sans ça la conversion n'est pas
        // comptée (CSP blocked). Cf. doc tracking-attribution #6.
        'https://pagead2.googlesyndication.com',
        'https://www.googleadservices.com',
      ],
    };
  },
};
