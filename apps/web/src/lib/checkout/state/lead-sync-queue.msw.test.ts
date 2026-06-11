// @vitest-environment node
/**
 * OWBS — Tests MSW de la file via le transport HTTP réel (`createHttpSyncTransport`).
 * Valide le comportement réseau : retry idempotent (503→201, même clé), drop sur
 * 409, reprise après erreur réseau. cf. 04-tests/msw-plan.md (TST-M-02..04).
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { server, http, HttpResponse } from '@/test/msw/server';

import { createLeadSyncQueue, type Envelope } from './lead-sync-queue';
import { createHttpSyncTransport } from './lead-sync-transport';

const URL = 'http://localhost/api/checkout/lead';
const LEAD = 'cl_3xq7m2k9v4b1n8p0w5tz';
const noSleep = () => Promise.resolve();

function env(idempotencyKey: string): Omit<Envelope, 'mutationId' | 'enqueuedAt' | 'attempt'> {
  return {
    leadId: LEAD,
    scope: 'lead_create',
    endpoint: URL,
    method: 'POST',
    idempotencyKey,
    payload: { leadId: LEAD },
  };
}

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('lead-sync-queue via transport HTTP + MSW (OWBS P3)', () => {
  // TST-M-02 — 503 ×2 puis 201, MÊME Idempotency-Key, file vidée.
  it('retry 503→201 avec la même Idempotency-Key, sans doublon', async () => {
    let calls = 0;
    const keys: string[] = [];
    server.use(
      http.post(URL, ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key') ?? '');
        calls += 1;
        if (calls < 3) {
          return HttpResponse.json(
            { error: { code: 'db_unavailable', message: 'temporaire' } },
            { status: 503 },
          );
        }
        return HttpResponse.json({ leadId: LEAD, status: 'created', nextStep: 'address' }, { status: 201 });
      }),
    );
    const q = createLeadSyncQueue({
      transport: createHttpSyncTransport(),
      storage: null,
      sleep: noSleep,
    });
    q.enqueue(env('idem_create_msw_1'));
    await q.flush();
    expect(calls).toBe(3);
    expect(new Set(keys)).toEqual(new Set(['idem_create_msw_1']));
    expect(q.pending()).toHaveLength(0);
  });

  // TST-M-03 — 409 → drop (non-retryable), pas de retry infini.
  it('409 idempotency_conflict → drop sans retry', async () => {
    let calls = 0;
    server.use(
      http.post(URL, () => {
        calls += 1;
        return HttpResponse.json(
          { error: { code: 'idempotency_conflict', message: 'déjà appliqué' } },
          { status: 409 },
        );
      }),
    );
    const q = createLeadSyncQueue({ transport: createHttpSyncTransport(), storage: null, sleep: noSleep });
    q.enqueue(env('idem_create_msw_2'));
    await q.flush();
    expect(calls).toBe(1); // pas de retry
    expect(q.pending()).toHaveLength(0);
  });

  // TST-M-04 — erreur réseau (retryable) puis reprise.
  it('erreur réseau puis succès : la file se vide après reprise', async () => {
    let calls = 0;
    server.use(
      http.post(URL, () => {
        calls += 1;
        if (calls === 1) return HttpResponse.error(); // network error
        return HttpResponse.json({ leadId: LEAD }, { status: 201 });
      }),
    );
    const q = createLeadSyncQueue({ transport: createHttpSyncTransport(), storage: null, sleep: noSleep });
    q.enqueue(env('idem_create_msw_3'));
    await q.flush();
    expect(calls).toBe(2);
    expect(q.pending()).toHaveLength(0);
  });
});
