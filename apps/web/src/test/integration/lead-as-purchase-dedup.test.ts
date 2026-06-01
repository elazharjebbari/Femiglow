/**
 * Suite d'intégration APPROFONDIE — pont lead→Meta Purchase (anti-doublon).
 * Audit meta-lead-as-purchase-2026-06-01 + Fix dédup (event_id client préservé).
 *
 * Niveau API/CAPI : traverse le VRAI handler `POST /api/track` → dispatcher →
 * adapter Meta → `fetch` graph.facebook.com intercepté par MSW. On vérifie sur
 * le PAYLOAD CAPI réel :
 *  1. lead chat / panier (generate_lead éligible) → Meta `Purchase` (event_id de parcours).
 *  2. `purchase` qui suit le même visiteur → Meta NON envoyé (supprimé) ⇒ 0 doublon.
 *  3. `purchase` SANS lead → Meta `Purchase` avec l'event_id CLIENT (dédup native Pixel↔CAPI).
 *  4. lead newsletter (non éligible) → Meta `Lead`, jamais `Purchase`.
 *  5. 2 leads du même visiteur → MÊME event_id de parcours ⇒ dédup native Meta.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Flag ON : vrai env (defaults valides) + override du flag d'activation.
import { vi } from 'vitest';
vi.mock('@/lib/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/env')>();
  return { ...actual, env: { ...actual.env, META_LEAD_AS_PURCHASE_ENABLED: 'true' } };
});

import { server, http, HttpResponse } from '@/test/msw/server';
import { POST } from '@/app/api/track/route';
import { resetMemoryStore } from '@/lib/db/client';
import { clearDedupCache } from '@/lib/tracking/server/dedup';
import { upsertTrackingProvider } from '@/lib/db/queries/tracking/providers';
import {
  deriveMetaPurchaseJourneyId,
  __clearLeadAsPurchaseLedger,
} from '@/lib/tracking/server/lead-as-purchase';
import { uuidv7 } from '@/lib/tracking/uuid';
import type { TrackingConsentState } from '@/lib/db/types';

const GRANTED: TrackingConsentState = {
  ad_storage: 'granted',
  analytics_storage: 'granted',
  ad_user_data: 'granted',
  ad_personalization: 'granted',
  functional_storage: 'granted',
};

/** Payloads CAPI Meta capturés (data[0]) — un par appel graph.facebook.com. */
let metaEvents: Array<Record<string, unknown>>;

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(async () => {
  resetMemoryStore();
  clearDedupCache();
  __clearLeadAsPurchaseLedger();
  metaEvents = [];
  server.use(
    http.post('https://graph.facebook.com/:version/:pixelId/events', async ({ request }) => {
      const body = (await request.json()) as { data?: Array<Record<string, unknown>> };
      for (const ev of body.data ?? []) metaEvents.push(ev);
      return HttpResponse.json({ events_received: body.data?.length ?? 0 });
    }),
  );
  await upsertTrackingProvider({ kind: 'meta', status: 'enabled', pixelId: '111', capiToken: 'tok_meta' });
});

function buildRequest(body: unknown, ip = '203.0.113.50') {
  return new Request('http://localhost/api/track', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
      'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      'accept-language': 'fr-MA,fr;q=0.9',
    },
    body: JSON.stringify(body),
  });
}

function event(over: Record<string, unknown> = {}) {
  return {
    event: 'page_view',
    event_id: uuidv7(),
    timestamp: new Date().toISOString(),
    schema_version: 1,
    consent: GRANTED,
    page: { url: 'https://femiglow-maroc.com/kit', path: '/kit', title: 'Kit', referrer: '', locale: 'fr-MA' },
    user: { anonymous_id: 'aid_default_0000000', session_id: 'sid_default_0000000' },
    params: {},
    ...over,
  };
}

const leadChat = (visitor: string, eventId = uuidv7()) =>
  event({
    event: 'generate_lead',
    event_id: eventId,
    user: { anonymous_id: visitor, session_id: `s_${visitor}` },
    params: { method: 'chat', value: 199, currency: 'MAD' },
  });

const leadCart = (visitor: string) =>
  event({
    event: 'generate_lead',
    user: { anonymous_id: visitor, session_id: `s_${visitor}` },
    params: { method: 'abandoned_cart', value: 249, currency: 'MAD' },
  });

const purchase = (visitor: string, eventId = uuidv7(), txn = 'tx_' + visitor) =>
  event({
    event: 'purchase',
    event_id: eventId,
    user: { anonymous_id: visitor, session_id: `s_${visitor}` },
    params: {
      transaction_id: txn,
      currency: 'MAD',
      value: 199,
      items: [{ item_id: 'kit', item_name: 'Kit', price: 199, quantity: 1, currency: 'MAD' }],
    },
  });

const metaNames = () => metaEvents.map((e) => e.event_name);

describe('API /api/track — pont lead→Meta Purchase (anti-doublon, CAPI réel via MSW)', () => {
  it('1. lead CHAT → 1 Meta Purchase avec event_id de parcours', async () => {
    const v = 'aid_chat_solo_001';
    const res = await POST(buildRequest({ events: [leadChat(v)] }));
    expect(res.status).toBe(202);
    expect(metaNames()).toEqual(['Purchase']); // generate_lead traduit en Purchase
    expect(metaEvents[0]?.event_id).toBe(deriveMetaPurchaseJourneyId(v));
    expect((metaEvents[0]?.custom_data as Record<string, unknown>)?.value).toBe(199);
  });

  it('2. lead CHAT puis PURCHASE (même visiteur) → 1 SEUL Meta Purchase (achat supprimé)', async () => {
    const v = 'aid_chat_then_buy_1';
    await POST(buildRequest({ events: [leadChat(v)] }));
    await POST(buildRequest({ events: [purchase(v)] }));
    // Le lead a compté ; l'achat réel NE rajoute PAS de Purchase CAPI.
    expect(metaEvents).toHaveLength(1);
    expect(metaNames()).toEqual(['Purchase']);
    expect(metaEvents[0]?.event_id).toBe(deriveMetaPurchaseJourneyId(v));
  });

  it('3. lead PANIER (abandoned_cart) puis PURCHASE → 1 seul Meta Purchase', async () => {
    const v = 'aid_cart_then_buy_1';
    await POST(buildRequest({ events: [leadCart(v)] }));
    await POST(buildRequest({ events: [purchase(v)] }));
    expect(metaEvents).toHaveLength(1);
    expect(metaNames()).toEqual(['Purchase']);
  });

  it('4. PURCHASE sans lead → Meta Purchase avec event_id CLIENT (dédup Pixel↔CAPI, PAS le journeyId)', async () => {
    const v = 'aid_direct_buy_1';
    const clientEventId = uuidv7();
    await POST(buildRequest({ events: [purchase(v, clientEventId)] }));
    expect(metaNames()).toEqual(['Purchase']);
    // Régression Fix A : l'event_id CAPI = event_id client (partagé avec le pixel)
    // → Meta déduplique nativement. Surtout PAS le journeyId.
    expect(metaEvents[0]?.event_id).toBe(clientEventId);
    expect(metaEvents[0]?.event_id).not.toBe(deriveMetaPurchaseJourneyId(v));
  });

  it('5. lead NEWSLETTER (non éligible) → Meta Lead, JAMAIS Purchase', async () => {
    const v = 'aid_newsletter_1';
    await POST(
      buildRequest({
        events: [
          event({
            event: 'generate_lead',
            user: { anonymous_id: v, session_id: `s_${v}` },
            params: { method: 'newsletter' },
          }),
        ],
      }),
    );
    expect(metaNames()).not.toContain('Purchase');
    // generate_lead non éligible → mapping Meta normal = 'Lead'
    if (metaEvents.length) expect(metaEvents[0]?.event_name).toBe('Lead');
  });

  it('6. 2 leads du même visiteur (même fenêtre) → MÊME event_id de parcours (dédup native Meta)', async () => {
    const v = 'aid_double_lead_1';
    await POST(buildRequest({ events: [leadChat(v)] }));
    await POST(buildRequest({ events: [leadChat(v)] }));
    expect(metaEvents).toHaveLength(2);
    expect(metaNames()).toEqual(['Purchase', 'Purchase']);
    // Même event_id → Meta n'en compte qu'un.
    expect(metaEvents[0]?.event_id).toBe(metaEvents[1]?.event_id);
    expect(metaEvents[0]?.event_id).toBe(deriveMetaPurchaseJourneyId(v));
  });

  it('7. 2 visiteurs distincts → 2 Purchase avec event_id DIFFÉRENTS (pas de sur-dédup)', async () => {
    await POST(buildRequest({ events: [leadChat('aid_visitorA_1')] }));
    await POST(buildRequest({ events: [leadChat('aid_visitorB_1')] }));
    expect(metaEvents).toHaveLength(2);
    expect(metaEvents[0]?.event_id).not.toBe(metaEvents[1]?.event_id);
  });
});
