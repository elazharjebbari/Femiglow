import { decryptCapiToken } from '@/lib/db/queries/tracking/providers';
import type { TrackingProvider, TrackingProviderResult } from '@/lib/db/types';
import { isEventSupported } from './event-mapping';
import { getMappedName } from './get-mapped-name';
import { fetchWithRetry } from './retry';
import type { DispatchContext, ProviderAdapter } from './types';

function buildMpPayload(ctx: DispatchContext): Record<string, unknown> {
  // Si pas de mapping résolu, fallback au nom canonique (comportement
  // historique : GA4 accepte n'importe quel event name custom).
  const eventNameMapped = getMappedName(ctx, 'google_ga4') ?? ctx.eventName;
  const baseParams: Record<string, unknown> = {
    ...ctx.params,
    page_location: ctx.pageUrl,
    page_path: ctx.pageRoute,
    page_referrer: ctx.referrer ?? '',
    engagement_time_msec: 1,
    session_id: ctx.sessionId,
  };
  return {
    client_id: ctx.anonymousId,
    user_id: ctx.userId ?? undefined,
    timestamp_micros: ctx.receivedAt.getTime() * 1000,
    non_personalized_ads: ctx.consent.ad_personalization === 'denied',
    consent: {
      ad_user_data: ctx.consent.ad_user_data === 'granted' ? 'GRANTED' : 'DENIED',
      ad_personalization: ctx.consent.ad_personalization === 'granted' ? 'GRANTED' : 'DENIED',
    },
    events: [{ name: eventNameMapped, params: baseParams }],
  };
}

export const googleAdapter: ProviderAdapter = {
  kind: 'google_ga4',
  supports(eventName: string): boolean {
    return isEventSupported(eventName, 'google_ga4');
  },
  async dispatch(provider: TrackingProvider, ctx: DispatchContext): Promise<TrackingProviderResult> {
    const startedAt = Date.now();
    if (provider.status !== 'enabled') {
      return { status: 'skipped', latencyMs: 0, attempts: 0, error: 'provider_disabled' };
    }
    if (!provider.pixelId) {
      return { status: 'skipped', latencyMs: 0, attempts: 0, error: 'measurement_id_missing' };
    }
    const apiSecret = decryptCapiToken(provider);
    if (!apiSecret) {
      return { status: 'skipped', latencyMs: 0, attempts: 0, error: 'api_secret_missing' };
    }
    const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(provider.pixelId)}&api_secret=${encodeURIComponent(apiSecret)}`;
    const result = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildMpPayload(ctx)),
    });
    return {
      status: result.ok ? 'sent' : 'failed',
      httpStatus: result.status,
      attempts: result.attempts,
      latencyMs: Date.now() - startedAt,
      error: result.ok ? undefined : result.body.slice(0, 200),
    };
  },
  clientSnippet(provider: TrackingProvider): string | null {
    if (provider.status !== 'enabled' || !provider.pixelId) return null;
    return `(function(){var s=document.createElement('script');s.async=true;s.src='https://www.googletagmanager.com/gtag/js?id=${provider.pixelId}';document.head.appendChild(s);})();window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('consent','default',{ad_storage:'denied',analytics_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',functional_storage:'denied'});gtag('config','${provider.pixelId}',{send_page_view:false});`;
  },
  cspHosts() {
    return {
      scriptSrc: ['https://www.googletagmanager.com'],
      connectSrc: [
        'https://www.google-analytics.com',
        'https://analytics.google.com',
        'https://stats.g.doubleclick.net',
      ],
    };
  },
};
