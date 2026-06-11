import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle, type FakeDrizzle } from './_helpers/fake-drizzle';

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(),
}));
vi.mock('../send', () => ({
  sendTransactional: vi.fn(),
}));

import { db as getDb } from '@/lib/db/client';
import { sendTransactional } from '../send';
import { tickAutomation } from '../automation/runner';

function makeRun(overrides: Record<string, unknown> = {}) {
  return {
    id: 'run-1',
    automation_id: 'auto-1',
    recipient_email: 'a@b.c',
    triggered_at: new Date(),
    current_step: 0,
    status: 'running',
    context_json: { recipientEmail: 'a@b.c', firstName: 'Souheila' },
    next_action_at: new Date(),
    finished_at: null,
    outbox_ids: [],
    ...overrides,
  };
}

const SEND_TEMPLATE_AUTOMATION = {
  id: 'auto-1',
  slug: 'cart-abandoned-1h',
  active: true,
  steps: [
    { kind: 'send', template: 'cart-abandoned', payloadKeys: ['firstName'] },
  ],
};

const WAIT_THEN_SEND_AUTOMATION = {
  id: 'auto-1',
  slug: 'cart-abandoned-1h',
  active: true,
  steps: [
    { kind: 'wait', durationMs: 3_600_000 },
    { kind: 'send', template: 'cart-abandoned', payloadKeys: ['firstName'] },
  ],
};

describe('tickAutomation', () => {
  let drizzle: FakeDrizzle;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns zero counts when no runs are due', async () => {
    drizzle = makeFakeDrizzle({ executeResult: { rows: [] } });
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const r = await tickAutomation();
    expect(r.picked).toBe(0);
    expect(r.advanced).toBe(0);
    expect(r.completed).toBe(0);
    expect(r.errored).toBe(0);
  });

  it('advances a wait step (UPDATE with new nextActionAt)', async () => {
    drizzle = makeFakeDrizzle({
      executeResult: { rows: [makeRun()] },
      selectResult: [WAIT_THEN_SEND_AUTOMATION],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const r = await tickAutomation();
    expect(r.picked).toBe(1);
    // 1st update : claim (next_action_at=NULL) — done via execute() in CTE.
    // Then a second update : currentStep → 1, nextActionAt = now + 1h, status='running'
    const updates = drizzle.calls.update;
    expect(updates.length).toBeGreaterThanOrEqual(1);
    const lastSet = updates[updates.length - 1]!.set as Record<string, unknown>;
    expect(lastSet.currentStep).toBe(1);
    expect(lastSet.status).toBe('running');
    expect(lastSet.nextActionAt).toBeInstanceOf(Date);
  });

  it('completes when no more steps after wait', async () => {
    const oneWaitOnly = {
      ...WAIT_THEN_SEND_AUTOMATION,
      steps: [{ kind: 'wait', durationMs: 1000 }],
    };
    drizzle = makeFakeDrizzle({
      executeResult: { rows: [makeRun()] },
      selectResult: [oneWaitOnly],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const r = await tickAutomation();
    expect(r.completed).toBe(1);
  });

  it('sends the email when step kind is "send"', async () => {
    vi.mocked(sendTransactional).mockResolvedValue({
      status: 'queued',
      outboxId: 'outbox-xyz',
    });
    drizzle = makeFakeDrizzle({
      executeResult: { rows: [makeRun()] },
      selectResult: [SEND_TEMPLATE_AUTOMATION],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const r = await tickAutomation();
    expect(r.completed).toBe(1);
    expect(sendTransactional).toHaveBeenCalledTimes(1);
    const call = vi.mocked(sendTransactional).mock.calls[0]![0]!;
    expect(call.template).toBe('cart-abandoned');
    expect(call.to.email).toBe('a@b.c');
    expect(call.payload).toMatchObject({ firstName: 'Souheila' });
    expect(call.idempotencyKey).toMatch(/^automation:run-1:step0$/);
    // outboxIds is appended in the second update
    const updates = drizzle.calls.update;
    const lastUpdate = updates[updates.length - 1]!.set as Record<string, unknown>;
    expect(Array.isArray(lastUpdate.outboxIds)).toBe(true);
    expect((lastUpdate.outboxIds as string[])[0]).toBe('outbox-xyz');
  });

  it('cancels the run when parent automation is disabled', async () => {
    drizzle = makeFakeDrizzle({
      executeResult: { rows: [makeRun()] },
      selectResult: [{ ...SEND_TEMPLATE_AUTOMATION, active: false }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const r = await tickAutomation();
    expect(r.completed).toBe(1);
    const lastUpdate = drizzle.calls.update[drizzle.calls.update.length - 1]!.set as Record<string, unknown>;
    expect(lastUpdate.status).toBe('cancelled');
    // No email was sent
    expect(sendTransactional).not.toHaveBeenCalled();
  });

  it('demotes errored runs to status=errored without crashing the batch', async () => {
    // Two runs : first one will error (template unknown), second one OK
    const runErr = makeRun({ id: 'run-err' });
    const runOk = makeRun({ id: 'run-ok' });
    drizzle = makeFakeDrizzle({
      executeResult: { rows: [runErr, runOk] },
    });
    // Each select returns the appropriate parent automation.
    // NB : le 1er select() de tickAutomation est désormais sweepOrphanRuns (qui
    // n'attend pas via .limit() → son await de .where() retourne `obj`, ignoré
    // par le garde Array.isArray du sweep). Les lookups d'automation suivent.
    let selCount = 0;
    drizzle.select.mockImplementation(() => {
      selCount++;
      const obj: Record<string, unknown> = {
        from: vi.fn(() => obj),
        where: vi.fn(() => obj),
        limit: vi.fn(() => {
          // selCount===1 : sweepOrphanRuns (aucun orphelin)
          // selCount===2 : automation du 1er run → template inconnu → throw
          // selCount>=3  : automation du 2e run → wait-only valide
          if (selCount === 2) {
            return Promise.resolve([{
              ...SEND_TEMPLATE_AUTOMATION,
              steps: [{ kind: 'send', template: 'NON-EXISTENT', payloadKeys: [] }],
            }]);
          }
          return Promise.resolve([{
            ...WAIT_THEN_SEND_AUTOMATION,
            steps: [{ kind: 'wait', durationMs: 1000 }],
          }]);
        }),
      };
      return obj;
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const r = await tickAutomation();
    expect(r.picked).toBe(2);
    expect(r.errored).toBe(1);
    expect(r.completed).toBe(1); // 2nd one finished (wait-only, no next step)
  });
});
