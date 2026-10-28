import { decryptCapiToken } from '@/lib/db/queries/tracking/providers';
import type { TrackingProvider, TrackingProviderResult } from '@/lib/db/types';
import { enrichPurchase } from './_enrich-purchase';
import { hashIdentity, normalizeName, sha256Hex } from './hashing';
import { isEventSupported } from './event-mapping';
import { getMappedName, isMetaCustomEvent } from './get-mapped-name';
import { fetchWithRetry } from './retry';
import type { DispatchContext, ProviderAdapter } from './types';
// Sprint 4 A2 — Batching async via Redis buffer (cf. capi-flush cron).
import { LIVE_CAPI_BATCHING } from '@/lib/feature-flags/live-systems';
import { pushToBatch } from '@/lib/tracking/server/capi-buffer';

const GRAPH_API_VERSION = 'v19.0';
const PURCHASE_EVENT_NAMES = new Set(['purchase', 'purchase_server']);

/**
 * `user_data` Meta CAPI. Meta exige l'IP et le User-Agent EN CLAIR : un UA
 * haché ou une IP tronquée ne matchent rien, et sans pixel navigateur l'achat
 * ne peut alors pas être rattaché au clic publicitaire.
 *
 * Identité : `ctx.userData` (déjà hachée dans le navigateur, ex. téléphone du
 * formulaire COD) sert de base ; `ctx.identity` (en clair, hachée ici) prime.
 */
function buildUserData(ctx: DispatchContext): Record<string, unknown> {
  const hashed = hashIdentity(ctx.identity ?? {});
  const browser = ctx.userData ?? {};
  const address = browser.address ?? {};
  const fromBrowser: Record<string, string> = {};
  if (browser.sha256_email_address) fromBrowser.em = browser.sha256_email_address;
  if (browser.sha256_phone_number) fromBrowser.ph = browser.sha256_phone_number;
  if (address.sha256_first_name) fromBrowser.fn = address.sha256_first_name;
  if (address.sha256_last_name) fromBrowser.ln = address.sha256_last_name;
  if (address.city) fromBrowser.ct = sha256Hex(normalizeName(address.city));
  if (address.country) fromBrowser.country = sha256Hex(normalizeName(address.country));
  const externalId = ctx.externalId ?? ctx.userId ?? ctx.anonymousId;
  const ip = ctx.clientIp ?? (ctx.ipAnonymized !== '0.0.0.0' ? ctx.ipAnonymized : undefined);
  return {
    ...fromBrowser,
    ...hashed,
    external_id: sha256Hex(externalId),
    ...(ip ? { client_ip_address: ip } : {}),
    ...(ctx.userAgent ? { client_user_agent: ctx.userAgent } : {}),
    fbp: ctx.fbp,
    fbc: ctx.fbc,
  };
}

function buildCustomData(eventName: string, params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...params };
  if (eventName === 'purchase' && params.transaction_id) {
    out.order_id = String(params.transaction_id);
  }
  if (Array.isArray(params.items)) {
    out.contents = (params.items as Array<Record<string, unknown>>).map((item) => ({
      id: item.item_id,
      quantity: item.quantity ?? 1,
      item_price: item.price,
    }));
    out.content_ids = (params.items as Array<Record<string, unknown>>).map((item) => item.item_id);
    out.content_type = 'product';
    out.num_items = (params.items as unknown[]).length;
  }
  return out;
}

export const metaAdapter: ProviderAdapter = {
  kind: 'meta',
  supports(eventName: string): boolean {
    return isEventSupported(eventName, 'meta');
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
      return { status: 'skipped', latencyMs: 0, attempts: 0, error: 'capi_token_missing' };
    }
    const eventNameMapped = getMappedName(ctx, 'meta');
    if (!eventNameMapped) {
      return { status: 'skipped', latencyMs: 0, attempts: 0, error: 'event_unmapped' };
    }
    // Guard Purchase value/currency : sans value > 0 + currency 3-lettres, Meta
    // dégrade le ROAS. On enrichit depuis la DB orders puis on skippe si
    // toujours invalide (cf. docs/meta-quality-audit-2026-05/§2 root cause A).
    let params = ctx.params;
    if (PURCHASE_EVENT_NAMES.has(ctx.eventName)) {
      const enriched = await enrichPurchase(params);
      if (enriched.source === 'unavailable') {
        return {
          status: 'skipped',
          latencyMs: Date.now() - startedAt,
          attempts: 0,
          error: 'purchase_value_currency_invalid',
        };
      }
      params = { ...params, value: enriched.value, currency: enriched.currency };
    }
    const ts = Math.floor(ctx.receivedAt.getTime() / 1000);
    // Si l'admin a marqué isCustom=true, on envoie via trackCustom de la
    // CAPI Meta : le `event_name` reste personnalisé, mais on flag dans
    // custom_data pour cohérence client/serveur (les events client gtag
    // utilisent fbq('trackCustom', name)).
    const isCustom = isMetaCustomEvent(ctx);
    const payload = {
      data: [
        {
          event_name: eventNameMapped,
          event_time: ts,
          event_id: ctx.eventId,
          event_source_url: ctx.pageUrl,
          action_source: 'website',
          user_data: buildUserData(ctx),
          custom_data: {
            ...buildCustomData(ctx.eventName, params),
            ...(isCustom ? { fg_custom_event: true } : {}),
          },
        },
      ],
      ...(provider.testEventCode ? { test_event_code: provider.testEventCode } : {}),
    };
    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${provider.pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;

    // Sprint 4 A2 — Si batching activé, push dans Redis buffer au lieu
    // de fetch direct. Le cron `/api/cron/tracking/capi-flush` envoie le
    // batch toutes les minutes. Réduit la latence ingest /api/track P95
    // de ~500ms à <100ms et améliore le match rate Meta (timing optimisé).
    // Référence : docs/live-systems-fix-2026-05/08-system-tracking.md
    if (LIVE_CAPI_BATCHING === 'on') {
      const buffered = await pushToBatch('meta', { url, body: payload });
      if (buffered) {
        return {
          status: 'sent', // sent = buffered for async dispatch
          httpStatus: 202, // Accepted
          attempts: 0,
          latencyMs: Date.now() - startedAt,
        };
      }
      // Si push Redis fail (Redis down) → fallback dispatch direct
    }

    const result = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
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
    return `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${provider.pixelId}');fbq('track','PageView');`;
  },
  cspHosts() {
    return {
      scriptSrc: ['https://connect.facebook.net'],
      connectSrc: ['https://www.facebook.com', 'https://graph.facebook.com'],
    };
  },
};
