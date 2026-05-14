import { decryptCapiToken } from '@/lib/db/queries/tracking/providers';
import type { TrackingProvider, TrackingProviderResult } from '@/lib/db/types';
import { hashIdentity } from './hashing';
import { isEventSupported } from './event-mapping';
import { getMappedName } from './get-mapped-name';
import { fetchWithRetry } from './retry';
import type { DispatchContext, ProviderAdapter } from './types';

function buildPayload(provider: TrackingProvider, ctx: DispatchContext): Record<string, unknown> {
  const eventNameMapped = getMappedName(ctx, 'snap') ?? 'CUSTOM_EVENT';
  const hashed = hashIdentity(ctx.identity ?? {});
  return {
    data: [
      {
        event_name: eventNameMapped,
        event_time: Math.floor(ctx.receivedAt.getTime() / 1000),
        event_id: ctx.eventId,
        event_source_url: ctx.pageUrl,
        action_source: 'website',
        user_data: {
          em: hashed.em ? [hashed.em] : undefined,
          ph: hashed.ph ? [hashed.ph] : undefined,
          client_ip_address: ctx.ipAnonymized,
          client_user_agent: ctx.uaHash,
          sc_click_id: ctx.params.sc_click_id,
        },
        custom_data: {
          currency: ctx.params.currency,
          value: ctx.params.value,
          item_ids: Array.isArray(ctx.params.items)
            ? (ctx.params.items as Array<{ item_id?: string }>).map((i) => i.item_id)
            : undefined,
          number_items: Array.isArray(ctx.params.items)
            ? (ctx.params.items as unknown[]).length
            : undefined,
          transaction_id: ctx.params.transaction_id,
        },
      },
    ],
    ...(provider.testEventCode ? { test_event_code: provider.testEventCode } : {}),
  };
}

export const snapAdapter: ProviderAdapter = {
  kind: 'snap',
  supports(eventName: string): boolean {
    return isEventSupported(eventName, 'snap');
  },
  async dispatch(provider: TrackingProvider, ctx: DispatchContext): Promise<TrackingProviderResult> {
    const startedAt = Date.now();
    if (provider.status !== 'enabled') {
      return { status: 'skipped', latencyMs: 0, attempts: 0, error: 'provider_disabled' };
    }
    if (!provider.pixelId) {
      return { status: 'skipped', latencyMs: 0, attempts: 0, error: 'pixel_id_missing' };
    }
    const accessToken = decryptCapiToken(provider);
    if (!accessToken) {
      return { status: 'skipped', latencyMs: 0, attempts: 0, error: 'access_token_missing' };
    }
    const url = `https://tr.snapchat.com/v3/${provider.pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;
    const result = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPayload(provider, ctx)),
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
    return `(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script';r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u)})(window,document,'https://sc-static.net/scevent.min.js');snaptr('init','${provider.pixelId}');snaptr('track','PAGE_VIEW');`;
  },
  cspHosts() {
    return {
      scriptSrc: ['https://sc-static.net'],
      connectSrc: ['https://tr.snapchat.com'],
    };
  },
};
