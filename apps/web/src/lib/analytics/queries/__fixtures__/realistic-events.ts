/**
 * Fixture partagée des tests d'audit analytics (docs/analytics-audit-2026-06-04).
 *
 * `seedRealisticEvents()` sème dans le `memoryStore` un jeu d'événements calqué
 * sur la prod (cf. evidence-db-2026-06-04.txt : view_item=339, begin_checkout=97,
 * purchase=13…) — SANS aucun event « engage » que l'agrégation attend mais qui
 * n'est jamais émis/stocké : page_view, scroll_depth, cta_impression, cta_click,
 * view_cart. C'est ce désalignement que les tests de reproduction épinglent.
 *
 * Conventions : sessions distinctes, NOW figé (caller), tout consentement
 * granted sauf override explicite.
 *
 * NB : fichier hors `*.test.ts` volontairement — l'importer depuis un fichier de
 * test ne déclenche PAS la collecte d'autres suites.
 */
import { memoryStore } from '@/lib/db/client';
import type { TrackingEventLogEntry } from '@/lib/db/types';

/** Borne basse de la fenêtre figée utilisée par les tests d'audit. */
export const AUDIT_FROM = new Date('2026-06-04T00:00:00Z');
/** NOW figé utilisé par les tests d'audit. */
export const AUDIT_NOW = new Date('2026-06-04T12:00:00Z');

export interface PushOpts {
  id: string;
  sessionId: string;
  anonymousId?: string;
  eventName: TrackingEventLogEntry['eventName'];
  componentId?: string | null;
  pageRoute?: string;
  receivedAt?: Date;
  payload?: Record<string, unknown>;
  device?: TrackingEventLogEntry['device'];
  eventCategory?: TrackingEventLogEntry['eventCategory'];
  consentDenied?: boolean;
}

/** Insère un event tracking dans le memoryStore (shape complète). */
export function pushEvent(opts: PushOpts): void {
  const store = memoryStore();
  const entry: TrackingEventLogEntry = {
    id: opts.id,
    eventId: `evt_${opts.id}`,
    eventName: opts.eventName,
    eventCategory: opts.eventCategory ?? 'ecommerce',
    pageId: null,
    componentId: opts.componentId ?? null,
    pageRoute: opts.pageRoute ?? '/kit',
    anonymousId: opts.anonymousId ?? `anon_${opts.sessionId}`,
    sessionId: opts.sessionId,
    userId: null,
    consentSnapshot: {
      ad_storage: 'denied',
      analytics_storage: opts.consentDenied ? 'denied' : 'granted',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      functional_storage: 'granted',
    },
    payload: opts.payload ?? {},
    uaHash: 'ua',
    ipAnonymized: '0.0.0.0',
    device: opts.device ?? 'mobile',
    locale: 'fr-FR',
    isConversion: opts.eventName === 'purchase',
    providersDispatched: [],
    providersResults: {},
    receivedAt: opts.receivedAt ?? new Date(AUDIT_FROM.getTime() + 60_000),
    schemaVersion: 1,
    trafficSource: null,
    trafficMedium: null,
    experimentId: null,
    experimentVariant: null,
  };
  store.trackingEventsLog.set(entry.id, entry);
  store.trackingEventsLogOrder.push(entry.id);
}

/**
 * Sème la fixture « réaliste prod ». Sessions distinctes, NOW figé, tout consenti :
 *  - 3 sessions atteignent purchase (view_item → add_to_cart → begin_checkout →
 *    address_completed → add_payment_info → purchase) ; ZÉRO engage event.
 *  - 1 session generate_lead (conversion COD lead) + view_item.
 *  - 1 session lead_capture (étape wizard) + view_item.
 *  - 5 sessions begin_checkout seules (abandons) + view_item.
 *  - 4 sessions view_item seules.
 *
 * → view_item présent partout ; begin_checkout multi-sessions ; add_to_cart,
 * address_completed, add_payment_info, purchase, generate_lead, lead_capture
 * présents. AUCUN page_view / scroll_depth / cta_impression / cta_click /
 * view_cart.
 */
export function seedRealisticEvents(): void {
  let n = 0;
  const id = () => `e${n++}`;
  const at = (minutes: number) => new Date(AUDIT_FROM.getTime() + minutes * 60_000);

  // 3 sessions converties (full path, sans engage).
  for (let i = 0; i < 3; i += 1) {
    const sid = `buy_${i}`;
    pushEvent({ id: id(), sessionId: sid, eventName: 'view_item', pageRoute: '/kit', receivedAt: at(1) });
    pushEvent({ id: id(), sessionId: sid, eventName: 'add_to_cart', receivedAt: at(2) });
    pushEvent({ id: id(), sessionId: sid, eventName: 'begin_checkout', receivedAt: at(3) });
    pushEvent({ id: id(), sessionId: sid, eventName: 'address_completed', receivedAt: at(4), payload: { currency: 'MAD' } });
    pushEvent({ id: id(), sessionId: sid, eventName: 'add_payment_info', receivedAt: at(5) });
    pushEvent({ id: id(), sessionId: sid, eventName: 'purchase', receivedAt: at(6), payload: { value: 320 } });
  }

  // 1 session generate_lead (conversion COD lead) + view_item.
  pushEvent({ id: id(), sessionId: 'lead_conv', eventName: 'view_item', pageRoute: '/kit', receivedAt: at(10) });
  pushEvent({ id: id(), sessionId: 'lead_conv', eventName: 'generate_lead', receivedAt: at(11) });

  // 1 session lead_capture (étape wizard) + view_item.
  pushEvent({ id: id(), sessionId: 'lead_cap', eventName: 'view_item', pageRoute: '/kit', receivedAt: at(12) });
  pushEvent({ id: id(), sessionId: 'lead_cap', eventName: 'lead_capture', receivedAt: at(13) });

  // 5 sessions begin_checkout seules (abandon).
  for (let i = 0; i < 5; i += 1) {
    const sid = `bc_${i}`;
    pushEvent({ id: id(), sessionId: sid, eventName: 'view_item', pageRoute: '/kit', receivedAt: at(20 + i) });
    pushEvent({ id: id(), sessionId: sid, eventName: 'begin_checkout', receivedAt: at(20 + i + 0.5) });
  }

  // 4 sessions view_item seules.
  for (let i = 0; i < 4; i += 1) {
    pushEvent({ id: id(), sessionId: `view_${i}`, eventName: 'view_item', pageRoute: '/kit', receivedAt: at(30 + i) });
  }
}
