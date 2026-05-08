/**
 * CHA-225 — Tests d'intégration MSW pour `dispatchLeadWebhook` (chat).
 *
 * Le service `dispatchLeadWebhook` poste un payload signé HMAC-SHA-256 vers
 * un endpoint externe (n8n / CRM) après création d'un `chat_lead`.
 * Cet ensemble de tests couvre :
 *
 *  - succès 200 → status `sent`, signature présente, headers attendus,
 *    payload conforme au contrat (`event=lead.created`, `version=1`,
 *    section `lead.*`) ;
 *  - 4xx (404) puis 200 sur retry → status `sent`, attempts=2 ;
 *  - 5xx persistants → status `failed` après MAX_ATTEMPTS=3 ;
 *  - URL absente (toggle webhook off) → status `disabled`, aucun fetch.
 *
 * On stubbe les repos en mémoire (le but du test est le contrat HTTP, pas
 * la persistance) et on remplace `setTimeout` par un fake timer pour que
 * les backoffs (1s/3s/9s) ne fassent pas traîner la suite.
 *
 * cf. apps/web/src/lib/chat/services/lead-webhook.ts §dispatchLeadWebhook
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { http, HttpResponse, server } from '@/test/msw/server';
import type { ChatLeadRow } from '@/lib/chat/db/schema';

// ---------------------------------------------------------------------------
// Mocks d'environnement + repos. On configure `vi.hoisted` car on veut
// pouvoir muter `env.CHAT_LEAD_WEBHOOK_URL` test par test (cas désactivé).
// ---------------------------------------------------------------------------

const envMock = vi.hoisted(() => ({
  CHAT_LEAD_WEBHOOK_URL: 'https://hook.example.com/chat' as string | undefined,
  CHAT_LEAD_WEBHOOK_SECRET: 'shhh-secret-min-16-chars' as string | undefined,
}));

const repos = vi.hoisted(() => ({
  markWebhookSent: vi.fn(async (_id: string) => {}),
  markWebhookFailed: vi.fn(async (_id: string, _reason: string) => {}),
  eventAppend: vi.fn(async (_sessionId: string, _kind: string, _payload: unknown) => {}),
}));

vi.mock('@/lib/env', () => ({
  env: envMock,
}));

vi.mock('@/lib/chat/repos/lead', () => ({
  leadRepo: {
    markWebhookSent: repos.markWebhookSent,
    markWebhookFailed: repos.markWebhookFailed,
  },
}));

vi.mock('@/lib/chat/repos/event', () => ({
  eventRepo: {
    append: repos.eventAppend,
  },
}));

vi.mock('@/lib/logging/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import APRÈS les mocks pour que `lead-webhook.ts` capture les versions
// stubées. (sinon on récupère le vrai env et le vrai repo qui essayent de
// joindre Postgres).
import {
  dispatchLeadWebhook,
  signWebhookPayload,
  verifyWebhookSignature,
} from '@/lib/chat/services/lead-webhook';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeLead(overrides: Partial<ChatLeadRow> = {}): ChatLeadRow {
  const now = new Date('2026-05-07T12:00:00Z');
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
    page: '/produit',
    referrer: 'https://google.com',
    utm: { utm_source: 'newsletter' },
    language: 'fr',
    intentAtCapture: 'purchase',
    snapshotMessages: [
      { role: 'user', content: 'Bonjour, je veux commander', at: now.toISOString() },
      { role: 'assistant', content: 'Avec plaisir !', at: now.toISOString() },
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
  // Reset env defaults entre chaque test (cas `disabled` les modifie).
  envMock.CHAT_LEAD_WEBHOOK_URL = 'https://hook.example.com/chat';
  envMock.CHAT_LEAD_WEBHOOK_SECRET = 'shhh-secret-min-16-chars';
});
afterAll(() => server.close());

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

// ---------------------------------------------------------------------------
// Cas nominal : 200 OK
// ---------------------------------------------------------------------------

describe('dispatchLeadWebhook — succès 200', () => {
  it('signe le body, envoie les bons headers, met à jour les repos', async () => {
    const captured: {
      body?: string;
      sig?: string | null;
      event?: string | null;
      contentType?: string | null;
    } = {};

    server.use(
      http.post('https://hook.example.com/chat', async ({ request }) => {
        captured.body = await request.text();
        captured.sig = request.headers.get('x-femiglow-signature');
        captured.event = request.headers.get('x-femiglow-event');
        captured.contentType = request.headers.get('content-type');
        return HttpResponse.json({ received: true });
      }),
    );

    const lead = makeLead();
    const result = await dispatchLeadWebhook(lead);

    expect(result.status).toBe('sent');
    expect(result.attempts).toBe(1);
    expect(captured.event).toBe('lead.created');
    expect(captured.contentType).toMatch(/application\/json/);
    expect(captured.sig).toMatch(/^sha256=[a-f0-9]{64}$/);

    // Verify la signature elle-même (HMAC-SHA-256 vérifiable par le receveur).
    expect(
      verifyWebhookSignature(captured.body!, captured.sig!, envMock.CHAT_LEAD_WEBHOOK_SECRET!),
    ).toBe(true);

    // Le payload respecte le contrat documenté.
    const payload = JSON.parse(captured.body!) as Record<string, unknown> & {
      lead: Record<string, unknown>;
    };
    expect(payload.event).toBe('lead.created');
    expect(payload.version).toBe('1');
    expect(typeof payload.occurredAt).toBe('string');
    expect(payload.lead.id).toBe(lead.id);
    expect(payload.lead.sessionId).toBe(lead.sessionId);
    expect(payload.lead.firstName).toBe('Yasmine');
    expect(payload.lead.phoneE164).toBe('+212612345678');
    expect(payload.lead.triggerReason).toBe('inline-contact');
    expect(payload.lead.snapshot).toHaveLength(2);

    // Les repos ont été mis à jour.
    expect(repos.markWebhookSent).toHaveBeenCalledOnce();
    expect(repos.markWebhookSent).toHaveBeenCalledWith(lead.id);
    expect(repos.markWebhookFailed).not.toHaveBeenCalled();
    expect(repos.eventAppend).toHaveBeenCalledOnce();
    expect(repos.eventAppend).toHaveBeenCalledWith(
      lead.sessionId,
      'chat_lead_webhook_sent',
      expect.objectContaining({ leadId: lead.id, attempt: 1, status: 200 }),
    );
  });

  it('signe avec HMAC-SHA-256 cohérent avec signWebhookPayload (utilitaire interne)', () => {
    const body = JSON.stringify({ event: 'lead.created' });
    const a = signWebhookPayload(body, 'mysecret-of-some-length');
    const b = signWebhookPayload(body, 'mysecret-of-some-length');
    expect(a).toBe(b); // déterministe
    expect(verifyWebhookSignature(body, a, 'mysecret-of-some-length')).toBe(true);
    expect(verifyWebhookSignature(body, a, 'wrongsecret-1234567890')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Retry : 404 puis 200
// ---------------------------------------------------------------------------

describe('dispatchLeadWebhook — retry 4xx puis succès', () => {
  it('réessaye après un 404 et finit par envoyer (status sent, attempts > 1)', async () => {
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

    // Avancer les timers pour passer le backoff de 1s entre tentatives.
    await vi.advanceTimersByTimeAsync(2_000);

    const result = await promise;
    expect(result.status).toBe('sent');
    expect(result.attempts).toBe(2);
    expect(calls).toBe(2);
    expect(repos.markWebhookSent).toHaveBeenCalledOnce();
    expect(repos.markWebhookSent).toHaveBeenCalledWith('cl_retry');
    expect(repos.markWebhookFailed).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Échec définitif : 503 sur toutes les tentatives
// ---------------------------------------------------------------------------

describe('dispatchLeadWebhook — échec persistant', () => {
  it('marque webhook_status=failed après MAX_ATTEMPTS=3 sur 503 répétés', async () => {
    let calls = 0;
    server.use(
      http.post('https://hook.example.com/chat', () => {
        calls += 1;
        return new HttpResponse('service unavailable', { status: 503 });
      }),
    );

    const lead = makeLead({ id: 'cl_fail' });
    const promise = dispatchLeadWebhook(lead);

    // Backoffs cumulés : 1s + 3s = 4s ; on en avance 5s pour être confortable.
    await vi.advanceTimersByTimeAsync(5_000);

    const result = await promise;
    expect(result.status).toBe('failed');
    expect(result.attempts).toBe(3);
    expect(calls).toBe(3);
    expect(result.lastError).toMatch(/http-503/);
    expect(repos.markWebhookFailed).toHaveBeenCalledOnce();
    expect(repos.markWebhookFailed).toHaveBeenCalledWith(
      'cl_fail',
      expect.stringMatching(/http-503/),
    );
    expect(repos.markWebhookSent).not.toHaveBeenCalled();
    expect(repos.eventAppend).toHaveBeenCalledOnce();
    expect(repos.eventAppend).toHaveBeenCalledWith(
      lead.sessionId,
      'chat_lead_webhook_failed',
      expect.objectContaining({ leadId: 'cl_fail', attempts: 3 }),
    );
  });
});

// ---------------------------------------------------------------------------
// Webhook désactivé
// ---------------------------------------------------------------------------

describe('dispatchLeadWebhook — webhook non configuré', () => {
  it('renvoie status=disabled et trace event chat_lead_webhook_failed sans fetch', async () => {
    envMock.CHAT_LEAD_WEBHOOK_URL = undefined;
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
    expect(repos.markWebhookFailed).not.toHaveBeenCalled();
    expect(repos.eventAppend).toHaveBeenCalledOnce();
    expect(repos.eventAppend).toHaveBeenCalledWith(
      lead.sessionId,
      'chat_lead_webhook_failed',
      expect.objectContaining({ reason: 'webhook-not-configured' }),
    );
  });
});

// ---------------------------------------------------------------------------
// Erreur réseau (DNS / timeout)
// ---------------------------------------------------------------------------

describe('dispatchLeadWebhook — erreur réseau', () => {
  it('réessaye 3 fois quand le handler MSW renvoie un network error', async () => {
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
