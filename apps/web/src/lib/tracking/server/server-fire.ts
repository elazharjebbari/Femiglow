/**
 * `serverFire` — déclenche un event tracking côté serveur Next.js et le
 * dispatche vers les providers (Meta CAPI, TikTok, Snap…) via
 * `dispatchToProviders()`. Conçu pour être appelé depuis un Server Component
 * (SSR de fiche produit, par ex.) en mode fire-and-forget.
 *
 * Objectif Phase 2 : combler l'asymétrie Pixel client / CAPI server signalée
 * par Meta (7 881 ViewContent de moins côté serveur sur 7 j). Le serveur
 * devient la source primaire CAPI (fiable, pas de Beacon/Adblock/consent JS
 * perdu), le Pixel client reste opportuniste. L'`event_id` est dérivé
 * déterministiquement → Meta dédup transparent.
 *
 * Différences avec `server-emit.ts` (sibling) :
 *  - `server-emit` PERSISTE en DB (`tracking_events_log`) sans dispatcher.
 *  - `server-fire` DISPATCHE vers les providers ET ⭐ PERSISTE EN DB
 *    depuis le sprint live-systems-fix-2026-05 (QW5).
 *    Référence : docs/live-systems-fix-2026-05/08-system-tracking.md
 *    Pourquoi : avant, les server-fire ne remontaient pas en
 *    /admin/analytics → asymétrie observabilité. Maintenant on persiste
 *    avec un discriminant `source='server_fire'` pour différencier.
 *
 * Respect RGPD : skippe si `consent.ad_storage !== 'granted'`. Bot UA skippé
 * (ne pollue pas Meta Events Manager). Sans `_fbp` ET sans `fg_session_id`,
 * on skippe aussi (matching identitaire impossible).
 *
 * cf. docs/meta-quality-audit-2026-05/01-design-conception.md §2.4
 */
import type { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers';
import type { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies';

import type { TrackingConsentState } from '@/lib/db/types';
import { DENIED_CONSENT } from '@/lib/tracking/consent';
import { deriveEventId } from '@/lib/tracking/event-id';
import { isBotRequest } from '@/lib/tracking/is-bot';
import { logger } from '@/lib/logging/logger';

import { dispatchToProviders } from './dispatcher';
import { anonymizeIp, hashUserAgent, parseDevice } from './enricher';
import { logEvent } from '@/lib/db/queries/tracking/events-log';
import { createId } from '@/lib/ids';
import { getEventCategory } from '@/lib/tracking/schemas';

/** Catégorie d'event tracking — alignée sur `TrackingEventCategory`. */
type ServerFireCategory = 'page' | 'engagement' | 'ecommerce' | 'lead' | 'custom';

export interface ServerFireInput {
  /** Nom canonique d'event (ex: 'view_item'). */
  eventName: string;
  /** Slug stable de la page d'origine (ex: 'kit', 'maison', 'rituel'). */
  pageId: string;
  /** Route Next.js (ex: '/kit'). */
  pageRoute: string;
  /** URL complète (ex: 'https://femiglow-maroc.com/kit'). */
  pageUrl: string;
  /** Params event (value, currency, items, …). */
  params: Record<string, unknown>;
  /** Headers Next.js issus de `headers()`. */
  headers: ReadonlyHeaders | Headers;
  /** Cookies Next.js issus de `cookies()`. */
  cookies: ReadonlyRequestCookies | { get: (name: string) => { value: string } | undefined };
  /** Catégorie (default: dérivée du nom — ecommerce pour view_item, etc.). */
  category?: ServerFireCategory;
}

export interface ServerFireResult {
  status: 'fired' | 'skipped';
  reason?:
    | 'bot_ua'
    | 'no_session'
    | 'consent_denied'
    | 'dispatch_threw';
  dispatched?: string[];
}

const ECOMMERCE_EVENTS = new Set([
  'view_item',
  'view_item_list',
  'select_item',
  'add_to_cart',
  'remove_from_cart',
  'view_cart',
  'begin_checkout',
  'add_shipping_info',
  'add_payment_info',
  'purchase',
  'refund',
]);

function categoryFor(eventName: string, override?: ServerFireCategory): ServerFireCategory {
  if (override) return override;
  if (ECOMMERCE_EVENTS.has(eventName)) return 'ecommerce';
  return 'custom';
}

function readConsentFromCookies(
  cookies: ServerFireInput['cookies'],
): TrackingConsentState {
  const raw = cookies.get('fg_consent')?.value;
  if (!raw) return DENIED_CONSENT;
  try {
    const decoded = decodeURIComponent(raw);
    const parsed = JSON.parse(decoded) as Partial<TrackingConsentState>;
    return { ...DENIED_CONSENT, ...parsed };
  } catch {
    return DENIED_CONSENT;
  }
}

function readIpFromHeaders(headers: ServerFireInput['headers']): string {
  const xff = headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  const xReal = headers.get('x-real-ip');
  if (xReal) return xReal.trim();
  return '0.0.0.0';
}

/**
 * Cœur du helper. Fire-and-forget : ne throw jamais, log les erreurs.
 */
export async function serverFire(input: ServerFireInput): Promise<ServerFireResult> {
  const ua = input.headers.get('user-agent') ?? '';
  if (isBotRequest(ua)) {
    return { status: 'skipped', reason: 'bot_ua' };
  }

  const fbp = input.cookies.get('_fbp')?.value;
  const fbc = input.cookies.get('_fbc')?.value;
  const sessionCookie = input.cookies.get('fg_session_id')?.value;
  const sessionId = sessionCookie ?? fbp;
  if (!sessionId) {
    return { status: 'skipped', reason: 'no_session' };
  }

  const consent = readConsentFromCookies(input.cookies);
  if (consent.ad_storage !== 'granted') {
    return { status: 'skipped', reason: 'consent_denied' };
  }

  const eventId = deriveEventId({
    eventName: input.eventName,
    sessionId,
    pageId: input.pageId,
  });

  const ip = readIpFromHeaders(input.headers);
  const acceptLanguage = input.headers.get('accept-language') ?? '';
  const locale = acceptLanguage.split(',')[0]?.split(';')[0]?.trim() || 'fr-MA';

  const receivedAt = new Date();
  const uaHash = hashUserAgent(ua);
  const ipAnonymized = anonymizeIp(ip);
  const device = parseDevice(ua);

  try {
    const outcome = await dispatchToProviders({
      eventName: input.eventName,
      eventId,
      receivedAt,
      pageRoute: input.pageRoute,
      pageUrl: input.pageUrl,
      anonymousId: sessionId,
      sessionId,
      userId: null,
      consent,
      uaHash,
      ipAnonymized,
      device,
      locale,
      params: input.params,
      ...(fbp ? { fbp } : {}),
      ...(fbc ? { fbc } : {}),
    });

    // ⭐ QW5 — Persistance tracking_events_log pour observabilité unifiée.
    // Fire-and-forget : ne doit jamais faire échouer le dispatch principal.
    // Le champ `source='server_fire'` distingue de 'client_fire' (default).
    // Référence : docs/live-systems-fix-2026-05/08-system-tracking.md § QW5
    try {
      await logEvent({
        id: createId('tev'),
        eventId,
        eventName: input.eventName,
        eventCategory: getEventCategory(input.eventName),
        pageId: input.pageId,
        pageRoute: input.pageRoute,
        anonymousId: sessionId,
        sessionId,
        userId: null,
        consentSnapshot: consent,
        payload: input.params,
        uaHash,
        ipAnonymized,
        device,
        locale,
        isConversion: input.eventName === 'purchase' || input.eventName === 'generate_lead',
        providersDispatched: outcome.dispatched ?? [],
        providersResults: (outcome.results ?? {}) as Record<string, never>,
        receivedAt,
        schemaVersion: 1,
      });
    } catch (persistErr) {
      // Logue mais ne fait pas échouer le serverFire (dispatch a réussi).
      logger.warn('tracking.server_fire.persist_failed', {
        event_name: input.eventName,
        error: persistErr instanceof Error ? persistErr.message : String(persistErr),
      });
    }

    return { status: 'fired', dispatched: outcome.dispatched };
  } catch (err) {
    logger.error('tracking.server_fire.failed', {
      event_name: input.eventName,
      page_id: input.pageId,
      category: categoryFor(input.eventName, input.category),
      error: err instanceof Error ? err.message : String(err),
    });
    return { status: 'skipped', reason: 'dispatch_threw' };
  }
}
