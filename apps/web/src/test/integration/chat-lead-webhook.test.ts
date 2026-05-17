/**
 * CHA-260 — Tests d'intégration MSW pour `dispatchLeadWebhook` (chat),
 * désormais branché sur le dispatcher outbound unifié (payload PLAT).
 *
 * Couvre :
 *   - succès 200 → status `sent`, headers attendus, signature valide,
 *     payload FLAT conforme au contrat (`id`, `full_name`, `phone`, …)
 *     SANS wrapping `{event, version, lead}`.
 *   - 404 puis 200 sur retry → `sent`, attempts=2.
 *   - 503 persistants → `failed` après 3 tentatives.
 *   - URL absente → `disabled`, zéro fetch.
 *   - Erreur réseau → 3 tentatives + `failed`.
 *
 * cf. apps/web/src/lib/webhooks/outbound/sources/from-chat-lead.ts
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { http, HttpResponse, server } from '@/test/msw/server';
import type { ChatLeadRow } from '@/lib/chat/db/schema';

const envMock = vi.hoisted(() => ({
  OUTBOUND_WEBHOOK_URL: undefined as string | undefined,
  OUTBOUND_WEBHOOK_SECRET: undefined as string | undefined,
  CHAT_LEAD_WEBHOOK_URL: 'https://hook.example.com/chat' as string | undefined,
  CHAT_LEAD_WEBHOOK_SECRET: 'shhh-secret-min-16-chars' as string | undefined,
  LOG_LEVEL: 'error' as const,
  DATABASE_URL: undefined as string | undefined,
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
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  dispatchLeadWebhook,
  signWebhookPayload,
  verifyWebhookSignature,
} from '@/lib/chat/services/lead-webhook';
import { resetMemoryStore } from '@/lib/db/client';

function makeLead(overrides: Partial<ChatLeadRow> = {}): ChatLeadRow {
  const now = new Date('2026-05-13T12:00:00Z');
  return {
    id: 'cl_msw_001',
    sessionId: 'cs_msw_001',
    triggeringMessageId: 'cm_x',
    triggerReason: 'inline-contact',
    firstName: 'Yasmine',
    phoneE164: '+212612345678',
    phoneRaw: '0612345678',
    note: null,
    consentVersion: '2026-05-06',
    consentAt: now,
    visitorId: 'cv_msw_001',
    fingerprintHash: null,
    identityHash: 'e8e9477d9a5050e08b351ae2ebcf823ac585d88d5cf227af2c2a5fcee324eb04',
    page: '/produit',
    referrer: 'https://google.com',
    utm: { utm_source: 'newsletter' },
    language: 'fr',
    intentAtCapture: 'purchase',
    snapshotMessages: [
      { role: 'user', content: 'Bonjour', at: now.toISOString() },
    ],
    webhookStatus: 'pending',
    webhookAttempts: 0,
    webhookLastError: null,
    webhookSentAt: null,
    handledBy: null,
    handledAt: null,
    outcome: 'pending',
    convertedOrderId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as ChatLeadRow;
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  envMock.OUTBOUND_WEBHOOK_URL = undefined;
  envMock.OUTBOUND_WEBHOOK_SECRET = undefined;
  envMock.CHAT_LEAD_WEBHOOK_URL = 'https://hook.example.com/chat';
  envMock.CHAT_LEAD_WEBHOOK_SECRET = 'shhh-secret-min-16-chars';
  resetMemoryStore();
});
afterAll(() => server.close());

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

describe('dispatchLeadWebhook — succès 200 (payload PLAT)', () => {
  it('envoie le payload flat avec headers + signature HMAC valides', async () => {
    const captured: {
      body?: string;
      sig?: string | null;
      event?: string | null;
      source?: string | null;
      idem?: string | null;
      contentType?: string | null;
    } = {};

    server.use(
      http.post('https://hook.example.com/chat', async ({ request }) => {
        captured.body = await request.text();
        captured.sig = request.headers.get('x-femiglow-signature');
        captured.event = request.headers.get('x-femiglow-event');
        captured.source = request.headers.get('x-femiglow-source');
        captured.idem = request.headers.get('idempotency-key');
        captured.contentType = request.headers.get('content-type');
        return HttpResponse.json({ received: true });
      }),
    );

    const lead = makeLead();
    const result = await dispatchLeadWebhook(lead);

    expect(result.status).toBe('sent');
    expect(result.attempts).toBe(1);
    expect(captured.event).toBe('chat_lead.created');
    expect(captured.source).toBe('chat-lead');
    expect(captured.idem).toBe(`chat-lead:${lead.id}`);
    expect(captured.contentType).toMatch(/application\/json/);
    expect(captured.sig).toMatch(/^sha256=[a-f0-9]{64}$/);

    expect(
      verifyWebhookSignature(captured.body!, captured.sig!, envMock.CHAT_LEAD_WEBHOOK_SECRET!),
    ).toBe(true);

    const payload = JSON.parse(captured.body!) as Record<string, unknown>;
    expect(payload.id).toBe(`chat-lead:${lead.id}`);
    expect(payload.full_name).toBe('Yasmine');
    // Phone gate MA → trunk prefix `0...`.
    expect(payload.phone).toBe('0612345678');
    expect(payload.currency).toBe('MAD');
    expect(payload.quantity).toBe(1);
    expect(payload.source).toBe('chat_widget');
    expect(payload.source_channel).toBe('chat:inline-contact');
    expect(payload.conversation).toEqual([
      {
        role: 'user',
        name: 'Yasmine',
        text: 'Bonjour',
        ts: '2026-05-13T12:00:00.000Z',
      },
    ]);
    // Pas de wrapping
    expect((payload as { event?: unknown }).event).toBeUndefined();
    expect((payload as { version?: unknown }).version).toBeUndefined();
    expect((payload as { lead?: unknown }).lead).toBeUndefined();

    expect(repos.markWebhookSent).toHaveBeenCalledWith(lead.id);
    expect(repos.markWebhookFailed).not.toHaveBeenCalled();
    expect(repos.eventAppend).toHaveBeenCalledWith(
      lead.sessionId,
      'chat_lead_webhook_sent',
      expect.objectContaining({ leadId: lead.id }),
    );
  });

  it('signWebhookPayload est déterministe et vérifiable', () => {
    const body = JSON.stringify({ id: 'order-1' });
    const a = signWebhookPayload(body, 'mysecret-of-some-length');
    const b = signWebhookPayload(body, 'mysecret-of-some-length');
    expect(a).toBe(b);
    expect(verifyWebhookSignature(body, a, 'mysecret-of-some-length')).toBe(true);
    expect(verifyWebhookSignature(body, a, 'wrongsecret-1234567890')).toBe(false);
  });
});

describe('dispatchLeadWebhook — retry 404 puis succès', () => {
  it('réessaye après un 404 et finit par envoyer', async () => {
    let calls = 0;
    server.use(
      http.post('https://hook.example.com/chat', () => {
        calls += 1;
        if (calls === 1) return new HttpResponse('not found', { status: 404 });
        return HttpResponse.json({ received: true });
      }),
    );

    const lead = makeLead({ id: 'cl_retry' });
    const promise = dispatchLeadWebhook(lead);
    await vi.advanceTimersByTimeAsync(2_000);

    const result = await promise;
    expect(result.status).toBe('sent');
    expect(result.attempts).toBe(2);
    expect(calls).toBe(2);
    expect(repos.markWebhookSent).toHaveBeenCalledWith('cl_retry');
  });
});

describe('dispatchLeadWebhook — échec persistant 503', () => {
  it('marque webhook_status=failed après MAX_ATTEMPTS=3', async () => {
    let calls = 0;
    server.use(
      http.post('https://hook.example.com/chat', () => {
        calls += 1;
        return new HttpResponse('service unavailable', { status: 503 });
      }),
    );

    const lead = makeLead({ id: 'cl_fail' });
    const promise = dispatchLeadWebhook(lead);
    await vi.advanceTimersByTimeAsync(5_000);

    const result = await promise;
    expect(result.status).toBe('failed');
    expect(result.attempts).toBe(3);
    expect(calls).toBe(3);
    expect(result.lastError).toMatch(/http-503/);
    expect(repos.markWebhookFailed).toHaveBeenCalledWith(
      'cl_fail',
      expect.stringMatching(/http-503/),
    );
  });
});

describe('dispatchLeadWebhook — webhook non configuré', () => {
  it('renvoie status=disabled (mappé `failed` côté façade) sans fetch', async () => {
    envMock.CHAT_LEAD_WEBHOOK_URL = undefined;
    envMock.OUTBOUND_WEBHOOK_URL = undefined;
    let calls = 0;
    server.use(
      http.post('https://hook.example.com/chat', () => {
        calls += 1;
        return HttpResponse.json({});
      }),
    );

    const lead = makeLead({ id: 'cl_disabled' });
    const result = await dispatchLeadWebhook(lead);

    expect(result.status).toBe('disabled');
    expect(result.attempts).toBe(0);
    expect(calls).toBe(0);
    expect(repos.markWebhookSent).not.toHaveBeenCalled();
    expect(repos.markWebhookFailed).toHaveBeenCalledWith(
      'cl_disabled',
      'webhook-not-configured',
    );
  });
});

describe('dispatchLeadWebhook — erreur réseau', () => {
  it('réessaye 3 fois et marque failed', async () => {
    let calls = 0;
    server.use(
      http.post('https://hook.example.com/chat', () => {
        calls += 1;
        return HttpResponse.error();
      }),
    );

    const lead = makeLead({ id: 'cl_neterr' });
    const promise = dispatchLeadWebhook(lead);
    await vi.advanceTimersByTimeAsync(5_000);

    const result = await promise;
    expect(result.status).toBe('failed');
    expect(result.attempts).toBe(3);
    expect(calls).toBe(3);
    expect(result.lastError).toBeDefined();
  });
});

describe('dispatchLeadWebhook — endpoint OUTBOUND prioritaire', () => {
  it('utilise OUTBOUND_WEBHOOK_URL quand défini, plutôt que CHAT_LEAD_WEBHOOK_URL', async () => {
    envMock.OUTBOUND_WEBHOOK_URL = 'https://hook.example.com/outbound';
    envMock.OUTBOUND_WEBHOOK_SECRET = 'outbound-secret-of-some-length';
    let chatHits = 0;
    let outboundHits = 0;
    server.use(
      http.post('https://hook.example.com/chat', () => {
        chatHits += 1;
        return HttpResponse.json({});
      }),
      http.post('https://hook.example.com/outbound', () => {
        outboundHits += 1;
        return HttpResponse.json({});
      }),
    );

    const lead = makeLead({ id: 'cl_outbound_prio' });
    const result = await dispatchLeadWebhook(lead);
    expect(result.status).toBe('sent');
    expect(chatHits).toBe(0);
    expect(outboundHits).toBe(1);
  });
});
