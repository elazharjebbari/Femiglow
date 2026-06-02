/**
 * OWBS — TST-I-12..14 : POST /api/checkout/lead/sync (batch idempotent).
 *  - flag OFF → 204 (no-op)
 *  - batch valide → applyBatch + 200 {results}
 *  - désordre (scopes mixtes) → toutes les envelopes passées à applyBatch
 *  - corps trop volumineux → 413
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { envMock, applyBatchMock } = vi.hoisted(() => ({
  envMock: { CHECKOUT_OPTIMISTIC_WIZARD_ENABLED: 'true' as 'true' | 'false' },
  applyBatchMock: vi.fn(),
}));

vi.mock('@/lib/env', () => ({ env: envMock }));
vi.mock('@/lib/checkout/services/lead-service', () => ({
  leadService: { applyBatch: applyBatchMock },
}));

import { POST } from '../route';

const LEAD = 'cl_3xq7m2k9v4b1n8p0w5tz';

function makeReq(body: unknown, ip?: string): Request {
  return new Request('http://test/api/checkout/lead/sync', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: ip ? { 'x-forwarded-for': ip } : undefined,
  });
}

const VALID = { envelopes: [{ mutationId: 'm', leadId: LEAD, scope: 'lead_create', payload: {} }] };

beforeEach(() => {
  envMock.CHECKOUT_OPTIMISTIC_WIZARD_ENABLED = 'true';
  applyBatchMock.mockReset().mockResolvedValue([{ mutationId: 'mut_1', ok: true, status: 'applied' }]);
});

describe('POST /api/checkout/lead/sync', () => {
  it('flag OFF → 204 (no-op, le beacon ne doit pas échouer)', async () => {
    envMock.CHECKOUT_OPTIMISTIC_WIZARD_ENABLED = 'false';
    const res = await POST(makeReq({ envelopes: [{ mutationId: 'mut_1', leadId: LEAD, scope: 'lead_create', payload: {} }] }) as never);
    expect(res.status).toBe(204);
    expect(applyBatchMock).not.toHaveBeenCalled();
  });

  // TST-I-12
  it('batch valide → applyBatch + 200 avec results', async () => {
    const res = await POST(
      makeReq({ envelopes: [{ mutationId: 'mut_1', leadId: LEAD, scope: 'lead_create', payload: { ok: 1 } }] }) as never,
    );
    expect(res.status).toBe(200);
    expect(applyBatchMock).toHaveBeenCalledOnce();
    const body = await res.json();
    expect(body.results).toHaveLength(1);
  });

  // TST-I-13 — désordre / scopes mixtes tous transmis à applyBatch
  it('scopes mixtes (désordre) → toutes les envelopes transmises', async () => {
    await POST(
      makeReq({
        envelopes: [
          { mutationId: 'm2', leadId: LEAD, scope: 'address_update', payload: {} },
          { mutationId: 'm1', leadId: LEAD, scope: 'lead_create', payload: {} },
        ],
      }) as never,
    );
    const passed = applyBatchMock.mock.calls[0]![0] as Array<{ scope: string }>;
    expect(passed.map((e) => e.scope)).toEqual(['address_update', 'lead_create']);
  });

  // TST-I-14 — corps trop volumineux → 413
  it('corps > MAX_BYTES → 413', async () => {
    const big = 'x'.repeat(61_000);
    const res = await POST(
      makeReq({ envelopes: [{ mutationId: 'm1', leadId: LEAD, scope: 'lead_create', payload: { big } }] }) as never,
    );
    expect(res.status).toBe(413);
    expect(applyBatchMock).not.toHaveBeenCalled();
  });

  it('envelope malformée (leadId invalide) → 400', async () => {
    const res = await POST(
      makeReq({ envelopes: [{ mutationId: 'm1', leadId: 'bad', scope: 'lead_create', payload: {} }] }) as never,
    );
    expect(res.status).toBe(400);
  });

  // TST-I-18 — rate-limit par IP (au-delà du seuil → 429).
  it('rate-limit par IP : 429 au-delà du seuil', async () => {
    const ip = '203.0.113.77'; // IP dédiée pour isoler le compteur
    for (let i = 0; i < 40; i += 1) {
      const res = await POST(makeReq(VALID, ip) as never);
      expect(res.status).toBe(200);
    }
    const over = await POST(makeReq(VALID, ip) as never);
    expect(over.status).toBe(429);
    expect(over.headers.get('Retry-After')).toBeTruthy();
  });
});
