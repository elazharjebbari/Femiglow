import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { ChatLeadRow } from '@/lib/chat/db/schema';
import { resetMemoryStore } from '@/lib/db/client';
import { http, HttpResponse, server } from '@/test/msw/server';

const envMock = vi.hoisted(() => ({
  OUTBOUND_WEBHOOK_URL: 'https://hook.example.com/lead-step1-abandon' as string | undefined,
  OUTBOUND_WEBHOOK_SECRET: 'dev-secret-min-32-chars-for-tests',
  CHAT_LEAD_WEBHOOK_URL: undefined as string | undefined,
  CHAT_LEAD_WEBHOOK_SECRET: undefined as string | undefined,
  WEBHOOK_SECRET_KEY: 'webhook-secret-key-32-chars-for-tests',
  LOG_LEVEL: 'error' as const,
}));

vi.mock('@/lib/env', () => ({ env: envMock }));
vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { dispatchLeadStep1AbandonWebhook } from './from-wizard-step1-abandon';

function makeLead(overrides: Partial<ChatLeadRow> = {}): ChatLeadRow {
  const now = new Date('2026-05-14T10:00:00Z');
  return {
    id: 'cl_step1',
    sessionId: 'cs_step1',
    triggeringMessageId: null,
    triggerReason: 'purchase-intent',
    firstName: 'Nadia',
    phoneE164: '+212612345678',
    phoneRaw: '0612345678',
    note: null,
    consentVersion: '2026-05',
    consentAt: now,
    visitorId: null,
    fingerprintHash: null,
    page: '/kit',
    referrer: null,
    utm: null,
    language: 'fr',
    intentAtCapture: null,
    snapshotMessages: [],
    webhookStatus: 'pending',
    webhookAttempts: 0,
    webhookLastError: null,
    webhookSentAt: null,
    handledBy: null,
    handledAt: null,
    outcome: 'pending',
    convertedOrderId: null,
    lastName: 'B.',
    email: 'nadia@example.com',
    emailVerifiedAt: null,
    emailConsent: false,
    shippingCity: null,
    shippingAddressLine1: null,
    shippingAddressLine2: null,
    shippingPostalCode: null,
    shippingCountry: null,
    shippingNotes: null,
    preferredPaymentMethod: null,
    source: 'wizard_kit',
    formId: 'kit',
    formMode: 'wizard_cart',
    variantKey: null,
    gclid: null,
    fbp: null,
    fbc: null,
    cartSnapshot: null,
    cartTotalCents: 19900,
    cartCurrency: 'mad',
    lastTouchedStep: 'lead',
    leadCapturedAt: now,
    addressCompletedAt: null,
    paymentSelectedAt: null,
    purchasedAt: null,
    abandonWebhookAt: null,
    step2WebhookAt: null,
    step1AbandonWebhookAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as ChatLeadRow;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  resetMemoryStore();
  envMock.OUTBOUND_WEBHOOK_URL = 'https://hook.example.com/lead-step1-abandon';
});
afterAll(() => server.close());

describe('dispatchLeadStep1AbandonWebhook', () => {
  it('envoie un payload minimal stable avec source et idempotency dédiées', async () => {
    const captured: { body?: Record<string, unknown>; event?: string | null; idem?: string | null } = {};
    server.use(
      http.post('https://hook.example.com/lead-step1-abandon', async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        captured.event = request.headers.get('x-femiglow-event');
        captured.idem = request.headers.get('idempotency-key');
        return HttpResponse.json({ ok: true });
      }),
    );

    await expect(dispatchLeadStep1AbandonWebhook(makeLead())).resolves.toMatchObject({
      status: 'sent',
      responseStatus: 200,
    });
    expect(captured.event).toBe('lead.step1_abandoned');
    expect(captured.idem).toBe('lead-step1-abandon:cl_step1');
    expect(captured.body).toMatchObject({
      id: 'lead-step1-abandon:cl_step1',
      full_name: 'Nadia B.',
      phone: '0612345678',
      source: 'wizard_kit',
      email: 'nadia@example.com',
      currency: 'MAD',
      quantity: 1,
      note: 'step1-abandoned | form:kit',
      source_channel: 'kit',
    });
  });

  it('skip sans requête externe si le téléphone est invalide', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(
      dispatchLeadStep1AbandonWebhook(makeLead({ phoneE164: '', phoneRaw: 'abc' })),
    ).resolves.toMatchObject({ status: 'skipped', lastError: 'invalid-phone:invalid' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('dispatche vers endpoint admin subscri lead.step1_abandoned', async () => {
    envMock.OUTBOUND_WEBHOOK_URL = undefined;
    const { createWebhookEndpoint } = await import('@/lib/db/queries/webhook-endpoints');
    await createWebhookEndpoint({
      url: 'https://hook.example.com/admin-abandon',
      events: ['lead.step1_abandoned'],
      description: 'admin step1-abandon endpoint',
    });
    const captured: { eventName?: string; payload?: Record<string, unknown>; idem?: string | null } = {};
    server.use(
      http.post('https://hook.example.com/admin-abandon', async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        captured.eventName = body.event_name as string;
        captured.payload = body;
        captured.idem = request.headers.get('idempotency-key');
        return HttpResponse.json({ ok: true });
      }),
    );

    const result = await dispatchLeadStep1AbandonWebhook(makeLead());

    expect(result.status).toBe('sent');
    expect(captured.eventName).toBe('lead.step1_abandoned');
    expect(captured.payload).toMatchObject({
      event_name: 'lead.step1_abandoned',
      webhook_source: 'lead-step1-abandon',
      source_id: 'cl_step1',
    });
    expect(captured.idem).toBe('lead.step1_abandoned:lead-step1-abandon:cl_step1');
  });

  it('retourne disabled quand aucun endpoint et aucun outbound URL', async () => {
    envMock.OUTBOUND_WEBHOOK_URL = undefined;
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await dispatchLeadStep1AbandonWebhook(makeLead());

    expect(result.status).toBe('disabled');
    expect(result.lastError).toBe('no-endpoint-configured');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('préfère endpoint admin sur outbound URL', async () => {
    const { createWebhookEndpoint } = await import('@/lib/db/queries/webhook-endpoints');
    await createWebhookEndpoint({
      url: 'https://hook.example.com/admin-abandon',
      events: ['lead.step1_abandoned'],
      description: 'admin step1-abandon endpoint',
    });
    let adminCalled = false;
    let outboundCalled = false;
    server.use(
      http.post('https://hook.example.com/admin-abandon', () => {
        adminCalled = true;
        return HttpResponse.json({ ok: true });
      }),
      http.post('https://hook.example.com/lead-step1-abandon', () => {
        outboundCalled = true;
        return HttpResponse.json({ ok: true });
      }),
    );

    const result = await dispatchLeadStep1AbandonWebhook(makeLead());

    expect(result.status).toBe('sent');
    expect(adminCalled).toBe(true);
    expect(outboundCalled).toBe(false);
  });

  it('inclut email et cart currency quand présents', async () => {
    const captured: { body?: Record<string, unknown> } = {};
    server.use(
      http.post('https://hook.example.com/lead-step1-abandon', async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ok: true });
      }),
    );

    await dispatchLeadStep1AbandonWebhook(
      makeLead({
        email: 'nadia@example.com',
        cartCurrency: 'MAD',
        cartSnapshot: { items: [{ sku: 'KIT-1', name: 'Kit', quantity: 1, unitPriceCents: 19900 }], totalCents: 19900, currency: 'MAD' },
      }),
    );

    expect(captured.body).toMatchObject({
      email: 'nadia@example.com',
      currency: 'MAD',
    });
  });

  it('utilise formId comme source_channel quand présent', async () => {
    const captured: { body?: Record<string, unknown> } = {};
    server.use(
      http.post('https://hook.example.com/lead-step1-abandon', async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ok: true });
      }),
    );

    await dispatchLeadStep1AbandonWebhook(makeLead({ formId: 'kit_femiglow_v1' }));

    expect(captured.body?.source_channel).toBe('kit_femiglow_v1');
  });
});
