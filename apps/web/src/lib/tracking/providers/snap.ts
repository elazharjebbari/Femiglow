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
  const userData = ctx.userData ?? {};
  const address = userData.address ?? {};
  const items = Array.isArray(ctx.params.items)
    ? (ctx.params.items as Array<{
        item_id?: string;
        item_category?: string;
        price?: number;
        quantity?: number;
      }>)
    : [];
  const attributionClickId =
    ctx.attribution?.click_id_field === 'sccid' || ctx.attribution?.click_id_field === 'ScCid'
      ? ctx.attribution.click_id
      : undefined;
  const scClickId =
    (ctx.params.sc_click_id as string | undefined) ??
    (ctx.params.ScCid as string | undefined) ??
    (ctx.params.sccid as string | undefined) ??
    attributionClickId;

  // Per Snap CAPI v3 spec: city and country are hashed when not pre-hashed.
  // If identity provides plain text, hashIdentity already produces hashed.ct and hashed.country.
  // If userData provides pre-hashed values or plain text, resolve accordingly.
  const geoCity = hashed.ct ?? address.city ?? ctx.identity?.city ?? ctx.params.geo_city ?? ctx.params.city;
  const geoCountry = hashed.country ?? address.country ?? ctx.identity?.country ?? ctx.params.geo_country ?? ctx.params.country;
  const geoRegion = ctx.params.geo_region as string | undefined;

  // Per Snap CAPI v3 spec: content_ids (not item_ids), content_category as array,
  // number_items as array of string quantities, event_id in custom_data.
  const contentIds = items.length > 0 ? items.map((i) => i.item_id).filter(Boolean) : undefined;
  const contentCategory = (items[0]?.item_category ?? ctx.params.item_category) as string | undefined;
  const numberItemsArr = items.length > 0
    ? items.map((i) => String(Number(i.quantity) || 1))
    : undefined;

  const customData: Record<string, unknown> = {
    event_id: ctx.eventId,
    currency: ctx.params.currency,
    value: ctx.params.value,
    content_ids: contentIds,
    content_category: contentCategory ? [contentCategory] : undefined,
    number_items: numberItemsArr,
    transaction_id: ctx.params.transaction_id,
    order_id: ctx.params.transaction_id,
    client_deduplication_id: ctx.eventId,
    event_tag: ctx.params.event_tag,
    description: ctx.params.description,
    uuid_c1: ctx.params.uuid_c1 ?? ctx.anonymousId,
  };

  // Event-specific fields per Snap v3 spec
  if (eventNameMapped === 'ADD_BILLING') {
    customData.sign_up_method = ctx.params.sign_up_method as string | undefined ?? 'phone';
  }
  if (eventNameMapped === 'START_CHECKOUT' || eventNameMapped === 'PURCHASE') {
    customData.payment_info_available = ctx.params.payment_info_available as number | undefined ?? 1;
  }
  if (eventNameMapped === 'PURCHASE') {
    customData.delivery_method = ctx.params.delivery_method as string | undefined ?? 'cod';
  }

  // Remove undefined values from custom_data (Snap rejects null/undefined)
  for (const key of Object.keys(customData)) {
    if (customData[key] === undefined) delete customData[key];
  }

  return {
    data: [
      {
        event_name: eventNameMapped,
        event_time: Math.floor(ctx.receivedAt.getTime() / 1000),
        event_id: ctx.eventId,
        event_source_url: ctx.pageUrl,
        action_source: 'website',
        user_data: {
          em: userData.sha256_email_address ? [userData.sha256_email_address] : hashed.em ? [hashed.em] : undefined,
          ph: userData.sha256_phone_number ? [userData.sha256_phone_number] : hashed.ph ? [hashed.ph] : undefined,
          fn: address.sha256_first_name ? [address.sha256_first_name] : hashed.fn ? [hashed.fn] : undefined,
          ln: address.sha256_last_name ? [address.sha256_last_name] : hashed.ln ? [hashed.ln] : undefined,
          ct: geoCity,
          country: geoCountry,
          st: geoRegion ? hashed.ct ? hashed.ct : geoRegion : undefined,
          client_ip_address: ctx.ipAnonymized,
          client_user_agent: ctx.userAgent ?? ctx.uaHash,
          sc_click_id: scClickId,
          sc_cookie1: ctx.params.sc_cookie1 as string | undefined,
        },
        custom_data: customData,
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
    return `(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script';r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u)})(window,document,'https://sc-static.net/scevent.min.js');snaptr('init','${provider.pixelId}');`;
  },
  cspHosts() {
    return {
      scriptSrc: ['https://sc-static.net'],
      connectSrc: ['https://tr.snapchat.com'],
    };
  },
};

export const __test__ = { buildPayload };