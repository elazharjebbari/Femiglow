import { describe, it, expect, beforeEach } from 'vitest';
import { resetMemoryStore } from '@/lib/db/client';
import { createWebhookEndpoint } from '@/lib/db/queries/webhook-endpoints';
import { getDelivery } from '@/lib/db/queries/webhook-deliveries';
import { attemptDelivery, enqueueDelivery, processBatch } from './engine';
import { MAX_ATTEMPTS } from './backoff';

beforeEach(() => {
  resetMemoryStore();
  process.env.WEBHOOK_SECRET_KEY = 'k'.repeat(32);
});

describe('webhook engine: enqueue', () => {
  it('crée une delivery pending', async () => {
    const { endpoint } = await createWebhookEndpoint({
      url: 'https://api.example.com/hook',
      events: ['lead.created'],
    });
    const d = await enqueueDelivery({
      endpointId: endpoint.id,
      event: 'lead.created',
      idempotencyKey: 'k1',
      payload: { lead_id: 'l_1' },
    });
    expect(d.status).toBe('pending');
    expect(d.attemptCount).toBe(0);
  });

  it('idempotency: 2 enqueues même clé retournent la même delivery', async () => {
    const { endpoint } = await createWebhookEndpoint({
      url: 'https://api.example.com/hook',
      events: ['lead.created'],
    });
    const a = await enqueueDelivery({
      endpointId: endpoint.id,
      event: 'lead.created',
      idempotencyKey: 'same',
      payload: {},
    });
    const b = await enqueueDelivery({
      endpointId: endpoint.id,
      event: 'lead.created',
      idempotencyKey: 'same',
      payload: {},
    });
    expect(a.id).toBe(b.id);
  });

  it('refuse les événements non souscrits', async () => {
    const { endpoint } = await createWebhookEndpoint({
      url: 'https://api.example.com/hook',
      events: ['lead.created'],
    });
    await expect(
      enqueueDelivery({
        endpointId: endpoint.id,
        event: 'lead.status_changed',
        idempotencyKey: 'k',
        payload: {},
      }),
    ).rejects.toThrow();
  });
});

describe('webhook engine: attempt', () => {
  it('marque succeeded sur 2xx avec signature HMAC', async () => {
    const { endpoint } = await createWebhookEndpoint({
      url: 'https://api.example.com/hook',
      events: ['lead.created'],
    });
    const delivery = await enqueueDelivery({
      endpointId: endpoint.id,
      event: 'lead.created',
      idempotencyKey: 'k',
      payload: {},
    });
    let receivedSignature: string | null = null;
    const fetchImpl: typeof fetch = async (_url, init) => {
      receivedSignature =
        (init?.headers as Record<string, string> | undefined)?.['x-femiglow-signature'] ?? null;
      return new Response('OK', { status: 200 });
    };
    const result = await attemptDelivery(delivery, { fetchImpl });
    expect(result.status).toBe('succeeded');
    expect(receivedSignature).toBeTruthy();
  });

  it('reprogramme un retry sur 5xx (status pending, nextAttemptAt futur)', async () => {
    const { endpoint } = await createWebhookEndpoint({
      url: 'https://api.example.com/hook',
      events: ['lead.created'],
    });
    const delivery = await enqueueDelivery({
      endpointId: endpoint.id,
      event: 'lead.created',
      idempotencyKey: 'k',
      payload: {},
    });
    const fetchImpl: typeof fetch = async () => new Response('boom', { status: 503 });
    const result = await attemptDelivery(delivery, { fetchImpl });
    expect(result.status).toBe('pending');
    expect(result.nextAttemptAt).toBeInstanceOf(Date);
    expect(result.attemptCount).toBe(1);
  });

  it('marque permanent après MAX_ATTEMPTS échecs', async () => {
    const { endpoint } = await createWebhookEndpoint({
      url: 'https://api.example.com/hook',
      events: ['lead.created'],
    });
    const delivery = await enqueueDelivery({
      endpointId: endpoint.id,
      event: 'lead.created',
      idempotencyKey: 'k',
      payload: {},
    });
    const fetchImpl: typeof fetch = async () => new Response('nope', { status: 500 });
    let current = delivery;
    for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
      current = await attemptDelivery(current, { fetchImpl });
    }
    const final = await getDelivery(delivery.id);
    expect(final?.status).toBe('permanent');
  });
});

describe('webhook engine: processBatch', () => {
  it('traite plusieurs deliveries pending', async () => {
    const { endpoint } = await createWebhookEndpoint({
      url: 'https://api.example.com/hook',
      events: ['lead.created'],
    });
    for (let i = 0; i < 3; i += 1) {
      await enqueueDelivery({
        endpointId: endpoint.id,
        event: 'lead.created',
        idempotencyKey: `k${i}`,
        payload: {},
      });
    }
    const fetchImpl: typeof fetch = async () => new Response('OK', { status: 200 });
    const result = await processBatch({ limit: 10, fetchImpl });
    expect(result.processed).toBe(3);
    expect(result.succeeded).toBe(3);
    expect(result.failed).toBe(0);
  });
});
