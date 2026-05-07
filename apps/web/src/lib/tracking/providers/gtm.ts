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
  clientSnippet(provider: TrackingProvider): string | null {
    if (provider.status !== 'enabled' || !provider.pixelId) return null;
    return `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${provider.pixelId}');`;
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
