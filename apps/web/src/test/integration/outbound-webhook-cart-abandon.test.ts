/**
 * CHA-260 — Tests d'intégration MSW pour le builder `from-cart-abandon`.
 *
 * On teste UNIQUEMENT le builder (le scanner DB nécessite Postgres réel).
 * Vérifie :
 *   - payload riche avec cartSnapshot complet ;
 *   - payload minimal sans cartSnapshot ;
 *   - phone-gate strict ;
 *   - event=cart.abandoned, source=cart-abandon, idem=cart-abandon:<id>.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { http, HttpResponse, server } from '@/test/msw/server';
import type { ChatLeadRow } from '@/lib/chat/db/schema';

const envMock = vi.hoisted(() => ({
  OUTBOUND_WEBHOOK_URL: 'https://hook.example.com/cart' as string | undefined,
  OUTBOUND_WEBHOOK_SECRET: 'cart-secret-16chars+' as string | undefined,
  CHAT_LEAD_WEBHOOK_URL: undefined as string | undefined,
  CHAT_LEAD_WEBHOOK_SECRET: undefined as string | undefined,
  LOG_LEVEL: 'error' as const,
  DATABASE_URL: undefined as string | undefined,
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

import { dispatchCartAbandonWebhook } from '@/lib/webhooks/outbound/sources/from-cart-abandon';
import { resetMemoryStore } from '@/lib/db/client';

function makeLead(over: Partial<ChatLeadRow> = {}): ChatLeadRow {
  const now = new Date('2026-05-13T12:00:00Z');
  return {
    id: 'cl_ca_001',
    sessionId: 'cs_x',
    triggeringMessageId: null,
    triggerReason: 'purchase-intent',
    firstName: 'Yas',
    phoneE164: '+212661234567',
    phoneRaw: '0661234567',
    note: null,
    consentVersion: '2026-05-06',
    consentAt: now,
    visitorId: 'v_x',
    fingerprintHash: null,
    page: null,
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
    email: null,
    emailVerifiedAt: null,
    emailConsent: false,
    shippingCity: null,
    shippingAddressLine1: null,
    shippingAddressLine2: null,
    shippingPostalCode: null,
    shippingCountry: 'MA',
    shippingNotes: null,
    preferredPaymentMethod: null,
    source: 'wizard_kit',
    formId: null,
    formMode: null,
    variantKey: null,
    gclid: null,
    fbp: null,
    fbc: null,
    cartSnapshot: null,
    cartTotalCents: null,
    cartCurrency: null,
    lastTouchedStep: 'lead',
    leadCapturedAt: now,
    addressCompletedAt: null,
    paymentSelectedAt: null,
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

describe('dispatchCartAbandonWebhook — payload', () => {
  it('inclut le cartSnapshot quand disponible', async () => {
    let received: Record<string, unknown> | null = null;
    let event: string | null = null;
    let source: string | null = null;
    let idem: string | null = null;
    server.use(
      http.post('https://hook.example.com/cart', async ({ request }) => {
        received = (await request.json()) as Record<string, unknown>;
        event = request.headers.get('x-femiglow-event');
        source = request.headers.get('x-femiglow-source');
        idem = request.headers.get('idempotency-key');
        return HttpResponse.json({ ok: true });
      }),
    );

    const lead = makeLead({
      id: 'cl_snap',
      shippingCity: 'Casablanca',
      shippingAddressLine1: '5 Avenue Hassan',
      cartSnapshot: {
        items: [{ sku: 'WTC-42', name: 'Pack FemiGlow', quantity: 2, unitPriceCents: 19900 }],
        totalCents: 39800,
        currency: 'MAD',
      },
    });
    const r = await dispatchCartAbandonWebhook(lead);
    expect(r.status).toBe('sent');
    expect(event).toBe('cart.abandoned');
    expect(source).toBe('cart-abandon');
    expect(idem).toBe('cart-abandon:cl_snap');

    expect(received).not.toBeNull();
    expect(received!.id).toBe('cart-abandon:cl_snap');
    expect(received!.full_name).toBe('Yas');
    expect(received!.phone).toBe('0661234567');
    expect(received!.total_price).toBe(398);
    expect(received!.quantity).toBe(2);
    expect(received!.product_name).toBe('Pack FemiGlow');
    expect(received!.product_sku).toBe('WTC-42');
    expect(received!.city).toBe('Casablanca');
    expect(received!.address).toBe('5 Avenue Hassan');
    expect(received!.country).toBe('Maroc');
    expect((received!.note as string)).toContain('cart-abandoned');
    expect(received!.lead_status).toBe('abandoned');
  });

  it('fonctionne sans cartSnapshot (payload minimal)', async () => {
    let received: Record<string, unknown> | null = null;
    server.use(
      http.post('https://hook.example.com/cart', async ({ request }) => {
        received = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ok: true });
      }),
    );

    const r = await dispatchCartAbandonWebhook(makeLead({ id: 'cl_min' }));
    expect(r.status).toBe('sent');
    expect(received!.id).toBe('cart-abandon:cl_min');
    expect(received!.quantity).toBe(1);
    expect(received!.currency).toBe('MAD');
    expect('total_price' in received!).toBe(false);
    expect('product_name' in received!).toBe(false);
  });

  it('skip si phone invalide', async () => {
    let calls = 0;
    server.use(
      http.post('https://hook.example.com/cart', () => {
        calls += 1;
        return HttpResponse.json({});
      }),
    );

    const r = await dispatchCartAbandonWebhook(
      makeLead({ id: 'cl_bad', phoneE164: '', phoneRaw: 'xxx' }),
    );
    expect(r.status).toBe('skipped');
    expect(calls).toBe(0);
  });
});
