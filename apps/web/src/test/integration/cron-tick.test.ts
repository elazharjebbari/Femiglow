/**
 * Suite d'intégration MSW — POST /api/cron/tick.
 * Couvre :
 *  - scenario-cron-tick-unauthorized → 401 sans bearer / mauvais bearer
 *  - scenario-cron-tick-empty        → 0 processed quand aucune delivery
 *  - scenario-cron-tick-batch        → 3 deliveries pending → 3 processed
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse, server } from '@/test/msw/server';
import { POST } from '@/app/api/cron/tick/route';
import { resetMemoryStore } from '@/lib/db/client';
import { createWebhookEndpoint } from '@/lib/db/queries/webhook-endpoints';
import { createDelivery } from '@/lib/db/queries/webhook-deliveries';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  resetMemoryStore();
});

function buildRequest(authorization?: string) {
  const headers = new Headers();
  if (authorization) headers.set('authorization', authorization);
  return new Request('http://localhost/api/cron/tick', { method: 'POST', headers });
}

describe('POST /api/cron/tick (MSW intégration)', () => {
  it('cron-tick-unauthorized : sans bearer → 401', async () => {
    const res = await POST(buildRequest());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBeDefined();
  });

  it('cron-tick-unauthorized : bearer invalide → 401', async () => {
    const res = await POST(buildRequest('Bearer wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('cron-tick-empty : aucune delivery pending → 0 processed', async () => {
    const res = await POST(buildRequest(`Bearer ${process.env.CRON_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ processed: 0, succeeded: 0, failed: 0 });
  });

  it('cron-tick-batch : 3 deliveries pending → 3 processed et succeeded', async () => {
    server.use(
      http.post('https://hook.example.com/batch', () => HttpResponse.json({ ok: true })),
    );
    const { endpoint } = await createWebhookEndpoint({
      url: 'https://hook.example.com/batch',
      events: ['lead.created'],
      description: null,
    });
    for (let i = 0; i < 3; i++) {
      await createDelivery({
        endpointId: endpoint.id,
        event: 'lead.created',
        payload: { idx: i },
        idempotencyKey: `idk_batch_${i}`,
      });
    }
    const res = await POST(buildRequest(`Bearer ${process.env.CRON_SECRET}`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(3);
    expect(body.succeeded).toBe(3);
    expect(body.failed).toBe(0);
  });
});
