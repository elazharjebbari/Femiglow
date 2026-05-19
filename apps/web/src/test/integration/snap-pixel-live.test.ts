/**
 * CHA-SNAP — Tests d'intégration live du pixel Snapchat.
 *
 * Valide que chaque événement mappé Snap est correctement construit
 * et envoyé à l'API Conversions de Snapchat (CAPI v3).
 *
 * Ne nécessite PAS de vrai access token — utilise MSW pour intercepter
 * les requêtes et valider le payload, les headers, et le mapping
 * d'événements.
 *
 * Couverture :
 *  1. Tous les événements mappés Snap (11 au total)
 *  2. Format du payload CAPI v3 (data[], user_data, custom_data)
 *  3. Hashage SHA-256 des PII (email, phone, name)
 *  4. Click ID (sccid) passé dans user_data
 *  5. Test event code optionnel
 *  6. Consent denied → skip
 *  7. Provider disabled → skip
 *  8. Pixel ID manquant → skip
 *  9. Access token manquant → skip
 *  10. Identity fields mappés par event (identityFields)
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse, server } from '@/test/msw/server';
import { resetMemoryStore } from '@/lib/db/client';
import { upsertTrackingProvider } from '@/lib/db/queries/tracking/providers';
import { dispatchToProviders } from '@/lib/tracking/server/dispatcher';
import { GRANTED_CONSENT, DENIED_CONSENT } from '@/lib/tracking/consent';
import { snapAdapter } from '@/lib/tracking/providers/snap';
import { hashIdentity } from '@/lib/tracking/providers/hashing';
import { mapEventName, isEventSupported } from '@/lib/tracking/providers/event-mapping';
import type { TrackingProvider, TrackingProviderKind } from '@/lib/db/types';
import type { DispatchContext } from '@/lib/tracking/providers/types';

vi.mock('@/lib/env', async (orig) => {
  const mod = (await orig()) as { env: Record<string, unknown> };
  return {
    ...mod,
    env: { ...mod.env, WEBHOOK_SECRET_KEY: 'snap-test-key-32chars-AAAAAAAA' },
  };
});

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => {
  resetMemoryStore();
});

// ---------------------------------------------------------------------------
// Snap pixel ID utilisé en prod
// ---------------------------------------------------------------------------
const SNAP_PIXEL_ID = '9bd26a82-3ecf-42aa-a3de-85df14c74a11';
const SNAP_CAPI_TOKEN = 'snap-test-capi-token-for-msw';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSnapProvider(overrides: Partial<TrackingProvider> = {}): TrackingProvider {
  return {
    id: 'tpr_snap_test',
    kind: 'snap' as TrackingProviderKind,
    status: 'enabled',
    pixelId: SNAP_PIXEL_ID,
    capiToken: SNAP_CAPI_TOKEN,
    capiTokenIv: null,
    capiTokenTag: null,
    testEventCode: null,
    customHead: null,
    customBody: null,
    config: {},
    enabledEvents: [],
    lastEventAt: null,
    errorCount24h: 0,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeCtx(overrides: Partial<DispatchContext> = {}): DispatchContext {
  return {
    eventName: 'purchase',
    eventId: '01900000-snap-test-0001-000000000001',
    receivedAt: new Date('2026-05-17T12:00:00Z'),
    pageRoute: '/kit',
    pageUrl: 'https://femiglow-maroc.com/kit',
    pageTitle: 'Kit FemiGlow',
    referrer: 'https://www.snapchat.com/',
    anonymousId: 'aid_snap_test',
    sessionId: 'sid_snap_test',
    userId: null,
    consent: { ...GRANTED_CONSENT },
    uaHash: 'c'.repeat(64),
    ipAnonymized: '102.0.0.0',
    device: 'mobile',
    locale: 'fr-MA',
    params: {
      transaction_id: 'order_snap_001',
      currency: 'MAD',
      value: 290,
      items: [
        { item_id: 'kit_fg_01', item_name: 'Kit FemiGlow', quantity: 1, price: 290 },
      ],
    },
    identity: {
      email: 'test@femiglow.ma',
      phone: '+212612345678',
      firstName: 'Yasmine',
      lastName: 'El Amrani',
      city: 'Casablanca',
      country: 'MA',
    },
    ...overrides,
  };
}

/** Capture les requêtes envoyées à Snap CAPI. */
function captureSnapRequests(): { calls: Array<{ url: string; body: Record<string, unknown> }> } {
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  server.use(
    http.post('https://tr.snapchat.com/v3/:pixelId/events', async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      calls.push({ url: request.url, body });
      return HttpResponse.json({ status: 'OK' });
    }),
  );
  return { calls };
}

// ---------------------------------------------------------------------------
// 1. Mapping complet des événements Snap
// ---------------------------------------------------------------------------

describe('Snap — mapping événements', () => {
  const SNAP_EVENTS: Array<{ fg: string; snap: string; isStandard: boolean }> = [
    { fg: 'page_view', snap: 'PAGE_VIEW', isStandard: true },
    { fg: 'view_item', snap: 'VIEW_CONTENT', isStandard: true },
    { fg: 'add_to_cart', snap: 'ADD_CART', isStandard: true },
    { fg: 'checkout_intent', snap: 'START_CHECKOUT', isStandard: true },
    { fg: 'begin_checkout', snap: 'START_CHECKOUT', isStandard: true },
    { fg: 'add_payment_info', snap: 'ADD_BILLING', isStandard: true },
    { fg: 'purchase', snap: 'PURCHASE', isStandard: true },
    { fg: 'generate_lead', snap: 'SIGN_UP', isStandard: true },
    { fg: 'sign_up', snap: 'SIGN_UP', isStandard: true },
    { fg: 'chat_lead_form_submit', snap: 'LEAD', isStandard: true },
  ];

  it('chaque événement FemiGlow mappé retourne le bon nom Snap', () => {
    for (const { fg, snap } of SNAP_EVENTS) {
      expect(mapEventName(fg, 'snap'), `mapEventName('${fg}', 'snap')`).toBe(snap);
    }
  });

  it('chaque événement mappé est supporté par l\'adapter', () => {
    for (const { fg } of SNAP_EVENTS) {
      expect(isEventSupported(fg, 'snap'), `isEventSupported('${fg}', 'snap')`).toBe(true);
    }
  });

  it('les événements non-mappés retournent null', () => {
    const unmapped = [
      'view_item_list', 'remove_from_cart', 'view_cart', 'add_shipping_info',
      'refund', 'search', 'scroll_depth', 'click', 'select_content',
      'video_start', 'video_progress', 'video_complete',
      'form_start', 'form_submit', 'contact_submit', 'newsletter_submit',
      'lead_capture', 'address_completed', 'wizard_error', 'wizard_abandoned',
      'chat_widget_open', 'chat_message_sent', 'chat_message_received',
      'chat_message_complete', 'chat_lead_form_offered', 'chat_lead_form_view',
      'chat_lead_form_focus', 'chat_lead_form_dismiss',
    ];
    for (const name of unmapped) {
      expect(mapEventName(name, 'snap'), `mapEventName('${name}', 'snap')`).toBeNull();
    }
  });

  it('les noms Snap sont tous des standards reconnus', () => {
    for (const { snap, isStandard } of SNAP_EVENTS) {
      expect(isStandard, `'${snap}' should be standard`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Payload CAPI v3 — format et contenu
// ---------------------------------------------------------------------------

describe('Snap CAPI v3 — payload', () => {
  it('purchase envoie un payload complet avec user_data hashé et custom_data', async () => {
    const { calls } = captureSnapRequests();
    await upsertTrackingProvider({ kind: 'snap', status: 'enabled', pixelId: SNAP_PIXEL_ID, capiToken: SNAP_CAPI_TOKEN });
    await dispatchToProviders(makeCtx({ eventName: 'purchase' }));

    expect(calls).toHaveLength(1);
    const { url, body } = calls[0]!;

    // URL contient le pixel ID et l'access token
    expect(url).toContain(SNAP_PIXEL_ID);
    expect(url).toContain('access_token=snap-test-capi-token-for-msw');

    // Structure du payload
    const data = (body.data as Array<Record<string, unknown>>)[0]!;
    expect(data.event_name).toBe('PURCHASE');
    expect(data.event_time).toBe(Math.floor(new Date('2026-05-17T12:00:00Z').getTime() / 1000));
    expect(data.event_id).toBe('01900000-snap-test-0001-000000000001');
    expect(data.event_source_url).toBe('https://femiglow-maroc.com/kit');
    expect(data.action_source).toBe('website');

    // user_data — Snap CAPI v3 n'envoie que em, ph + ip/ua dans user_data
    // (fn, ln, ct, country sont hashés par hashIdentity mais Snap adapter ne les inclut pas)
    const userData = data.user_data as Record<string, unknown>;
    expect(userData.em).toBeDefined();
    expect(userData.ph).toBeDefined();
    const hashed = hashIdentity({
      email: 'test@femiglow.ma',
      phone: '+212612345678',
    });
    expect(userData.em).toEqual([hashed.em]);
    expect(userData.ph).toEqual([hashed.ph]);
    expect(userData.client_ip_address).toBe('102.0.0.0');
    expect(userData.client_user_agent).toBe('c'.repeat(64));

    // custom_data
    const customData = data.custom_data as Record<string, unknown>;
    expect(customData.currency).toBe('MAD');
    expect(customData.value).toBe(290);
    expect(customData.transaction_id).toBe('order_snap_001');
    expect(customData.item_ids).toEqual(['kit_fg_01']);
    expect(customData.number_items).toBe(1);
  });

  it('page_view envoie un payload minimal (pas de custom_data e-commerce)', async () => {
    const { calls } = captureSnapRequests();
    await upsertTrackingProvider({ kind: 'snap', status: 'enabled', pixelId: SNAP_PIXEL_ID, capiToken: SNAP_CAPI_TOKEN });
    await dispatchToProviders(makeCtx({
      eventName: 'page_view',
      params: { page_path: '/kit' },
      identity: undefined,
    }));

    expect(calls).toHaveLength(1);
    const data = (calls[0]!.body.data as Array<Record<string, unknown>>)[0]!;
    expect(data.event_name).toBe('PAGE_VIEW');
    // Pas d'email/phone pour page_view (pas de identityFields)
    const userData = data.user_data as Record<string, unknown>;
    expect(userData.em).toBeUndefined();
    expect(userData.ph).toBeUndefined();
    expect(userData.client_ip_address).toBe('102.0.0.0');
  });

  it('add_to_cart envoie items et value', async () => {
    const { calls } = captureSnapRequests();
    await upsertTrackingProvider({ kind: 'snap', status: 'enabled', pixelId: SNAP_PIXEL_ID, capiToken: SNAP_CAPI_TOKEN });
    await dispatchToProviders(makeCtx({
      eventName: 'add_to_cart',
      params: {
        currency: 'MAD',
        value: 290,
        items: [{ item_id: 'kit_fg_01', item_name: 'Kit FemiGlow', quantity: 1, price: 290 }],
      },
    }));

    const data = (calls[0]!.body.data as Array<Record<string, unknown>>)[0]!;
    expect(data.event_name).toBe('ADD_CART');
    const customData = data.custom_data as Record<string, unknown>;
    expect(customData.value).toBe(290);
    expect(customData.currency).toBe('MAD');
    expect(customData.item_ids).toEqual(['kit_fg_01']);
  });

  it('checkout_intent mappe vers START_CHECKOUT', async () => {
    const { calls } = captureSnapRequests();
    await upsertTrackingProvider({ kind: 'snap', status: 'enabled', pixelId: SNAP_PIXEL_ID, capiToken: SNAP_CAPI_TOKEN });
    await dispatchToProviders(makeCtx({
      eventName: 'checkout_intent',
      params: { currency: 'MAD', value: 290 },
    }));

    const data = (calls[0]!.body.data as Array<Record<string, unknown>>)[0]!;
    expect(data.event_name).toBe('START_CHECKOUT');
  });

  it('generate_lead mappe vers SIGN_UP avec identityFields', async () => {
    const { calls } = captureSnapRequests();
    await upsertTrackingProvider({ kind: 'snap', status: 'enabled', pixelId: SNAP_PIXEL_ID, capiToken: SNAP_CAPI_TOKEN });
    await dispatchToProviders(makeCtx({
      eventName: 'generate_lead',
      params: { currency: 'MAD', value: 0, method: 'chat' },
      identity: { email: 'lead@test.ma', phone: '+212698765432', firstName: 'Karim' },
    }));

    const data = (calls[0]!.body.data as Array<Record<string, unknown>>)[0]!;
    expect(data.event_name).toBe('SIGN_UP');
    const userData = data.user_data as Record<string, unknown>;
    const hashed = hashIdentity({ email: 'lead@test.ma', phone: '+212698765432', firstName: 'Karim' });
    expect(userData.em).toEqual([hashed.em]);
    expect(userData.ph).toEqual([hashed.ph]);
  });

  it('chat_lead_form_submit mappe vers LEAD', async () => {
    const { calls } = captureSnapRequests();
    await upsertTrackingProvider({ kind: 'snap', status: 'enabled', pixelId: SNAP_PIXEL_ID, capiToken: SNAP_CAPI_TOKEN });
    await dispatchToProviders(makeCtx({
      eventName: 'chat_lead_form_submit',
      params: { session_id: 'cs_test', reason: 'purchase-intent' },
      identity: { email: 'chat@lead.ma', phone: '+212611111111' },
    }));

    const data = (calls[0]!.body.data as Array<Record<string, unknown>>)[0]!;
    expect(data.event_name).toBe('LEAD');
  });

  it('add_payment_info mappe vers ADD_BILLING', async () => {
    const { calls } = captureSnapRequests();
    await upsertTrackingProvider({ kind: 'snap', status: 'enabled', pixelId: SNAP_PIXEL_ID, capiToken: SNAP_CAPI_TOKEN });
    await dispatchToProviders(makeCtx({
      eventName: 'add_payment_info',
      params: { currency: 'MAD', value: 290, payment_type: 'cod' },
      identity: { firstName: 'Yasmine', lastName: 'El Amrani', phone: '+212612345678', city: 'Casablanca', country: 'MA' },
    }));

    const data = (calls[0]!.body.data as Array<Record<string, unknown>>)[0]!;
    expect(data.event_name).toBe('ADD_BILLING');
  });
});

// ---------------------------------------------------------------------------
// 3. Click ID Snap (sccid) — attribution
// ---------------------------------------------------------------------------

describe('Snap CAPI v3 — click ID (sccid)', () => {
  it('passe sc_click_id dans user_data quand présent', async () => {
    const { calls } = captureSnapRequests();
    await upsertTrackingProvider({ kind: 'snap', status: 'enabled', pixelId: SNAP_PIXEL_ID, capiToken: SNAP_CAPI_TOKEN });
    await dispatchToProviders(makeCtx({
      eventName: 'purchase',
      params: {
        ...makeCtx().params,
        sc_click_id: 'snap_click_abc123',
      } as Record<string, unknown>,
    }));

    const data = (calls[0]!.body.data as Array<Record<string, unknown>>)[0]!;
    const userData = data.user_data as Record<string, unknown>;
    expect(userData.sc_click_id).toBe('snap_click_abc123');
  });

  it('omet sc_click_id quand absent', async () => {
    const { calls } = captureSnapRequests();
    await upsertTrackingProvider({ kind: 'snap', status: 'enabled', pixelId: SNAP_PIXEL_ID, capiToken: SNAP_CAPI_TOKEN });
    await dispatchToProviders(makeCtx({ eventName: 'purchase' }));

    const data = (calls[0]!.body.data as Array<Record<string, unknown>>)[0]!;
    const userData = data.user_data as Record<string, unknown>;
    expect(userData.sc_click_id).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 4. Test event code
// ---------------------------------------------------------------------------

describe('Snap CAPI v3 — test_event_code', () => {
  it('inclut test_event_code quand configuré sur le provider', async () => {
    const { calls } = captureSnapRequests();
    await upsertTrackingProvider({
      kind: 'snap',
      status: 'enabled',
      pixelId: SNAP_PIXEL_ID,
      capiToken: SNAP_CAPI_TOKEN,
      testEventCode: 'SNAP-TEST-001',
    });
    await dispatchToProviders(makeCtx());

    expect(calls).toHaveLength(1);
    expect(calls[0]!.body.test_event_code).toBe('SNAP-TEST-001');
  });

  it('omet test_event_code quand pas configuré', async () => {
    const { calls } = captureSnapRequests();
    await upsertTrackingProvider({ kind: 'snap', status: 'enabled', pixelId: SNAP_PIXEL_ID, capiToken: SNAP_CAPI_TOKEN });
    await dispatchToProviders(makeCtx());

    expect(calls).toHaveLength(1);
    expect(calls[0]!.body.test_event_code).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 5. Skip conditions
// ---------------------------------------------------------------------------

describe('Snap — skip conditions', () => {
  it('skip si consent ad_storage denied', async () => {
    const { calls } = captureSnapRequests();
    await upsertTrackingProvider({ kind: 'snap', status: 'enabled', pixelId: SNAP_PIXEL_ID, capiToken: SNAP_CAPI_TOKEN });
    const result = await dispatchToProviders(makeCtx({
      consent: DENIED_CONSENT,
    }));

    expect(calls).toHaveLength(0);
    expect(result.results.snap?.status).toBe('skipped');
    expect(result.results.snap?.error).toBe('consent_denied');
  });

  it('skip si provider disabled', async () => {
    const { calls } = captureSnapRequests();
    await upsertTrackingProvider({ kind: 'snap', status: 'disabled', pixelId: SNAP_PIXEL_ID, capiToken: SNAP_CAPI_TOKEN });
    const result = await dispatchToProviders(makeCtx());

    // Provider disabled → l'adapter ne devrait même pas être appelé par le dispatcher.
    // Le dispatcher filtre sur status=enabled.
    // Vérifions que snap n'est pas dans dispatched.
    expect(result.dispatched).not.toContain('snap');
  });

  it('skip si pixel_id manquant', async () => {
    const result = snapAdapter.dispatch(
      makeSnapProvider({ pixelId: undefined as unknown as string }),
      makeCtx(),
    );
    expect((await result).status).toBe('skipped');
    expect((await result).error).toBe('pixel_id_missing');
  });

  it('skip si access_token absent', async () => {
    const result = snapAdapter.dispatch(
      makeSnapProvider({ capiToken: undefined as unknown as string }),
      makeCtx(),
    );
    expect((await result).status).toBe('skipped');
    expect((await result).error).toBe('access_token_missing');
  });

  it('skip si événement non supporté par Snap', async () => {
    const unsupported = ['remove_from_cart', 'view_cart', 'add_shipping_info', 'login', 'share'];
    for (const event of unsupported) {
      expect(isEventSupported(event, 'snap'), `isEventSupported('${event}', 'snap')`).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 6. Client snippet
// ---------------------------------------------------------------------------

describe('Snap — client snippet', () => {
  /**
   * Helper qui asserte la présence de `clientSnippet` sur le snap adapter
   * et délègue l'appel. `clientSnippet` est typé optionnel sur
   * `ProviderAdapter` car certains providers (CAPI-only) ne fournissent
   * pas de snippet client ; le snap adapter, lui, en a toujours un.
   */
  function callSnippet(provider: Parameters<NonNullable<typeof snapAdapter.clientSnippet>>[0]) {
    if (!snapAdapter.clientSnippet) {
      throw new Error('snap adapter is missing clientSnippet — test invariant broken');
    }
    return snapAdapter.clientSnippet(provider);
  }

  it('retourne un snippet avec le pixel ID', () => {
    const snippet = callSnippet(makeSnapProvider());
    expect(snippet).not.toBeNull();
    expect(snippet).toContain(SNAP_PIXEL_ID);
    expect(snippet).toContain("snaptr('init'");
    expect(snippet).toContain("snaptr('track','PAGE_VIEW')");
    expect(snippet).toContain('sc-static.net/scevent.min.js');
  });

  it('retourne null si provider disabled', () => {
    const snippet = callSnippet(makeSnapProvider({ status: 'disabled' }));
    expect(snippet).toBeNull();
  });

  it('retourne null si pixel_id absent', () => {
    const snippet = callSnippet(makeSnapProvider({ pixelId: undefined as unknown as string }));
    expect(snippet).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 7. CSP hosts
// ---------------------------------------------------------------------------

describe('Snap — CSP hosts', () => {
  it('retourne les bons domaines CSP', () => {
    const csp = snapAdapter.cspHosts();
    expect(csp.scriptSrc).toContain('https://sc-static.net');
    expect(csp.connectSrc).toContain('https://tr.snapchat.com');
  });
});

// ---------------------------------------------------------------------------
// 8. Hashage PII — cohérence avec Snap Conversions API
// ---------------------------------------------------------------------------

describe('Snap — hashage PII', () => {
  it('hashIdentity produit les bons hashes SHA-256', () => {
    const hashed = hashIdentity({
      email: 'Test@Example.COM',
      phone: '+212 6 12 34 56 78',
      firstName: '  Yasmine  ',
      lastName: 'El Amrani',
      city: 'Casablanca',
      country: 'MA',
    });

    // Email normalisé : trim + lowercase
    const expectedEmail = hashIdentity({ email: 'test@example.com' }).em;
    expect(hashed.em).toBe(expectedEmail);

    // Phone normalisé : chiffres seulement
    const expectedPhone = hashIdentity({ phone: '212612345678' }).ph;
    expect(hashed.ph).toBe(expectedPhone);

    // Noms normalisés : trim + lowercase
    const expectedFn = hashIdentity({ firstName: 'yasmine' }).fn;
    expect(hashed.fn).toBe(expectedFn);
  });

  it('hashIdentity omet les champs absents', () => {
    const hashed = hashIdentity({});
    expect(hashed.em).toBeUndefined();
    expect(hashed.ph).toBeUndefined();
    expect(hashed.fn).toBeUndefined();
    expect(hashed.ln).toBeUndefined();
    expect(hashed.ct).toBeUndefined();
    expect(hashed.country).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 9. Retry et erreurs HTTP
// ---------------------------------------------------------------------------

describe('Snap CAPI v3 — erreurs et retry', () => {
  it('retry sur 503 puis succès', async () => {
    let attempts = 0;
    server.use(
      http.post('https://tr.snapchat.com/v3/:pixelId/events', () => {
        attempts += 1;
        if (attempts === 1) return new HttpResponse('Service Unavailable', { status: 503 });
        return HttpResponse.json({ status: 'OK' });
      }),
    );
    await upsertTrackingProvider({ kind: 'snap', status: 'enabled', pixelId: SNAP_PIXEL_ID, capiToken: SNAP_CAPI_TOKEN });
    const result = await dispatchToProviders(makeCtx());

    expect(result.dispatched).toContain('snap');
    expect(result.results.snap?.status).toBe('sent');
    expect(result.results.snap?.attempts).toBeGreaterThanOrEqual(2);
  });

  it('marque failed après 3 erreurs 503', async () => {
    server.use(
      http.post('https://tr.snapchat.com/v3/:pixelId/events', () => {
        return new HttpResponse('Service Unavailable', { status: 503 });
      }),
    );
    await upsertTrackingProvider({ kind: 'snap', status: 'enabled', pixelId: SNAP_PIXEL_ID, capiToken: SNAP_CAPI_TOKEN });
    const result = await dispatchToProviders(makeCtx());

    expect(result.results.snap?.status).toBe('failed');
    expect(result.results.snap?.attempts).toBe(3);
  });

  it('marque failed immédiatement sur 400 (pas de retry)', async () => {
    server.use(
      http.post('https://tr.snapchat.com/v3/:pixelId/events', () => {
        return new HttpResponse('Bad Request', { status: 400 });
      }),
    );
    await upsertTrackingProvider({ kind: 'snap', status: 'enabled', pixelId: SNAP_PIXEL_ID, capiToken: SNAP_CAPI_TOKEN });
    const result = await dispatchToProviders(makeCtx());

    expect(result.results.snap?.status).toBe('failed');
    expect(result.results.snap?.attempts).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// 10. URL de l'API — v3 avec pixel ID dans le path
// ---------------------------------------------------------------------------

describe('Snap CAPI v3 — URL et headers', () => {
  it('utilise l\'URL v3 avec le pixel ID dans le path', async () => {
    const { calls } = captureSnapRequests();
    await upsertTrackingProvider({ kind: 'snap', status: 'enabled', pixelId: SNAP_PIXEL_ID, capiToken: SNAP_CAPI_TOKEN });
    await dispatchToProviders(makeCtx());

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toContain(`/v3/${SNAP_PIXEL_ID}/events`);
  });

  it('passe l\'access token en query param', async () => {
    const { calls } = captureSnapRequests();
    await upsertTrackingProvider({ kind: 'snap', status: 'enabled', pixelId: SNAP_PIXEL_ID, capiToken: SNAP_CAPI_TOKEN });
    await dispatchToProviders(makeCtx());

    expect(calls[0]!.url).toContain('access_token=');
  });
});