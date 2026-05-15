import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { http, HttpResponse, server } from '@/test/msw/server';
import { resetMemoryStore } from '@/lib/db/client';
import type { ChatLeadRow } from '@/lib/chat/db/schema';

const envMock = vi.hoisted(() => ({
  OUTBOUND_WEBHOOK_URL: 'https://hook.example.com/lead-step2' as string | undefined,
  OUTBOUND_WEBHOOK_SECRET: 'dev-secret-min-32-chars-for-tests',
  CHAT_LEAD_WEBHOOK_URL: undefined as string | undefined,
  CHAT_LEAD_WEBHOOK_SECRET: undefined as string | undefined,
  LOG_LEVEL: 'error' as const,
}));

const repoMock = vi.hoisted(() => ({
  stampStep2Webhook: vi.fn(async (_id: string) => {}),
}));

vi.mock('@/lib/env', () => ({ env: envMock }));
vi.mock('@/lib/checkout/repos/lead-repo', () => ({
  wizardLeadRepo: {
    stampStep2Webhook: repoMock.stampStep2Webhook,
  },
}));
vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { dispatchLeadStep2Webhook } from './from-wizard-step2';

function makeLead(overrides: Partial<ChatLeadRow> = {}): ChatLeadRow {
  const now = new Date('2026-05-14T10:00:00Z');
  return {
    id: 'cl_step2',
    sessionId: 'cs_step2',
    triggeringMessageId: null,
    triggerReason: 'purchase-intent',
    firstName: 'Sara',
    phoneE164: '+212612345678',
    phoneRaw: '0612345678',
    note: null,
    consentVersion: '2026-05',
    consentAt: now,
    visitorId: 'cv_1',
    fingerprintHash: null,
    page: '/commander',
    referrer: null,
    utm: null,
    language: 'fr',
    intentAtCapture: null,
    snapshotMessages: [
      { role: 'user', content: 'Je veux commander', at: now.toISOString() },
      { role: 'assistant', content: 'Bien sûr', at: new Date(now.getTime() + 1000).toISOString() },
    ],
    webhookStatus: 'pending',
    webhookAttempts: 0,
    webhookLastError: null,
    webhookSentAt: null,
    handledBy: null,
    handledAt: null,
    outcome: 'pending',
    convertedOrderId: null,
    lastName: null,
    email: 'sara@example.com',
    emailVerifiedAt: null,
    emailConsent: false,
    shippingCity: 'Marrakech',
    shippingAddressLine1: '12 Rue Test',
    shippingAddressLine2: null,
    shippingPostalCode: null,
    shippingCountry: 'MA',
    shippingNotes: 'Livraison matin',
    preferredPaymentMethod: null,
    source: 'wizard_kit',
    formId: 'kit',
    formMode: 'wizard_cart',
    variantKey: null,
    gclid: null,
    fbp: null,
    fbc: null,
    cartSnapshot: {
      items: [{ sku: 'KIT-1', name: 'Kit FemiGlow', quantity: 1, unitPriceCents: 39900 }],
      totalCents: 39900,
      currency: 'MAD',
    },
    cartTotalCents: 39900,
    cartCurrency: 'MAD',
    lastTouchedStep: 'address',
    leadCapturedAt: now,
    addressCompletedAt: now,
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
  envMock.OUTBOUND_WEBHOOK_URL = 'https://hook.example.com/lead-step2';
});
afterAll(() => server.close());

describe('dispatchLeadStep2Webhook', () => {
  it('envoie payload adresse complet avec transcript et idempotency stable', async () => {
    const captured: { body?: Record<string, unknown>; event?: string | null; idem?: string | null } = {};
    server.use(
      http.post('https://hook.example.com/lead-step2', async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        captured.event = request.headers.get('x-femiglow-event');
        captured.idem = request.headers.get('idempotency-key');
        return HttpResponse.json({ ok: true });
      }),
    );

    const result = await dispatchLeadStep2Webhook(makeLead(), { ip: '1.2.3.4' });

    expect(result.status).toBe('sent');
    expect(captured.event).toBe('lead.step2_completed');
    expect(captured.idem).toBe('lead-step2:cl_step2');
    expect(captured.body).toMatchObject({
      id: 'lead-step2:cl_step2',
      full_name: 'Sara',
      phone: '0612345678',
      source: 'wizard_kit',
      address: '12 Rue Test',
      city: 'Marrakech',
      country: 'Maroc',
      total_price: 399,
      product_name: 'Kit FemiGlow',
      product_sku: 'KIT-1',
      ip: '1.2.3.4',
    });
    expect(captured.body?.conversation).toEqual([
      {
        role: 'user',
        name: 'Sara',
        text: 'Je veux commander',
        ts: '2026-05-14T10:00:00.000Z',
      },
      {
        role: 'bot',
        name: 'Assistant',
        text: 'Bien sûr',
        ts: '2026-05-14T10:00:01.000Z',
      },
    ]);
    expect(repoMock.stampStep2Webhook).toHaveBeenCalledWith('cl_step2');
  });

  it('skip si adresse non complétée ou déjà stampée', async () => {
    await expect(
      dispatchLeadStep2Webhook(makeLead({ addressCompletedAt: null })),
    ).resolves.toMatchObject({ status: 'skipped', lastError: 'address-not-completed' });
    await expect(
      dispatchLeadStep2Webhook(makeLead({ step2WebhookAt: new Date() })),
    ).resolves.toMatchObject({ status: 'skipped', lastError: 'step2-webhook-already-stamped' });
  });

  it('skip proprement sans requête externe quand le téléphone est invalide', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(
      dispatchLeadStep2Webhook(makeLead({ phoneE164: '', phoneRaw: 'abc' })),
    ).resolves.toMatchObject({ status: 'skipped', lastError: 'invalid-phone:invalid' });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(repoMock.stampStep2Webhook).not.toHaveBeenCalled();
  });

  it('honore le toggle runtime et ne stamp pas si le webhook step2 est désactivé', async () => {
    const { setTrackingSetting, TRACKING_SETTING_KEYS } = await import(
      '@/lib/db/queries/tracking/settings'
    );
    await setTrackingSetting(TRACKING_SETTING_KEYS.LEAD_STEP2_WEBHOOK_ENABLED, false);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    await expect(dispatchLeadStep2Webhook(makeLead())).resolves.toMatchObject({
      status: 'disabled',
      lastError: 'lead-step2-webhook-disabled',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(repoMock.stampStep2Webhook).not.toHaveBeenCalled();
  });

  it('garde le dispatch réussi même si le stamp DB échoue', async () => {
    repoMock.stampStep2Webhook.mockRejectedValueOnce(new Error('db write failed'));
    server.use(
      http.post('https://hook.example.com/lead-step2', () => HttpResponse.json({ ok: true })),
    );

    await expect(dispatchLeadStep2Webhook(makeLead())).resolves.toMatchObject({
      status: 'sent',
      responseStatus: 200,
    });
    expect(repoMock.stampStep2Webhook).toHaveBeenCalledWith('cl_step2');
  });

  it('compose les champs produits pour un panier multi-items sans conversation si désactivée', async () => {
    const { setTrackingSetting, TRACKING_SETTING_KEYS } = await import(
      '@/lib/db/queries/tracking/settings'
    );
    await setTrackingSetting(TRACKING_SETTING_KEYS.LEAD_WEBHOOK_CONVERSATION_ENABLED, false);
    const captured: { body?: Record<string, unknown> } = {};
    server.use(
      http.post('https://hook.example.com/lead-step2', async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ok: true });
      }),
    );

    await dispatchLeadStep2Webhook(
      makeLead({
        cartSnapshot: {
          items: [
            { sku: 'KIT-1', name: 'Kit FemiGlow', quantity: 2, unitPriceCents: 19900 },
            { sku: 'SERUM-1', name: 'Sérum', quantity: 1, unitPriceCents: 12000 },
          ],
          totalCents: 51800,
          currency: 'mad',
        },
      }),
    );

    expect(captured.body).toMatchObject({
      product_name: 'Kit FemiGlow + Sérum',
      product_sku: 'KIT-1, SERUM-1',
      quantity: 3,
      total_price: 518,
      currency: 'MAD',
    });
    expect(captured.body).not.toHaveProperty('conversation');
  });
});
