/**
 * CHA-260 — Tests d'intégration MSW pour le webhook outbound `order`.
 *
 * Vérifie que `dispatchOrderWebhook` :
 *   - produit le payload PLAT exact (id, full_name, phone, address,
 *     city, country, email, total_price, currency, quantity,
 *     product_name, product_variant, product_sku, note, source_channel,
 *     ip) ;
 *   - utilise les headers conventionnels (event, source, signature,
 *     idempotency-key) ;
 *   - dédupe sur l'idem-key (2e appel = court-circuit).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { http, HttpResponse, server } from '@/test/msw/server';
import type { ChatLeadRow } from '@/lib/chat/db/schema';

const envMock = vi.hoisted(() => ({
  OUTBOUND_WEBHOOK_URL: 'https://hook.example.com/outbound' as string | undefined,
  OUTBOUND_WEBHOOK_SECRET: 'outbound-secret-16chars+' as string | undefined,
  CHAT_LEAD_WEBHOOK_URL: undefined as string | undefined,
  CHAT_LEAD_WEBHOOK_SECRET: undefined as string | undefined,
  LOG_LEVEL: 'error' as const,
  DATABASE_URL: undefined as string | undefined,
}));

const leadRepoMock = vi.hoisted(() => ({
  markWebhookSent: vi.fn(async () => {}),
  markWebhookFailed: vi.fn(async () => {}),
}));

vi.mock('@/lib/env', () => ({ env: envMock }));
vi.mock('@/lib/logging/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock('@/lib/chat/repos/lead', () => ({ leadRepo: leadRepoMock }));

import { dispatchOrderWebhook } from '@/lib/webhooks/outbound/sources/from-order';
import { resetMemoryStore } from '@/lib/db/client';

function makeLead(over: Partial<ChatLeadRow> = {}): ChatLeadRow {
  const now = new Date('2026-05-13T12:00:00Z');
  return {
    id: 'cl_order_001',
    sessionId: 'cs_x',
    triggeringMessageId: null,
    triggerReason: 'purchase-intent',
    firstName: 'Youssef',
    phoneE164: '+212661234567',
    phoneRaw: '0661234567',
    note: null,
    consentVersion: '2026-05-06',
    consentAt: now,
    visitorId: 'v_x',
    fingerprintHash: null,
    page: '/produit',
    referrer: null,
    utm: null,
    language: 'fr',
    intentAtCapture: null,
    snapshotMessages: null,
    webhookStatus: 'pending',
    webhookAttempts: 0,
    webhookLastError: null,
    webhookSentAt: null,
    handledBy: null,
    handledAt: null,
    outcome: 'pending',
    convertedOrderId: null,
    lastName: null,
    email: 'y@example.com',
    emailVerifiedAt: null,
    emailConsent: false,
    shippingCity: 'Marrakech',
    shippingAddressLine1: '12 Rue Al Houda',
    shippingAddressLine2: null,
    shippingPostalCode: '40000',
    shippingCountry: 'MA',
    shippingNotes: 'Livraison urgente',
    preferredPaymentMethod: null,
    source: 'wizard_kit',
    formId: 'kit_femiglow_v1',
    formMode: 'wizard_embed',
    variantKey: null,
    gclid: null,
    fbp: null,
    fbc: null,
    cartSnapshot: null,
    cartTotalCents: null,
    cartCurrency: null,
    lastTouchedStep: 'address',
    leadCapturedAt: now,
    addressCompletedAt: now,
    paymentSelectedAt: now,
    purchasedAt: null,
    abandonWebhookAt: null,
    createdAt: now,
    updatedAt: now,
    ...over,
  } as ChatLeadRow;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  resetMemoryStore();
});
afterAll(() => server.close());

describe('dispatchOrderWebhook — payload PLAT complet', () => {
  it('envoie tous les champs documentés au receveur', async () => {
    const captured: { body?: string; idem?: string | null } = {};
    server.use(
      http.post('https://hook.example.com/outbound', async ({ request }) => {
        captured.body = await request.text();
        captured.idem = request.headers.get('idempotency-key');
        return HttpResponse.json({ ok: true });
      }),
    );

    const lead = makeLead();
    const result = await dispatchOrderWebhook({
      order: { id: 'ord_abc123', totalCents: 39900, currency: 'MAD' },
      items: [
        { sku: 'WTC-42', name: 'Montre', quantity: 1, variantKey: '42mm' },
      ],
      lead,
      shippingMode: 'standard',
      paymentMethod: 'cod',
      ip: '197.230.1.5',
    });
    expect(result.status).toBe('sent');
    expect(captured.idem).toBe('order:ord_abc123');

    const payload = JSON.parse(captured.body!) as Record<string, unknown>;
    expect(payload.id).toBe('ord_abc123');
    expect(payload.full_name).toBe('Youssef');
    expect(payload.phone).toBe('0661234567');
    expect(payload.address).toBe('12 Rue Al Houda');
    expect(payload.city).toBe('Marrakech');
    expect(payload.country).toBe('Maroc');
    expect(payload.email).toBe('y@example.com');
    expect(payload.total_price).toBe(399);
    expect(payload.currency).toBe('MAD');
    expect(payload.quantity).toBe(1);
    expect(payload.product_name).toBe('Montre');
    expect(payload.product_variant).toBe('42mm');
    expect(payload.product_sku).toBe('WTC-42');
    expect(payload.note).toContain('Livraison urgente');
    expect(payload.note).toContain('shipping:standard');
    expect(payload.note).toContain('payment:cod');
    expect(payload.source_channel).toBe('wizard_kit');
    expect(payload.ip).toBe('197.230.1.5');
  });

  it('agrège plusieurs items sur product_name + somme quantity', async () => {
    let received: Record<string, unknown> | null = null;
    server.use(
      http.post('https://hook.example.com/outbound', async ({ request }) => {
        received = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ok: true });
      }),
    );

    await dispatchOrderWebhook({
      order: { id: 'ord_multi', totalCents: 79800, currency: 'MAD' },
      items: [
        { sku: 'A1', name: 'Pack A', quantity: 2 },
        { sku: 'B1', name: 'Pack B', quantity: 1 },
      ],
      lead: makeLead({ id: 'cl_multi' }),
    });

    expect(received).not.toBeNull();
    expect(received!.product_name).toBe('Pack A + Pack B');
    expect(received!.product_sku).toBe('A1, B1');
    expect(received!.quantity).toBe(3);
    // Pas de product_variant quand plusieurs items.
    expect('product_variant' in received!).toBe(false);
  });
});

describe('dispatchOrderWebhook — idempotency court-circuit', () => {
  it('le 2e appel pour le même order ne déclenche pas de 2e POST', async () => {
    let calls = 0;
    server.use(
      http.post('https://hook.example.com/outbound', () => {
        calls += 1;
        return HttpResponse.json({ ok: true });
      }),
    );

    const lead = makeLead();
    const order = { id: 'ord_idem', totalCents: 19900, currency: 'MAD' };
    const items = [{ sku: 'X', name: 'Truc', quantity: 1 }];

    const a = await dispatchOrderWebhook({ order, items, lead });
    const b = await dispatchOrderWebhook({ order, items, lead });

    expect(a.status).toBe('sent');
    expect(b.status).toBe('sent');
    expect(calls).toBe(1);
  });
});

describe('dispatchOrderWebhook — sync chat_lead.webhook_status (/admin/leads)', () => {
  it('succès → markWebhookSent(leadId) (le lead converti sort de « En attente »)', async () => {
    server.use(
      http.post('https://hook.example.com/outbound', () => HttpResponse.json({ ok: true })),
    );

    await dispatchOrderWebhook({
      order: { id: 'ord_sent', totalCents: 19900, currency: 'MAD' },
      items: [{ sku: 'X', name: 'Truc', quantity: 1 }],
      lead: makeLead({ id: 'cl_sent_001' }),
    });

    expect(leadRepoMock.markWebhookSent).toHaveBeenCalledWith('cl_sent_001');
    expect(leadRepoMock.markWebhookFailed).not.toHaveBeenCalled();
  });

  it('aucun endpoint configuré → markWebhookFailed (jamais bloqué sur pending)', async () => {
    envMock.OUTBOUND_WEBHOOK_URL = undefined;
    try {
      await dispatchOrderWebhook({
        order: { id: 'ord_disabled', totalCents: 19900, currency: 'MAD' },
        items: [{ sku: 'X', name: 'Truc', quantity: 1 }],
        lead: makeLead({ id: 'cl_disabled_001' }),
      });
      expect(leadRepoMock.markWebhookFailed).toHaveBeenCalledWith(
        'cl_disabled_001',
        'webhook-not-configured',
      );
      expect(leadRepoMock.markWebhookSent).not.toHaveBeenCalled();
    } finally {
      envMock.OUTBOUND_WEBHOOK_URL = 'https://hook.example.com/outbound';
    }
  });

  it('téléphone invalide → markWebhookFailed (pas de pending fantôme)', async () => {
    await dispatchOrderWebhook({
      order: { id: 'ord_badphone', totalCents: 19900, currency: 'MAD' },
      items: [{ sku: 'X', name: 'Truc', quantity: 1 }],
      lead: makeLead({ id: 'cl_badphone_001', phoneE164: '', phoneRaw: 'abc' }),
    });

    expect(leadRepoMock.markWebhookFailed).toHaveBeenCalledWith(
      'cl_badphone_001',
      expect.stringContaining('invalid-phone'),
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PROMO — le CRM (Baiti → Trello) doit recevoir le total NET *et* savoir d'où
// vient l'écart avec le prix catalogue. Régression historique : les cartes
// Trello affichaient 199 MAD pour des commandes remisées à 99.
// ─────────────────────────────────────────────────────────────────────────────

describe('dispatchOrderWebhook — commande avec code promo', () => {
  function captureNext() {
    const captured: { body?: string } = {};
    server.use(
      http.post('https://hook.example.com/outbound', async ({ request }) => {
        captured.body = await request.text();
        return HttpResponse.json({ ok: true });
      }),
    );
    return captured;
  }

  it('PROMO-W1 total_price = NET, discount_amount et coupon_code renseignés', async () => {
    const captured = captureNext();
    const result = await dispatchOrderWebhook({
      // 199 MAD catalogue − 100 MAD de code = 99 MAD facturés.
      order: {
        id: 'ord_promo1',
        totalCents: 9900,
        currency: 'MAD',
        couponCode: 'GLOW99',
        discountCents: 10000,
      },
      items: [{ sku: 'FEMI-KIT-100', name: 'Pack FemiGlow', quantity: 1 }],
      lead: makeLead(),
      shippingMode: 'standard',
      paymentMethod: 'cod',
    });
    expect(result.status).toBe('sent');

    const payload = JSON.parse(captured.body!) as Record<string, unknown>;
    expect(payload.total_price).toBe(99);
    expect(payload.discount_amount).toBe(100);
    expect(payload.coupon_code).toBe('GLOW99');
    expect(payload.currency).toBe('MAD');
  });

  it('PROMO-W2 la note porte le code et le montant remisé (intégrations CRM legacy)', async () => {
    const captured = captureNext();
    await dispatchOrderWebhook({
      order: {
        id: 'ord_promo2',
        totalCents: 9900,
        currency: 'MAD',
        couponCode: 'GLOW99',
        discountCents: 10000,
      },
      items: [{ sku: 'FEMI-KIT-100', name: 'Pack FemiGlow', quantity: 1 }],
      lead: makeLead(),
      shippingMode: 'standard',
      paymentMethod: 'cod',
    });
    const payload = JSON.parse(captured.body!) as Record<string, unknown>;
    expect(payload.note).toContain('promo:GLOW99 -100 MAD');
  });

  it('PROMO-W3 code en minuscules / espaces → normalisé en MAJUSCULES', async () => {
    const captured = captureNext();
    await dispatchOrderWebhook({
      order: {
        id: 'ord_promo3',
        totalCents: 9900,
        currency: 'MAD',
        couponCode: '  glow99 ',
        discountCents: 10000,
      },
      items: [{ sku: 'FEMI-KIT-100', name: 'Pack FemiGlow', quantity: 1 }],
      lead: makeLead(),
    });
    const payload = JSON.parse(captured.body!) as Record<string, unknown>;
    expect(payload.coupon_code).toBe('GLOW99');
  });

  it('PROMO-W4 sans code → aucun champ promo pollué (non-régression)', async () => {
    const captured = captureNext();
    await dispatchOrderWebhook({
      order: { id: 'ord_nopromo', totalCents: 19900, currency: 'MAD', discountCents: 0 },
      items: [{ sku: 'FEMI-KIT-100', name: 'Pack FemiGlow', quantity: 1 }],
      lead: makeLead(),
      shippingMode: 'standard',
      paymentMethod: 'cod',
    });
    const payload = JSON.parse(captured.body!) as Record<string, unknown>;
    expect(payload.total_price).toBe(199);
    expect(payload).not.toHaveProperty('discount_amount');
    expect(payload).not.toHaveProperty('coupon_code');
    expect(String(payload.note ?? '')).not.toContain('promo:');
  });

  it('PROMO-W5 contexte legacy sans champs promo → payload inchangé', async () => {
    const captured = captureNext();
    await dispatchOrderWebhook({
      // Ancien appelant (outbox d'avant le correctif) : ni couponCode ni discountCents.
      order: { id: 'ord_legacy', totalCents: 19900, currency: 'MAD' },
      items: [{ sku: 'FEMI-KIT-100', name: 'Pack FemiGlow', quantity: 1 }],
      lead: makeLead(),
    });
    const payload = JSON.parse(captured.body!) as Record<string, unknown>;
    expect(payload.total_price).toBe(199);
    expect(payload).not.toHaveProperty('discount_amount');
    expect(payload).not.toHaveProperty('coupon_code');
  });

  it('PROMO-W6 code présent mais remise nulle → code seul, sans montant', async () => {
    const captured = captureNext();
    await dispatchOrderWebhook({
      order: {
        id: 'ord_promo0',
        totalCents: 19900,
        currency: 'MAD',
        couponCode: 'GLOW99',
        discountCents: 0,
      },
      items: [{ sku: 'FEMI-KIT-100', name: 'Pack FemiGlow', quantity: 1 }],
      lead: makeLead(),
    });
    const payload = JSON.parse(captured.body!) as Record<string, unknown>;
    expect(payload.coupon_code).toBe('GLOW99');
    expect(payload).not.toHaveProperty('discount_amount');
    expect(payload.note).toContain('promo:GLOW99');
    expect(String(payload.note)).not.toContain('-0');
  });
});
