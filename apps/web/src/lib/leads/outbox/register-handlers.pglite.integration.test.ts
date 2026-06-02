// @vitest-environment node
/**
 * OWBS P5 — le handler `order_webhook` enregistré est exécuté par le worker :
 * re-fetch du lead + invocation de `dispatchOrderWebhook` (mockés), via pglite.
 * TST-I-17 (côté effets) + garde lead-introuvable.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';

const { getByIdMock, dispatchMock } = vi.hoisted(() => ({
  getByIdMock: vi.fn(),
  dispatchMock: vi.fn(),
}));

vi.mock('@/lib/checkout/repos/lead-repo', () => ({
  wizardLeadRepo: { getById: getByIdMock },
}));
vi.mock('@/lib/webhooks/outbound/sources/from-order', () => ({
  dispatchOrderWebhook: dispatchMock,
}));

import { __resetTestDb, __setTestDb } from '@/lib/db/client';
import { leadOutboxRepo } from './lead-outbox-repo';
import { pickAndProcessBatch } from './lead-outbox-processor';
import { registerLeadEffectHandlers } from './register-handlers';
import { __clearLeadEffectHandlers } from './handlers';

let client: PGlite;
const MIGRATION = resolve(process.cwd(), 'drizzle/migrations/0079_owbs_lead_event_outbox.sql');

beforeAll(async () => {
  client = new PGlite();
  __setTestDb(drizzlePglite(client) as unknown as Parameters<typeof __setTestDb>[0]);
  const file = readFileSync(MIGRATION, 'utf8');
  for (const stmt of file.split(/^\s*-->\s*statement-breakpoint\s*$/im).map((s) => s.trim()).filter(Boolean)) {
    await client.exec(stmt);
  }
});
afterAll(() => __resetTestDb());
beforeEach(async () => {
  await client.exec('TRUNCATE lead_event_outbox');
  __clearLeadEffectHandlers();
  getByIdMock.mockReset();
  dispatchMock.mockReset();
  registerLeadEffectHandlers();
});

describe('order_webhook handler via worker (OWBS P5)', () => {
  it('re-fetch le lead + invoque dispatchOrderWebhook → done', async () => {
    getByIdMock.mockResolvedValue({ id: 'cl_aaaaaaaaaaaaaaaaaaaa', phoneE164: '+212600000000', source: 'wizard_kit' });
    dispatchMock.mockResolvedValue({ status: 'sent', attempts: 1 });

    await leadOutboxRepo.enqueue({
      type: 'order_webhook',
      leadId: 'cl_aaaaaaaaaaaaaaaaaaaa',
      dedupeKey: 'ord_1',
      payload: {
        orderId: 'ord_1',
        totalCents: 32000,
        currency: 'MAD',
        items: [{ sku: 'FEMI-KIT-100', name: 'Kit', quantity: 1, variantKey: null }],
      },
    });

    const res = await pickAndProcessBatch();
    expect(res.done).toBe(1);
    expect(getByIdMock).toHaveBeenCalledWith('cl_aaaaaaaaaaaaaaaaaaaa');
    expect(dispatchMock).toHaveBeenCalledOnce();
    const ctx = dispatchMock.mock.calls[0]![0] as { order: { id: string } };
    expect(ctx.order.id).toBe('ord_1');
  });

  it('lead introuvable → reschedule (jamais done, webhook non appelé)', async () => {
    getByIdMock.mockResolvedValue(null);
    await leadOutboxRepo.enqueue({
      type: 'order_webhook',
      leadId: 'cl_bbbbbbbbbbbbbbbbbbbb',
      dedupeKey: 'ord_2',
      payload: { orderId: 'ord_2', totalCents: 1, currency: 'MAD', items: [] },
    });
    const res = await pickAndProcessBatch();
    expect(res.done).toBe(0);
    expect(res.rescheduled).toBe(1);
    expect(dispatchMock).not.toHaveBeenCalled();
  });
});
