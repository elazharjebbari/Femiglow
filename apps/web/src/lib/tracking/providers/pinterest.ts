import { decryptCapiToken } from '@/lib/db/queries/tracking/providers';
import type { TrackingProvider, TrackingProviderResult } from '@/lib/db/types';
import { hashIdentity } from './hashing';
import { isEventSupported } from './event-mapping';
import { getMappedName } from './get-mapped-name';
import { fetchWithRetry } from './retry';
import type { DispatchContext, ProviderAdapter } from './types';

function buildPayload(ctx: DispatchContext): Record<string, unknown> {
  const eventNameMapped = getMappedName(ctx, 'pinterest') ?? 'custom';
  const hashed = hashIdentity(ctx.identity ?? {});
  return {
    data: [
      {
        event_name: eventNameMapped,
        action_source: 'web',
        event_time: Math.floor(ctx.receivedAt.getTime() / 1000),
        event_id: ctx.eventId,
        event_source_url: ctx.pageUrl,
        user_data: {
          em: hashed.em ? [hashed.em] : undefined,
          ph: hashed.ph ? [hashed.ph] : undefined,
          client_ip_address: ctx.ipAnonymized,
          client_user_agent: ctx.uaHash,
        },
        custom_data: {
          currency: ctx.params.currency,
          value: ctx.params.value,
          order_id: ctx.params.transaction_id,
          line_items: Array.isArray(ctx.params.items)
            ? (ctx.params.items as Array<Record<string, unknown>>).map((i) => ({
                product_id: i.item_id,
                product_name: i.item_name,
                product_price: i.price,
                product_quantity: i.quantity ?? 1,
              }))
            : undefined,
        },
      },
    ],
  };
}

export const pinterestAdapter: ProviderAdapter = {
  kind: 'pinterest',
  supports(eventName: string): boolean {
    return isEventSupported(eventName, 'pinterest');
  },
  async dispatch(provider: TrackingProvider, ctx: DispatchContext): Promise<TrackingProviderResult> {
    const startedAt = Date.now();
    if (provider.status !== 'enabled') {
      return { status: 'skipped', latencyMs: 0, attempts: 0, error: 'provider_disabled' };
    }
    if (!provider.pixelId) {
      return { status: 'skipped', latencyMs: 0, attempts: 0, error: 'ad_account_id_missing' };
    }
    const accessToken = decryptCapiToken(provider);
    if (!accessToken) {
      return { status: 'skipped', latencyMs: 0, attempts: 0, error: 'access_token_missing' };
    }
    const url = `https://api.pinterest.com/v5/ad_accounts/${encodeURIComponent(provider.pixelId)}/events`;
    const result = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(buildPayload(ctx)),
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
    const tagId = (provider.config?.tag_id as string | undefined) ?? provider.pixelId;
    return `!function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};var n=window.pintrk;n.queue=[],n.version='3.0';var t=document.createElement('script');t.async=!0,t.src=e;var r=document.getElementsByTagName('script')[0];r.parentNode.insertBefore(t,r)}}('https://s.pinimg.com/ct/core.js');pintrk('load','${tagId}');pintrk('page');`;
  },
  cspHosts() {
    return {
      scriptSrc: ['https://s.pinimg.com'],
      connectSrc: ['https://ct.pinterest.com', 'https://api.pinterest.com'],
    };
  },
};
