/**
 * Tests d'intégration MSW pour `dispatchInlineContactWebhook`.
 *
 * Couvre :
 *   - Envoi outbound avec conversation et champs inline-contact
 *   - Conversation désactivée → pas de conversation dans le payload
 *   - Skip téléphone invalide
 *   - Disabled quand feature flag off
 *   - markWebhookSent au succès
 *   - markWebhookFailed sur erreur 500
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { http, HttpResponse, server } from '@/test/msw/server';
import type { ChatLeadRow } from '@/lib/chat/db/schema';
import { resetMemoryStore } from '@/lib/db/client';

const envMock = vi.hoisted(() => ({
  OUTBOUND_WEBHOOK_URL: 'https://hook.example.com/inline-contact' as string | undefined,
  OUTBOUND_WEBHOOK_SECRET: 'dev-secret-min-32-chars-for-tests',
  CHAT_LEAD_WEBHOOK_URL: undefined as string | undefined,
  CHAT_LEAD_WEBHOOK_SECRET: undefined as string | undefined,
  WEBHOOK_SECRET_KEY: 'webhook-secret-key-32-chars-for-tests',
  LOG_LEVEL: 'error' as const,
}));

const repos = vi.hoisted(() => ({
  markWebhookSent: vi.fn(async (_id: string) => {}),
  markWebhookFailed: vi.fn(async (_id: string, _reason: string) => {}),
  eventAppend: vi.fn(async (_sessionId: string, _kind: string, _payload: unknown) => {}),
}));

vi.mock('@/lib/env', () => ({ env: envMock }));
vi.mock('@/lib/chat/repos/lead', () => ({
  leadRepo: {
    markWebhookSent: repos.markWebhookSent,
    markWebhookFailed: repos.markWebhookFailed,
  },
}));
vi.mock('@/lib/chat/repos/event', () => ({
  eventRepo: { append: repos.eventAppend },
}));
vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { dispatchInlineContactWebhook } from '@/lib/webhooks/outbound/sources/from-inline-contact';

function makeLead(overrides: Partial<ChatLeadRow> = {}): ChatLeadRow {
  const now = new Date('2026-05-14T10:00:00Z');
  return {
    id: 'cl_ic_int',
    sessionId: 'cs_ic_int',
    triggeringMessageId: null,
    triggerReason: 'inline-contact',
    firstName: 'Amina',
    phoneE164: '+212612345678',
    phoneRaw: '0612345678',
    note: 'Intéressée',
    consentVersion: '2026-05',
    consentAt: now,
    visitorId: 'cv_ic',
    fingerprintHash: null,
    identityHash: 'e8e9477d9a5050e08b351ae2ebcf823ac585d88d5cf227af2c2a5fcee324eb04',
    page: '/chat',
    referrer: null,
    utm: null,
    language: 'fr',
    intentAtCapture: 'purchase',
    snapshotMessages: [
      { role: 'user', content: 'Bonjour', at: now.toISOString() },
      { role: 'assistant', content: 'Bienvenue !', at: new Date(now.getTime() + 1000).toISOString() },
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
    email: null,
    emailVerifiedAt: null,
    emailConsent: false,
    shippingCity: null,
    shippingAddressLine1: null,
    shippingAddressLine2: null,
    shippingPostalCode: null,
    shippingCountry: null,
    shippingNotes: null,
    preferredPaymentMethod: null,
    source: 'chat_widget',
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
    leadCapturedAt: null,
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
beforeEach(() => {
  resetMemoryStore();
  vi.clearAllMocks();
  envMock.OUTBOUND_WEBHOOK_URL = 'https://hook.example.com/inline-contact';
});
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('dispatchInlineContactWebhook — outbound URL integration', () => {
  it('sends inline-contact payload with conversation via outbound URL', async () => {
    const captured: { body?: Record<string, unknown>; event?: string | null } = {};
    server.use(
      http.post('https://hook.example.com/inline-contact', async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        captured.event = request.headers.get('x-femiglow-event');
        return HttpResponse.json({ ok: true });
      }),
    );

    const result = await dispatchInlineContactWebhook(makeLead());

    expect(result.status).toBe('sent');
    expect(captured.event).toBe('chat_lead.created');
    expect(captured.body).toMatchObject({
      id: 'inline-contact:cl_ic_int',
      full_name: 'Amina',
      phone: '0612345678',
      source: 'chat_widget',
      source_channel: 'chat:inline-contact',
      note: expect.stringContaining('trigger:inline-contact'),
      currency: 'MAD',
      quantity: 1,
    });
    expect(captured.body?.conversation).toEqual([
      { role: 'user', name: 'Amina', text: 'Bonjour', ts: '2026-05-14T10:00:00.000Z' },
      { role: 'bot', name: 'Assistant', text: 'Bienvenue !', ts: '2026-05-14T10:00:01.000Z' },
    ]);
    expect(repos.markWebhookSent).toHaveBeenCalledWith('cl_ic_int');
  });

  it('sends inline-contact payload without conversation when disabled', async () => {
    const { setTrackingSetting, TRACKING_SETTING_KEYS } = await import(
      '@/lib/db/queries/tracking/settings'
    );
    await setTrackingSetting(TRACKING_SETTING_KEYS.LEAD_WEBHOOK_CONVERSATION_ENABLED, false);

    const captured: { body?: Record<string, unknown> } = {};
    server.use(
      http.post('https://hook.example.com/inline-contact', async ({ request }) => {
        captured.body = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ ok: true });
      }),
    );

    const result = await dispatchInlineContactWebhook(makeLead());

    expect(result.status).toBe('sent');
    expect(captured.body).not.toHaveProperty('conversation');
  });

  it('skips with no POST when phone is invalid', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await dispatchInlineContactWebhook(makeLead({ phoneE164: '', phoneRaw: 'abc' }));

    expect(result.status).toBe('skipped');
    expect(result.lastError).toBe('invalid-phone:invalid');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns disabled when inlineContactWebhookEnabled is false', async () => {
    const { setTrackingSetting, TRACKING_SETTING_KEYS } = await import(
      '@/lib/db/queries/tracking/settings'
    );
    await setTrackingSetting(TRACKING_SETTING_KEYS.LEAD_INLINE_CONTACT_WEBHOOK_ENABLED, false);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    const result = await dispatchInlineContactWebhook(makeLead());

    expect(result.status).toBe('disabled');
    expect(result.lastError).toBe('inline-contact-webhook-disabled');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('marks leadRepo.markWebhookSent on success', async () => {
    server.use(
      http.post('https://hook.example.com/inline-contact', () => HttpResponse.json({ ok: true })),
    );

    await dispatchInlineContactWebhook(makeLead());

    expect(repos.markWebhookSent).toHaveBeenCalledWith('cl_ic_int');
    expect(repos.eventAppend).toHaveBeenCalledWith(
      'cs_ic_int',
      'inline_contact_webhook_sent',
      expect.objectContaining({ leadId: 'cl_ic_int' }),
    );
  });

  it('marks leadRepo.markWebhookFailed on outbound 500', async () => {
    server.use(
      http.post('https://hook.example.com/inline-contact', () =>
        HttpResponse.json({ error: 'internal' }, { status: 500 }),
      ),
    );

    const result = await dispatchInlineContactWebhook(makeLead());

    expect(result.status).toBe('failed');
    expect(repos.markWebhookFailed).toHaveBeenCalledWith('cl_ic_int', expect.any(String));
    expect(repos.eventAppend).toHaveBeenCalledWith(
      'cs_ic_int',
      'inline_contact_webhook_failed',
      expect.objectContaining({ leadId: 'cl_ic_int' }),
    );
  });
});