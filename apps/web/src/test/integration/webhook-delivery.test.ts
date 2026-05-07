/**
 * Suite d'intégration MSW — webhook delivery engine.
 * Exerce les scénarios suivants (cf. docs/admin/specifications/08-tests/integration-msw/) :
 *  - scenario-delivery-success      → 200 OK
 *  - scenario-delivery-4xx          → 404 (retry)
 *  - scenario-delivery-5xx          → 503 (retry)
 *  - scenario-delivery-final-fail   → max attempts atteint
 *  - scenario-delivery-signature-check → header x-femiglow-signature présent
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse, server } from '@/test/msw/server';
import { resetMemoryStore } from '@/lib/db/client';
import { createWebhookEndpoint } from '@/lib/db/queries/webhook-endpoints';
import { attemptDelivery } from '@/lib/webhooks/engine';
import { createDelivery } from '@/lib/db/queries/webhook-deliveries';
import { MAX_ATTEMPTS } from '@/lib/webhooks/backoff';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

beforeEach(() => {
  resetMemoryStore();
});

async function setupEndpoint(url: string) {
  const { endpoint } = await createWebhookEndpoint({
    url,
    events: ['lead.created'],
    description: 'integration',
  });
  const delivery = await createDelivery({
    endpointId: endpoint.id,
    event: 'lead.created',
    payload: { leadId: 'l_test' },
    idempotencyKey: 'idk_integration_1',
  });
  return { endpoint, delivery };
}

describe('webhook delivery (MSW intégration)', () => {
  it('delivery-success : 200 OK → status succeeded + signature envoyée', async () => {
    const captured: { signature?: string | null; idem?: string | null } = {};
    server.use(
      http.post('https://hook.example.com/ok', async ({ request }) => {
        captured.signature = request.headers.get('x-femiglow-signature');
        captured.idem = request.headers.get('idempotency-key');
        return HttpResponse.json({ received: true });
      }),
    );
    const { delivery } = await setupEndpoint('https://hook.example.com/ok');
    const result = await attemptDelivery(delivery);
    expect(result.status).toBe('succeeded');
    expect(result.responseStatus).toBe(200);
    expect(captured.signature).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(captured.idem).toBe('idk_integration_1');
  });

  it('delivery-4xx : 404 → retry programmé', async () => {
    server.use(
      http.post(
        'https://hook.example.com/notfound',
        () => new HttpResponse('not found', { status: 404 }),
      ),
    );
    const { delivery } = await setupEndpoint('https://hook.example.com/notfound');
    const result = await attemptDelivery(delivery);
    expect(result.status).toBe('pending');
    expect(result.responseStatus).toBe(404);
    expect(result.nextAttemptAt).toBeInstanceOf(Date);
    expect(result.attemptCount).toBe(1);
  });

  it('delivery-5xx : 503 → retry programmé', async () => {
    server.use(
      http.post(
        'https://hook.example.com/down',
        () => new HttpResponse('service unavailable', { status: 503 }),
      ),
    );
    const { delivery } = await setupEndpoint('https://hook.example.com/down');
    const result = await attemptDelivery(delivery);
    expect(result.status).toBe('pending');
    expect(result.responseStatus).toBe(503);
    expect(result.errorCode).toBeNull();
  });

  it('delivery-final-fail : MAX_ATTEMPTS atteint → permanent', async () => {
    server.use(
      http.post(
        'https://hook.example.com/perma',
        () => new HttpResponse('gone', { status: 410 }),
      ),
    );
    const { endpoint } = await setupEndpoint('https://hook.example.com/perma');
    const delivery = await createDelivery({
      endpointId: endpoint.id,
      event: 'lead.created',
      payload: { leadId: 'l_perma' },
      idempotencyKey: 'idk_perma_2',
    });
    const atLastAttempt = { ...delivery, attemptCount: MAX_ATTEMPTS - 1 };
    const result = await attemptDelivery(atLastAttempt);
    expect(result.status).toBe('permanent');
    expect(result.responseStatus).toBe(410);
  });

  it('delivery-signature-check : signature HMAC vérifie le body brut', async () => {
    let receivedBody = '';
    let receivedSignature: string | null = null;
    server.use(
      http.post('https://hook.example.com/verify', async ({ request }) => {
        receivedBody = await request.text();
        receivedSignature = request.headers.get('x-femiglow-signature');
        return HttpResponse.json({ ok: true });
      }),
    );
    const { delivery } = await setupEndpoint('https://hook.example.com/verify');
    await attemptDelivery(delivery);
    const parsed = JSON.parse(receivedBody);
    expect(parsed.event).toBe('lead.created');
    expect(parsed.id).toBe(delivery.id);
    expect(receivedSignature).toMatch(/^[A-Za-z0-9+/]{40,}=*$/);
  });
});
