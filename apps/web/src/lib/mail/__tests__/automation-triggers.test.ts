import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle, type FakeDrizzle } from './_helpers/fake-drizzle';

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(),
}));

import { db as getDb } from '@/lib/db/client';
import { triggerAutomation } from '../automation/triggers';

const ACTIVE_AUTO = {
  id: 'auto-1',
  slug: 'cart-abandoned-1h',
  active: true,
};
const DISABLED_AUTO = { ...ACTIVE_AUTO, active: false };

describe('triggerAutomation', () => {
  let drizzle: FakeDrizzle;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns "unknown" when slug is not registered', async () => {
    drizzle = makeFakeDrizzle({ selectResult: [] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const r = await triggerAutomation('missing-slug', { recipientEmail: 'a@b.c' });
    expect(r.status).toBe('unknown');
  });

  it('returns "disabled" when automation.active=false', async () => {
    drizzle = makeFakeDrizzle({ selectResult: [DISABLED_AUTO] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const r = await triggerAutomation('cart-abandoned-1h', { recipientEmail: 'a@b.c' });
    expect(r.status).toBe('disabled');
  });

  it('enqueues a run when automation is active', async () => {
    // First select : automation lookup (returns active) ;
    // we don't pass dedupeKey so no second select is made.
    drizzle = makeFakeDrizzle({ selectResult: [ACTIVE_AUTO] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const r = await triggerAutomation(
      'cart-abandoned-1h',
      { recipientEmail: 'A@B.C', firstName: 'Souheila' },
    );
    expect(r.status).toBe('enqueued');
    expect(r.runId).toBeDefined();
    expect(drizzle.calls.insert).toHaveLength(1);
    const ins = drizzle.calls.insert[0]!;
    const v = ins.values as { recipientEmail: string; contextJson: Record<string, unknown> };
    expect(v.recipientEmail).toBe('a@b.c'); // normalized
    expect(v.contextJson).toMatchObject({ firstName: 'Souheila' });
  });

  it('detects duplicate when dedupeKey already exists in window', async () => {
    // Two consecutive selects : 1st returns automation, 2nd returns existing run
    let call = 0;
    drizzle = makeFakeDrizzle();
    drizzle.select.mockImplementation(() => {
      call++;
      const obj = {
        from: vi.fn(() => obj),
        where: vi.fn(() => obj),
        limit: vi.fn(() =>
          Promise.resolve(call === 1 ? [ACTIVE_AUTO] : [{ id: 'existing-run' }]),
        ),
        orderBy: vi.fn(() => obj),
      };
      return obj;
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const r = await triggerAutomation(
      'cart-abandoned-1h',
      { recipientEmail: 'a@b.c' },
      { dedupeKey: 'lead-42' },
    );
    expect(r.status).toBe('duplicate');
    expect(r.runId).toBe('existing-run');
    // No insert when duplicate
    expect(drizzle.calls.insert).toHaveLength(0);
  });
});
