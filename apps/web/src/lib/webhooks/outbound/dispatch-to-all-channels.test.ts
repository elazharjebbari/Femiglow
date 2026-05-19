import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { resetMemoryStore } from '@/lib/db/client';
import { createWebhookEndpoint } from '@/lib/db/queries/webhook-endpoints';
import type { WebhookDelivery } from '@/lib/db/types';
import type { OutboundPayload } from './payload';
import { http, HttpResponse, server } from '@/test/msw/server';

const envMock = vi.hoisted(() => ({
  OUTBOUND_WEBHOOK_URL: undefined as string | undefined,
  OUTBOUND_WEBHOOK_SECRET: undefined as string | undefined,
  CHAT_LEAD_WEBHOOK_URL: undefined as string | undefined,
  CHAT_LEAD_WEBHOOK_SECRET: undefined as string | undefined,
  WEBHOOK_SECRET_KEY: 'webhook-secret-key-32-chars-for-tests',
  LOG_LEVEL: 'error' as const,
}));

const engineMock = vi.hoisted(() => ({
  enqueueDelivery: vi.fn(),
  attemptDelivery: vi.fn(),
}));

vi.mock('@/lib/env', () => ({ env: envMock }));
vi.mock('@/lib/webhooks/engine', () => ({
  enqueueDelivery: engineMock.enqueueDelivery,
  attemptDelivery: engineMock.attemptDelivery,
}));
vi.mock('@/lib/logging/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { dispatchToAllChannels } from './dispatch-to-all-channels';

function makeDelivery(
  overrides: Partial<WebhookDelivery> = {},
): WebhookDelivery {
  return {
    id: 'wd_1',
    endpointId: 'ep_1',
    event: 'chat_lead.created',
    idempotencyKey: 'chat_lead.created:inline-contact:cl_test',
    payload: {},
    status: 'succeeded',
    attemptCount: 1,
    responseStatus: 200,
    responseBody: null,
    errorCode: null,
    nextAttemptAt: null,
    // `latencyMs: null` explicite — le type `WebhookDelivery` exige
    // `number | null` (pas `undefined`). Omettre la clé donne `undefined`
    // qui n'est pas assignable depuis `exactOptionalPropertyTypes: false`
    // mais reste signalé par tsc avec `strict: true` quand le getter
    // attendu est non-undefined.
    latencyMs: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Helper de construction d'un `OutboundPayload` valide. Centralise les
 * defaults requis par le schéma Zod post-parse (`currency`, `quantity`)
 * pour ne pas avoir à les répéter dans chaque test.
 *
 * Pour les tests qui veulent volontairement omettre ces champs (pour
 * vérifier la validation), passer le payload directement sans helper.
 */
function leadPayload(
  partial: Partial<OutboundPayload> & Pick<OutboundPayload, 'id' | 'full_name' | 'phone'>,
): OutboundPayload {
  return {
    currency: 'MAD',
    quantity: 1,
    ...partial,
  };
}

beforeEach(() => {
  resetMemoryStore();
  vi.clearAllMocks();
  envMock.OUTBOUND_WEBHOOK_URL = undefined;
  envMock.OUTBOUND_WEBHOOK_SECRET = undefined;
});

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('dispatchToAllChannels', () => {
  describe('admin endpoint dispatch', () => {
    it('dispatches to matching active admin endpoint and returns sent', async () => {
      await createWebhookEndpoint({
        url: 'https://hook.example.com/admin',
        events: ['chat_lead.created'],
        description: 'test endpoint',
      });
      const delivery = makeDelivery({ status: 'succeeded', attemptCount: 1, responseStatus: 200 });
      engineMock.enqueueDelivery.mockResolvedValue(delivery);
      engineMock.attemptDelivery.mockResolvedValue(delivery);

      const result = await dispatchToAllChannels({
        source: 'inline-contact',
        sourceId: 'cl_test',
        idempotencyKey: 'inline-contact:cl_test',
        eventName: 'chat_lead.created',
        adminEventNames: ['chat_lead.created', 'lead.created'],
        payload: leadPayload({ id: 'inline-contact:cl_test', full_name: 'Sara', phone: '0612345678' }),
      });

      expect(result.status).toBe('sent');
      expect(result.adminEndpointsAttempted).toBe(1);
      expect(engineMock.enqueueDelivery).toHaveBeenCalledTimes(1);
      expect(engineMock.attemptDelivery).toHaveBeenCalledTimes(1);
    });

    it('returns pending when admin endpoint returns pending status', async () => {
      await createWebhookEndpoint({
        url: 'https://hook.example.com/admin',
        events: ['lead.step1_abandoned'],
        description: 'test endpoint',
      });
      const delivery = makeDelivery({ status: 'pending', attemptCount: 1 });
      engineMock.enqueueDelivery.mockResolvedValue(delivery);
      engineMock.attemptDelivery.mockResolvedValue(delivery);

      const result = await dispatchToAllChannels({
        source: 'lead-step1-abandon',
        sourceId: 'cl_test',
        idempotencyKey: 'lead-step1-abandon:cl_test',
        eventName: 'lead.step1_abandoned',
        payload: leadPayload({ id: 'lead-step1-abandon:cl_test', full_name: 'Nadia', phone: '0612345678' }),
      });

      expect(result.status).toBe('pending');
      expect(result.adminEndpointsAttempted).toBe(1);
    });

    it('returns failed when admin endpoint returns permanent status', async () => {
      await createWebhookEndpoint({
        url: 'https://hook.example.com/admin',
        events: ['lead.step1_abandoned'],
        description: 'test endpoint',
      });
      const delivery = makeDelivery({ status: 'permanent', attemptCount: 5, errorCode: 'max-retries' });
      engineMock.enqueueDelivery.mockResolvedValue(delivery);
      engineMock.attemptDelivery.mockResolvedValue(delivery);

      const result = await dispatchToAllChannels({
        source: 'lead-step1-abandon',
        sourceId: 'cl_test',
        idempotencyKey: 'lead-step1-abandon:cl_test',
        eventName: 'lead.step1_abandoned',
        payload: leadPayload({ id: 'lead-step1-abandon:cl_test', full_name: 'Nadia', phone: '0612345678' }),
      });

      expect(result.status).toBe('failed');
      expect(result.lastError).toBe('max-retries');
      expect(result.adminEndpointsAttempted).toBe(1);
    });

    it('falls back to outbound URL when no admin endpoint matches the event', async () => {
      await createWebhookEndpoint({
        url: 'https://hook.example.com/admin',
        events: ['order.created'],
        description: 'test endpoint (different event)',
      });
      envMock.OUTBOUND_WEBHOOK_URL = 'https://hook.example.com/outbound';
      envMock.OUTBOUND_WEBHOOK_SECRET = 'outbound-secret-min-32-chars-for-tests';

      const captured: { url?: string } = {};
      server.use(
        http.post('https://hook.example.com/outbound', async ({ request }) => {
          captured.url = request.url;
          return HttpResponse.json({ ok: true });
        }),
      );

      const result = await dispatchToAllChannels({
        source: 'chat-lead',
        sourceId: 'cl_test',
        idempotencyKey: 'chat-lead:cl_test',
        eventName: 'chat_lead.created',
        payload: leadPayload({ id: 'chat-lead:cl_test', full_name: 'Sara', phone: '0612345678' }),
      });

      expect(result.status).toBe('sent');
      expect(result.adminEndpointsAttempted).toBe(0);
      expect(captured.url).toBe('https://hook.example.com/outbound');
      expect(engineMock.enqueueDelivery).not.toHaveBeenCalled();
    });

    it('skips inactive admin endpoints and falls back to outbound', async () => {
      const { endpoint } = await createWebhookEndpoint({
        url: 'https://hook.example.com/admin',
        events: ['chat_lead.created'],
        description: 'inactive endpoint',
      });
      // Deactivate the endpoint
      const { updateWebhookEndpoint } = await import('@/lib/db/queries/webhook-endpoints');
      await updateWebhookEndpoint(endpoint.id, { active: false });

      envMock.OUTBOUND_WEBHOOK_URL = 'https://hook.example.com/outbound';
      envMock.OUTBOUND_WEBHOOK_SECRET = 'outbound-secret-min-32-chars-for-tests';

      server.use(
        http.post('https://hook.example.com/outbound', () => HttpResponse.json({ ok: true })),
      );

      const result = await dispatchToAllChannels({
        source: 'chat-lead',
        sourceId: 'cl_test',
        idempotencyKey: 'chat-lead:cl_test',
        eventName: 'chat_lead.created',
        payload: leadPayload({ id: 'chat-lead:cl_test', full_name: 'Sara', phone: '0612345678' }),
      });

      expect(result.status).toBe('sent');
      expect(result.adminEndpointsAttempted).toBe(0);
    });

    it('matches adminEventNames fallback when primary eventName not subscribed', async () => {
      // Create endpoint subscribed only to 'lead.created', not 'chat_lead.created'
      await createWebhookEndpoint({
        url: 'https://hook.example.com/admin-lead',
        events: ['lead.created'],
        description: 'legacy endpoint',
      });
      const delivery = makeDelivery({ status: 'succeeded', attemptCount: 1, responseStatus: 200 });
      engineMock.enqueueDelivery.mockResolvedValue(delivery);
      engineMock.attemptDelivery.mockResolvedValue(delivery);

      const result = await dispatchToAllChannels({
        source: 'inline-contact',
        sourceId: 'cl_test',
        idempotencyKey: 'inline-contact:cl_test',
        eventName: 'chat_lead.created',
        adminEventNames: ['chat_lead.created', 'lead.created'],
        payload: leadPayload({ id: 'inline-contact:cl_test', full_name: 'Sara', phone: '0612345678' }),
      });

      expect(result.status).toBe('sent');
      // The delivery should use the matched event name 'lead.created' for idempotency
      expect(engineMock.enqueueDelivery).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'lead.created',
          idempotencyKey: 'lead.created:inline-contact:cl_test',
        }),
      );
    });

    it('continues dispatching remaining endpoints when one throws', async () => {
      const { endpoint: ep1 } = await createWebhookEndpoint({
        url: 'https://hook.example.com/admin1',
        events: ['chat_lead.created'],
        description: 'endpoint 1',
      });
      await createWebhookEndpoint({
        url: 'https://hook.example.com/admin2',
        events: ['chat_lead.created'],
        description: 'endpoint 2',
      });

      // First endpoint throws, second succeeds
      const succeededDelivery = makeDelivery({ status: 'succeeded', attemptCount: 1, responseStatus: 200 });
      engineMock.enqueueDelivery
        .mockRejectedValueOnce(new Error('DB error'))
        .mockResolvedValueOnce(succeededDelivery);
      engineMock.attemptDelivery.mockResolvedValue(succeededDelivery);

      const result = await dispatchToAllChannels({
        source: 'inline-contact',
        sourceId: 'cl_test',
        idempotencyKey: 'inline-contact:cl_test',
        eventName: 'chat_lead.created',
        adminEventNames: ['chat_lead.created'],
        payload: leadPayload({ id: 'inline-contact:cl_test', full_name: 'Sara', phone: '0612345678' }),
      });

      expect(result.status).toBe('sent');
      expect(result.adminEndpointsAttempted).toBeGreaterThanOrEqual(1);
    });

    it('returns failed when all admin endpoint enqueueDelivery calls throw', async () => {
      await createWebhookEndpoint({
        url: 'https://hook.example.com/admin',
        events: ['chat_lead.created'],
        description: 'failing endpoint',
      });
      engineMock.enqueueDelivery.mockRejectedValue(new Error('DB connection lost'));

      const result = await dispatchToAllChannels({
        source: 'inline-contact',
        sourceId: 'cl_test',
        idempotencyKey: 'inline-contact:cl_test',
        eventName: 'chat_lead.created',
        payload: leadPayload({ id: 'inline-contact:cl_test', full_name: 'Sara', phone: '0612345678' }),
      });

      expect(result.status).toBe('failed');
      expect(result.lastError).toBe('admin-endpoint-dispatch-failed');
    });
  });

  describe('outbound URL fallback', () => {
    it('falls back to outbound URL when no admin endpoints match', async () => {
      envMock.OUTBOUND_WEBHOOK_URL = 'https://hook.example.com/outbound';
      envMock.OUTBOUND_WEBHOOK_SECRET = 'outbound-secret-min-32-chars-for-tests';

      const captured: { body?: Record<string, unknown>; event?: string | null } = {};
      server.use(
        http.post('https://hook.example.com/outbound', async ({ request }) => {
          captured.body = (await request.json()) as Record<string, unknown>;
          captured.event = request.headers.get('x-femiglow-event');
          return HttpResponse.json({ ok: true });
        }),
      );

      const result = await dispatchToAllChannels({
        source: 'chat-lead',
        sourceId: 'cl_test',
        idempotencyKey: 'chat-lead:cl_test',
        eventName: 'chat_lead.created',
        payload: leadPayload({ id: 'chat-lead:cl_test', full_name: 'Sara', phone: '0612345678' }),
      });

      expect(result.status).toBe('sent');
      expect(result.adminEndpointsAttempted).toBe(0);
      expect(captured.event).toBe('chat_lead.created');
      expect(captured.body).toMatchObject({
        id: 'chat-lead:cl_test',
        full_name: 'Sara',
      });
    });

    it('returns disabled when no admin endpoints and no outbound URL configured', async () => {
      const result = await dispatchToAllChannels({
        source: 'chat-lead',
        sourceId: 'cl_test',
        idempotencyKey: 'chat-lead:cl_test',
        eventName: 'chat_lead.created',
        payload: leadPayload({ id: 'chat-lead:cl_test', full_name: 'Sara', phone: '0612345678' }),
      });

      expect(result.status).toBe('disabled');
      expect(result.lastError).toBe('no-endpoint-configured');
      expect(result.adminEndpointsAttempted).toBe(0);
    });
  });

  describe('priority ordering', () => {
    it('prefers admin endpoint over outbound URL', async () => {
      await createWebhookEndpoint({
        url: 'https://hook.example.com/admin',
        events: ['lead.step1_abandoned'],
        description: 'admin endpoint',
      });
      envMock.OUTBOUND_WEBHOOK_URL = 'https://hook.example.com/outbound';
      envMock.OUTBOUND_WEBHOOK_SECRET = 'outbound-secret-min-32-chars-for-tests';

      const delivery = makeDelivery({ status: 'succeeded', attemptCount: 1, responseStatus: 200 });
      engineMock.enqueueDelivery.mockResolvedValue(delivery);
      engineMock.attemptDelivery.mockResolvedValue(delivery);

      // Set up MSW handlers for both URLs to track which is called
      let adminCalled = false;
      let outboundCalled = false;
      server.use(
        http.post('https://hook.example.com/admin', () => {
          adminCalled = true;
          return HttpResponse.json({ ok: true });
        }),
        http.post('https://hook.example.com/outbound', () => {
          outboundCalled = true;
          return HttpResponse.json({ ok: true });
        }),
      );

      const result = await dispatchToAllChannels({
        source: 'lead-step1-abandon',
        sourceId: 'cl_test',
        idempotencyKey: 'lead-step1-abandon:cl_test',
        eventName: 'lead.step1_abandoned',
        payload: leadPayload({ id: 'lead-step1-abandon:cl_test', full_name: 'Nadia', phone: '0612345678' }),
      });

      expect(result.status).toBe('sent');
      expect(result.adminEndpointsAttempted).toBe(1);
      // Only admin endpoint should be called via engine, not outbound URL via fetch
      expect(adminCalled).toBe(false); // Engine is mocked, not called via fetch
      expect(outboundCalled).toBe(false);
      expect(engineMock.enqueueDelivery).toHaveBeenCalledTimes(1);
    });
  });

  describe('result aggregation', () => {
    it('prefers succeeded result when multiple endpoints attempted and one succeeds', async () => {
      await createWebhookEndpoint({
        url: 'https://hook.example.com/admin1',
        events: ['chat_lead.created'],
        description: 'ep1',
      });
      await createWebhookEndpoint({
        url: 'https://hook.example.com/admin2',
        events: ['chat_lead.created'],
        description: 'ep2',
      });

      // First endpoint pending, second succeeded
      const pendingDelivery = makeDelivery({ id: 'wd_pending', status: 'pending', attemptCount: 1, responseStatus: 503 });
      const succeededDelivery = makeDelivery({ id: 'wd_ok', status: 'succeeded', attemptCount: 1, responseStatus: 200 });

      engineMock.enqueueDelivery
        .mockResolvedValueOnce(pendingDelivery)
        .mockResolvedValueOnce(succeededDelivery);
      engineMock.attemptDelivery
        .mockResolvedValueOnce(pendingDelivery)
        .mockResolvedValueOnce(succeededDelivery);

      const result = await dispatchToAllChannels({
        source: 'inline-contact',
        sourceId: 'cl_test',
        idempotencyKey: 'inline-contact:cl_test',
        eventName: 'chat_lead.created',
        adminEventNames: ['chat_lead.created'],
        payload: leadPayload({ id: 'inline-contact:cl_test', full_name: 'Sara', phone: '0612345678' }),
      });

      expect(result.status).toBe('sent');
      expect(result.adminEndpointsAttempted).toBe(2);
    });

    it('prefers pending over failed when no success', async () => {
      await createWebhookEndpoint({
        url: 'https://hook.example.com/admin',
        events: ['chat_lead.created'],
        description: 'ep',
      });

      const pendingDelivery = makeDelivery({ status: 'pending', attemptCount: 1, responseStatus: 503 });
      engineMock.enqueueDelivery.mockResolvedValue(pendingDelivery);
      engineMock.attemptDelivery.mockResolvedValue(pendingDelivery);

      const result = await dispatchToAllChannels({
        source: 'inline-contact',
        sourceId: 'cl_test',
        idempotencyKey: 'inline-contact:cl_test',
        eventName: 'chat_lead.created',
        payload: leadPayload({ id: 'inline-contact:cl_test', full_name: 'Sara', phone: '0612345678' }),
      });

      expect(result.status).toBe('pending');
    });
  });
});