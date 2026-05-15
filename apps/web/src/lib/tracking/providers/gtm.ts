import type { TrackingProvider, TrackingProviderResult } from '@/lib/db/types';
import type { DispatchContext, ProviderAdapter } from './types';

/**
 * GTM est purement client-side : la dataLayer côté navigateur est consommée par le tag GTM.
 * L'adapter expose `clientSnippet()` pour injection (mode client) et `dispatch()` no-op côté serveur.
 */
export const gtmAdapter: ProviderAdapter = {
  kind: 'gtm',
  supports(): boolean {
    return true;
  },
  async dispatch(provider: TrackingProvider): Promise<TrackingProviderResult> {
    if (provider.status !== 'enabled') {
      return { status: 'skipped', latencyMs: 0, attempts: 0, error: 'provider_disabled' };
    }
    return {
      status: 'skipped',
      latencyMs: 0,
      attempts: 0,
      error: 'client_only',
    };
  },
  // GTM est désormais bootstrappé côté serveur dans le `<body>` du
  // root layout (cf. `GtmHeadScript`). Le client-snippet renvoie
  // toujours `null` pour éviter le double-load et pour que Tag
  // Assistant / Preview Mode détecte le conteneur dès le HTML initial,
  // indépendamment du consentement (Consent Mode v2 gère le gating).
  clientSnippet(): string | null {
    return null;
  },
  cspHosts() {
    return {
      scriptSrc: ['https://www.googletagmanager.com'],
      connectSrc: [
        'https://www.googletagmanager.com',
        'https://www.google-analytics.com',
      ],
    };
  },
};
