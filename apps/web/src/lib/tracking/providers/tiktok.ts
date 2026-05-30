import { decryptCapiToken } from '@/lib/db/queries/tracking/providers';
import type { TrackingProvider, TrackingProviderResult } from '@/lib/db/types';
import { logger } from '@/lib/logging/logger';
import { hashIdentity, sha256Hex } from './hashing';
import { isEventSupported } from './event-mapping';
import { getMappedName } from './get-mapped-name';
import { fetchWithRetry } from './retry';
import type { DispatchContext, ProviderAdapter } from './types';

function buildPayload(provider: TrackingProvider, ctx: DispatchContext): Record<string, unknown> {
  // Sprint 4 A1 — Audit identifié comme inconsistance : TikTok fallback
  // à 'CustomEvent' littéral pollue les analytics TikTok Events Manager.
  // On loggue désormais un warning pour que l'admin sache + puisse
  // mapper explicitement via l'UI admin (event-mappings).
  // Référence : docs/live-systems-audit-2026-05/01-audit-baseline.md
  const explicitMapped = getMappedName(ctx, 'tiktok');
  const eventNameMapped = explicitMapped ?? 'CustomEvent';
  if (!explicitMapped) {
    logger.warn('tracking.tiktok.event_unmapped_fallback', {
      eventName: ctx.eventName,
      fallback: 'CustomEvent',
      hint: 'Configure mapping via /admin/event-mappings to avoid pollution.',
    });
  }
  const hashed = hashIdentity(ctx.identity ?? {});
  const externalId = ctx.externalId ?? ctx.userId ?? ctx.anonymousId;
  return {
    event_source: 'web',
    event_source_id: provider.pixelId,
    data: [
      {
        event: eventNameMapped,
        event_time: Math.floor(ctx.receivedAt.getTime() / 1000),
        event_id: ctx.eventId,
        user: {
          email: hashed.em ? [hashed.em] : undefined,
          phone: hashed.ph ? [hashed.ph] : undefined,
          external_id: [sha256Hex(externalId)],
          ip: ctx.ipAnonymized,
          user_agent: ctx.uaHash,
          ttclid: ctx.ttclid,
        },
        properties: {
          contents: Array.isArray(ctx.params.items)
            ? (ctx.params.items as Array<Record<string, unknown>>).map((item) => ({
                content_id: item.item_id,
                content_name: item.item_name,
                price: item.price,
                quantity: item.quantity ?? 1,
              }))
            : undefined,
          currency: ctx.params.currency,
          value: ctx.params.value,
          order_id: ctx.params.transaction_id,
        },
        page: { url: ctx.pageUrl, referrer: ctx.referrer ?? '' },
      },
    ],
    ...(provider.testEventCode ? { test_event_code: provider.testEventCode } : {}),
  };
}

export const tiktokAdapter: ProviderAdapter = {
  kind: 'tiktok',
  supports(eventName: string): boolean {
    return isEventSupported(eventName, 'tiktok');
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
    const url = 'https://business-api.tiktok.com/open_api/v1.3/event/track/';
    const result = await fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'access-token': accessToken,
      },
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
    return `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++){ttq.setAndDefer(ttq,ttq.methods[i])}ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++){ttq.setAndDefer(e,ttq.methods[n])}return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${provider.pixelId}');ttq.page();}(window,document,'ttq');`;
  },
  cspHosts() {
    return {
      scriptSrc: ['https://analytics.tiktok.com'],
      connectSrc: ['https://analytics.tiktok.com', 'https://business-api.tiktok.com'],
    };
  },
};

export const __test__ = { buildPayload };
