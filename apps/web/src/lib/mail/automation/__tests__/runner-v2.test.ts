/**
 * Tests runner V2 — dispatch by kind (tag, update_lead, webhook, wait_for_event).
 *
 * Mocks DB + sendTransactional. Focuses on the kind-routing inside processRun
 * via a single-tick scenario per kind.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle } from '@/lib/mail/__tests__/_helpers/fake-drizzle';

vi.mock('@/lib/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/client')>('@/lib/db/client');
  return { ...actual, db: vi.fn() };
});
vi.mock('@/lib/mail/send', () => ({
  sendTransactional: vi.fn().mockResolvedValue({ status: 'queued', outboxId: 'ob_1' }),
}));
vi.mock('@/lib/mail/catalog', async () => {
  const actual = await vi.importActual<typeof import('@/lib/mail/catalog')>('@/lib/mail/catalog');
  return { ...actual, isKnownTemplate: () => true };
});

import { db as getDb } from '@/lib/db/client';
import { tickAutomation } from '../runner';

beforeEach(() => {
  vi.clearAllMocks();
});

function autoRow(steps: unknown) {
  return {
    id: 'auto-1',
    slug: 'test-flow',
    active: true,
    steps,
    trigger: 'manual',
    triggerConditions: null,
  };
}

function runRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'run-1',
    automation_id: 'auto-1',
    recipient_email: 'user@example.com',
    triggered_at: new Date(),
    current_step: 0,
    status: 'running',
    context_json: { recipientEmail: 'user@example.com' },
    next_action_at: new Date(),
    finished_at: null,
    outbox_ids: [],
    awaiting_event_name: null,
    awaiting_until: null,
    errored_at: null,
    errored_reason: null,
    ...overrides,
  };
}

describe('runner V2 dispatch', () => {
  it('dispatches tag step + advances', async () => {
    const drizzle = makeFakeDrizzle({
      executeResult: { rows: [runRow()] },
      selectResult: [autoRow([{ kind: 'tag', action: 'add', tag: 'vip' }])],
    });
    // Ordre des select() dans tickAutomation : (1) sweepOrphanRuns → [] ;
    // (2) processRun charge l'automation ; (3) condition-evaluator/lead lookup.
    let selectCount = 0;
    drizzle.select.mockImplementation((_cols?: unknown) => {
      selectCount++;
      const rows =
        selectCount === 1
          ? [] // sweepOrphanRuns : aucun orphelin
          : selectCount === 2
            ? [autoRow([{ kind: 'tag', action: 'add', tag: 'vip' }])]
            : [{ id: 'lead-1' }];
      const obj: Record<string, unknown> = {
        from: vi.fn(() => obj),
        where: vi.fn(() => obj),
        limit: vi.fn(() => Promise.resolve(rows)),
        orderBy: vi.fn(() => obj),
        // Thenable : le sweep await `.select().from().where()` sans `.limit()`.
        then: (cb: (r: unknown[]) => unknown) => Promise.resolve(rows).then(cb),
      };
      return obj;
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const r = await tickAutomation();
    expect(r.picked).toBe(1);
    expect(r.completed).toBe(1);
    // Tag insert was made
    expect(drizzle.calls.insert.length).toBeGreaterThanOrEqual(1);
    const tagInsert = drizzle.calls.insert.find(
      (c) => (c.values as { tag?: string }).tag === 'vip',
    );
    expect(tagInsert).toBeTruthy();
  });

  it('dispatches wait_for_event → sets status=waiting_for_event', async () => {
    const drizzle = makeFakeDrizzle({
      executeResult: { rows: [runRow()] },
    });
    drizzle.select.mockImplementation((_cols?: unknown) => {
      const obj: Record<string, unknown> = {
        from: vi.fn(() => obj),
        where: vi.fn(() => obj),
        limit: vi.fn(() =>
          Promise.resolve([
            autoRow([
              {
                kind: 'wait_for_event',
                eventName: 'email.opened',
                timeoutMs: 86_400_000,
              },
            ]),
          ]),
        ),
        orderBy: vi.fn(() => obj),
      };
      return obj;
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const r = await tickAutomation();
    expect(r.picked).toBe(1);
    expect(r.completed).toBe(0); // still waiting
    // Run was updated with status='waiting_for_event'
    const lastUpdate = drizzle.calls.update[drizzle.calls.update.length - 1];
    expect(lastUpdate?.set).toMatchObject({
      status: 'waiting_for_event',
      awaitingEventName: 'email.opened',
    });
  });

  it('cancels run if automation is disabled', async () => {
    const drizzle = makeFakeDrizzle({
      executeResult: { rows: [runRow()] },
    });
    drizzle.select.mockImplementation((_cols?: unknown) => {
      const obj: Record<string, unknown> = {
        from: vi.fn(() => obj),
        where: vi.fn(() => obj),
        limit: vi.fn(() =>
          Promise.resolve([{ ...autoRow([{ kind: 'wait', durationMs: 1000 }]), active: false }]),
        ),
        orderBy: vi.fn(() => obj),
      };
      return obj;
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const r = await tickAutomation();
    expect(r.picked).toBe(1);
    expect(r.completed).toBe(1);
    const lastUpdate = drizzle.calls.update[drizzle.calls.update.length - 1];
    expect(lastUpdate?.set).toMatchObject({ status: 'cancelled' });
  });

  it('errors and demotes run on unknown template', async () => {
    const drizzle = makeFakeDrizzle({
      executeResult: { rows: [runRow()] },
    });
    drizzle.select.mockImplementation((_cols?: unknown) => {
      const obj: Record<string, unknown> = {
        from: vi.fn(() => obj),
        where: vi.fn(() => obj),
        limit: vi.fn(() =>
          Promise.resolve([
            autoRow([{ kind: 'send', template: 'unknown-template' }]),
          ]),
        ),
        orderBy: vi.fn(() => obj),
      };
      return obj;
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    // override isKnownTemplate to return false for this test
    const catalog = await import('@/lib/mail/catalog');
    vi.spyOn(catalog, 'isKnownTemplate').mockReturnValue(false);

    const r = await tickAutomation();
    expect(r.picked).toBe(1);
    expect(r.errored).toBe(1);
    const lastUpdate = drizzle.calls.update[drizzle.calls.update.length - 1];
    expect(lastUpdate?.set).toMatchObject({ status: 'errored' });
  });
});
