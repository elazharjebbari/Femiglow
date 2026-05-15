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

  clientSnippet(provider: TrackingProvider): string | null {
    if (provider.status !== 'enabled' || !provider.pixelId) return null;
    const id = provider.pixelId;
    // Snippet idempotent : charge gtag.js si pas déjà présent, puis configure
    // l'ID Google Ads. Cohabite avec GA4 (même `window.dataLayer`, même
    // `window.gtag`). Tag Assistant détecte les deux balises distinctement.
    return [
      '(function(){',
      `var id=${JSON.stringify(id)};`,
      'window.dataLayer=window.dataLayer||[];',
      'function gtag(){dataLayer.push(arguments);}',
      'window.gtag=window.gtag||gtag;',
      "if(!document.querySelector('script[data-gtag-loaded]')){",
      "  var s=document.createElement('script');",
      "  s.async=true;",
      "  s.src='https://www.googletagmanager.com/gtag/js?id='+encodeURIComponent(id);",
      "  s.setAttribute('data-gtag-loaded','1');",
      '  document.head.appendChild(s);',
      "  gtag('js',new Date());",
      "  gtag('consent','default',{ad_storage:'denied',analytics_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',functional_storage:'denied'});",
      '}',
      "gtag('config',id,{send_page_view:false});",
      '})();',
    ].join('');
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
