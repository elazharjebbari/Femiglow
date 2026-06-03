import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { http, HttpResponse, server } from '@/test/msw/server';
import { resetMemoryStore } from '@/lib/db/client';
import type { ChatLeadRow } from '@/lib/chat/db/schema';

const envMock = vi.hoisted(() => ({
  OUTBOUND_WEBHOOK_URL: 'https://hook.example.com/inline-contact' as string | undefined,
  OUTBOUND_WEBHOOK_SECRET: 'dev-secret-min-32-chars-for-tests',
  WEBHOOK_SECRET_KEY: 'webhook-secret-key-32-chars-for-tests',
  LOG_LEVEL: 'error' as const,
}));

const leadRepoMock = vi.hoisted(() => ({
  markWebhookSent: vi.fn(async (_id: string) => {}),
  markWebhookFailed: vi.fn(async (_id: string, _error: string) => {}),
}));
const eventRepoMock = vi.hoisted(() => ({
  append: vi.fn(async (_sessionId: string, _type: string, _payload: unknown) => {}),
}));

vi.mock('@/lib/env', () => ({ env: envMock }));
vi.mock('@/lib/chat/repos/lead', () => ({
  leadRepo: {
    markWebhookSent: leadRepoMock.markWebhookSent,
    markWebhookFailed: leadRepoMock.markWebhookFailed,
  },
}));
vi.mock('@/lib/chat/repos/event', () => ({
  eventRepo: {
    append: eventRepoMock.append,
  },
}));
vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { dispatchInlineContactWebhook } from './from-inline-contact';

function makeLead(overrides: Partial<ChatLeadRow> = {}): ChatLeadRow {
  const now = new Date('2026-05-14T10:00:00Z');
  return {
    id: 'cl_inline',
    sessionId: 'cs_inline',
    triggeringMessageId: null,
    triggerReason: 'inline-contact',
    firstName: 'Amina',
    phoneE164: '+212612345678',
    phoneRaw: '0612345678',
    note: 'Intéressée par le kit',
    consentVersion: '2026-05',
    consentAt: now,
    visitorId: 'cv_inline',
    fingerprintHash: null,
    page: '/chat',
    referrer: null,
    utm: null,
    language: 'fr',
    intentAtCapture: 'purchase',
    snapshotMessages: [
      { role: 'user', content: 'Je veux commander', at: now.toISOString() },
      { role: 'assistant', content: 'Bien sûr !', at: new Date(now.getTime() + 1000).toISOString() },
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
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  resetMemoryStore();
  envMock.OUTBOUND_WEBHOOK_URL = 'https://hook.example.com/inline-contact';
});
afterAll(() => server.close());

describe('dispatchInlineContactWebhook', () => {
  describe('happy path — outbound URL', () => {
    it('envoie payload inline-contact avec source_channel et note', async () => {
      const captured: { body?: Record<string, unknown>; event?: string | null; idem?: string | null } = {};
      server.use(
        http.post('https://hook.example.com/inline-contact', async ({ request }) => {
          captured.body = (await request.json()) as Record<string, unknown>;
          captured.event = request.headers.get('x-femiglow-event');
          captured.idem = request.headers.get('idempotency-key');
          return HttpResponse.json({ ok: true });
        }),
      );

      const result = await dispatchInlineContactWebhook(makeLead());

      expect(result.status).toBe('sent');
      expect(captured.event).toBe('chat_lead.created');
      // Idempotency unifiée avec from-chat-lead pour dédupe inline↔form.
      expect(captured.idem).toBe('chat-lead:cl_inline');
      expect(captured.body).toMatchObject({
        id: 'inline-contact:cl_inline',
        full_name: 'Amina',
        phone: '0612345678',
        source: 'chat_widget',
        source_channel: 'chat:inline-contact',
        note: expect.stringContaining('trigger:inline-contact'),
        lead_status: 'complete',
        currency: 'MAD',
        quantity: 1,
      });
      expect(leadRepoMock.markWebhookSent).toHaveBeenCalledWith('cl_inline');
      expect(eventRepoMock.append).toHaveBeenCalledWith(
        'cs_inline',
        'inline_contact_webhook_sent',
        expect.objectContaining({ leadId: 'cl_inline' }),
      );
    });

    it('inclut conversation quand conversationEnabled=true', async () => {
      const captured: { body?: Record<string, unknown> } = {};
      server.use(
        http.post('https://hook.example.com/inline-contact', async ({ request }) => {
          captured.body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ok: true });
        }),
      );

      const result = await dispatchInlineContactWebhook(makeLead());

      expect(result.status).toBe('sent');
      expect(captured.body?.conversation).toEqual([
        { role: 'user', name: 'Amina', text: 'Je veux commander', ts: '2026-05-14T10:00:00.000Z' },
        { role: 'bot', name: 'Assistant', text: 'Bien sûr !', ts: '2026-05-14T10:00:01.000Z' },
      ]);
    });

    it('omet conversation quand conversationEnabled=false', async () => {
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
  });

  describe('feature flag', () => {
    it('retourne disabled quand inlineContactWebhookEnabled=false', async () => {
      const { setTrackingSetting, TRACKING_SETTING_KEYS } = await import(
        '@/lib/db/queries/tracking/settings'
      );
      await setTrackingSetting(TRACKING_SETTING_KEYS.LEAD_INLINE_CONTACT_WEBHOOK_ENABLED, false);
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const result = await dispatchInlineContactWebhook(makeLead());

      expect(result.status).toBe('disabled');
      expect(result.lastError).toBe('inline-contact-webhook-disabled');
      expect(fetchSpy).not.toHaveBeenCalled();
      // Feature flag off returns early — no DB side effects
      expect(leadRepoMock.markWebhookFailed).not.toHaveBeenCalled();
      expect(eventRepoMock.append).not.toHaveBeenCalled();
    });
  });

  describe('phone gate', () => {
    it('skip et marque failed quand téléphone invalide', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const result = await dispatchInlineContactWebhook(makeLead({ phoneE164: '', phoneRaw: 'abc' }));

      expect(result.status).toBe('skipped');
      expect(result.lastError).toBe('invalid-phone:invalid');
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(leadRepoMock.markWebhookFailed).toHaveBeenCalledWith('cl_inline', 'invalid-phone:invalid');
      expect(eventRepoMock.append).toHaveBeenCalledWith(
        'cs_inline',
        'inline_contact_webhook_failed',
        expect.objectContaining({ leadId: 'cl_inline', reason: 'invalid-phone:invalid' }),
      );
    });

    it('skip quand téléphone vide', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const result = await dispatchInlineContactWebhook(makeLead({ phoneE164: '', phoneRaw: '' }));

      expect(result.status).toBe('skipped');
      expect(result.lastError).toBe('invalid-phone:empty');
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('admin endpoint dispatch', () => {
    it('dispatche vers endpoint admin subscri chat_lead.created', async () => {
      envMock.OUTBOUND_WEBHOOK_URL = undefined;
      const { createWebhookEndpoint } = await import('@/lib/db/queries/webhook-endpoints');
      await createWebhookEndpoint({
        url: 'https://hook.example.com/admin-chat-lead',
        events: ['chat_lead.created'],
        description: 'admin chat-lead endpoint',
      });

      const captured: { eventName?: string; payload?: Record<string, unknown>; idem?: string | null } = {};
      server.use(
        http.post('https://hook.example.com/admin-chat-lead', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          captured.eventName = body.event_name as string;
          captured.payload = body;
          captured.idem = request.headers.get('idempotency-key');
          return HttpResponse.json({ ok: true });
        }),
      );

      const result = await dispatchInlineContactWebhook(makeLead());

      expect(result.status).toBe('sent');
      expect(captured.eventName).toBe('chat_lead.created');
      expect(captured.payload).toMatchObject({
        event_name: 'chat_lead.created',
        webhook_source: 'inline-contact',
        source_id: 'cl_inline',
        full_name: 'Amina',
        phone: '0612345678',
        source_channel: 'chat:inline-contact',
      });
      expect(captured.idem).toBe('chat_lead.created:chat-lead:cl_inline');
    });

    it('dispatche via adminEventNames fallback vers lead.created', async () => {
      envMock.OUTBOUND_WEBHOOK_URL = undefined;
      const { createWebhookEndpoint } = await import('@/lib/db/queries/webhook-endpoints');
      await createWebhookEndpoint({
        url: 'https://hook.example.com/admin-lead',
        events: ['lead.created'],
        description: 'legacy admin endpoint',
      });

      const captured: { eventName?: string } = {};
      server.use(
        http.post('https://hook.example.com/admin-lead', async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          captured.eventName = body.event_name as string;
          return HttpResponse.json({ ok: true });
        }),
      );

      const result = await dispatchInlineContactWebhook(makeLead());

      expect(result.status).toBe('sent');
      expect(captured.eventName).toBe('chat_lead.created');
    });
  });

  describe('error paths', () => {
    it('marque webhook failed sur erreur 500 outbound', async () => {
      server.use(
        http.post('https://hook.example.com/inline-contact', () =>
          HttpResponse.json({ error: 'internal' }, { status: 500 }),
        ),
      );

      const result = await dispatchInlineContactWebhook(makeLead());

      expect(result.status).toBe('failed');
      expect(leadRepoMock.markWebhookFailed).toHaveBeenCalledWith('cl_inline', expect.any(String));
      expect(eventRepoMock.append).toHaveBeenCalledWith(
        'cs_inline',
        'inline_contact_webhook_failed',
        expect.objectContaining({ leadId: 'cl_inline' }),
      );
    });

    it('marque webhook-not-configured quand disabled', async () => {
      envMock.OUTBOUND_WEBHOOK_URL = undefined;
      const fetchSpy = vi.spyOn(globalThis, 'fetch');

      const result = await dispatchInlineContactWebhook(makeLead());

      expect(result.status).toBe('disabled');
      expect(result.lastError).toBe('no-endpoint-configured');
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(leadRepoMock.markWebhookFailed).toHaveBeenCalledWith('cl_inline', 'webhook-not-configured');
    });

    it('appelle markWebhookSent après un dispatch réussi', async () => {
      server.use(
        http.post('https://hook.example.com/inline-contact', () => HttpResponse.json({ ok: true })),
      );

      const result = await dispatchInlineContactWebhook(makeLead());

      expect(result.status).toBe('sent');
      expect(leadRepoMock.markWebhookSent).toHaveBeenCalledWith('cl_inline');
    });

    it('inclut intent dans la note quand intentAtCapture est renseigné', async () => {
      const captured: { body?: Record<string, unknown> } = {};
      server.use(
        http.post('https://hook.example.com/inline-contact', async ({ request }) => {
          captured.body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ ok: true });
        }),
      );

      await dispatchInlineContactWebhook(makeLead({ intentAtCapture: 'purchase' }));

      expect(captured.body?.note).toContain('intent:purchase');
    });
  });
});