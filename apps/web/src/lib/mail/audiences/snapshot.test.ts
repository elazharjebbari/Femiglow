/**
 * Tests snapshot engine — DB mockée. Vérifie idempotency, status flow,
 * error handling.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle } from '@/lib/mail/__tests__/_helpers/fake-drizzle';

vi.mock('@/lib/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/client')>('@/lib/db/client');
  return { ...actual, db: vi.fn() };
});

import { db as getDb } from '@/lib/db/client';
import { snapshotAudience } from './snapshot';

const validRules = {
  kind: 'all',
  conditions: [{ kind: 'consent_marketing', value: true }],
};
const validExclusions = {
  hard_bounce: true,
  unsubscribe: true,
  manual_suppression: true,
  marketing_optout: false,
};

function fakeAudience() {
  return {
    id: 'aud-1',
    slug: 'test-audience',
    name: 'Test',
    description: null,
    rules: validRules,
    exclusionFlags: validExclusions,
    evaluationMode: 'dynamic',
    createdBy: 'admin@x',
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('snapshotAudience', () => {
  it('creates snapshot status=done on happy path', async () => {
    let selectCallCount = 0;
    const drizzle = makeFakeDrizzle({});
    drizzle.select = vi.fn(() => {
      selectCallCount += 1;
      // 1st call: load audience (with deletedAt=null filter, returns empty)
      // 2nd call: load audience fallback (returns audience)
      // 3rd call: count members after INSERT
      const result =
        selectCallCount === 1
          ? []
          : selectCallCount === 2
            ? [fakeAudience()]
            : [{ n: 47 }];
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(result),
        then: (cb: (r: unknown) => unknown) => Promise.resolve(result).then(cb),
      } as never;
    }) as never;
    drizzle.insert = vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'snap-1' }]),
      })),
    })) as never;
    drizzle.execute = vi.fn().mockResolvedValue({ rows: [] }) as never;
    drizzle.update = vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{}]),
        then: (cb: (r: unknown) => unknown) => Promise.resolve([{}]).then(cb),
      })),
    })) as never;
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const result = await snapshotAudience('aud-1');

    expect(result.status).toBe('done');
    expect(result.snapshotId).toBe('snap-1');
    expect(result.size).toBe(47);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('throws if audience does not exist', async () => {
    const drizzle = makeFakeDrizzle({ selectResult: [] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    await expect(snapshotAudience('aud-nonexistent')).rejects.toThrow(/not found/i);
  });

  it('throws if audience is soft-deleted', async () => {
    let callCount = 0;
    const drizzle = makeFakeDrizzle({});
    drizzle.select = vi.fn(() => {
      callCount += 1;
      const deletedAudience = { ...fakeAudience(), deletedAt: new Date() };
      const result = callCount === 1 ? [] : [deletedAudience];
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(result),
        then: (cb: (r: unknown) => unknown) => Promise.resolve(result).then(cb),
      } as never;
    }) as never;
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    await expect(snapshotAudience('aud-deleted')).rejects.toThrow(/deleted/i);
  });

  it('returns existing snapshot when snapshotKey already used (idempotent)', async () => {
    let callCount = 0;
    const drizzle = makeFakeDrizzle({});
    drizzle.select = vi.fn(() => {
      callCount += 1;
      // 1: audience load → found
      // 2: existing snapshot check → found
      const result =
        callCount === 1
          ? [fakeAudience()]
          : [
              {
                id: 'snap-existing',
                size: 100,
                status: 'done',
                audienceId: 'aud-1',
              },
            ];
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(result),
        then: (cb: (r: unknown) => unknown) => Promise.resolve(result).then(cb),
      } as never;
    }) as never;
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const result = await snapshotAudience('aud-1', { snapshotKey: 'campaign-42' });

    expect(result.snapshotId).toBe('snap-existing');
    expect(result.size).toBe(100);
    expect(result.status).toBe('done');
    // No INSERT was performed
    expect(drizzle.insert).not.toHaveBeenCalled();
  });

  it('marks snapshot errored on compile failure', async () => {
    let selectCallCount = 0;
    const drizzle = makeFakeDrizzle({});
    drizzle.select = vi.fn(() => {
      selectCallCount += 1;
      // Return audience with depth-5 rules (will fail compile)
      const deepRules = {
        kind: 'all',
        conditions: [
          {
            kind: 'all',
            conditions: [
              {
                kind: 'all',
                conditions: [
                  {
                    kind: 'all',
                    conditions: [
                      {
                        kind: 'all',
                        conditions: [{ kind: 'has_tag', tag: 'x' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      };
      const result =
        selectCallCount === 1
          ? []
          : [{ ...fakeAudience(), rules: deepRules }];
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(result),
        then: (cb: (r: unknown) => unknown) => Promise.resolve(result).then(cb),
      } as never;
    }) as never;
    drizzle.insert = vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn().mockResolvedValue([{ id: 'snap-err' }]),
      })),
    })) as never;
    drizzle.execute = vi.fn() as never;
    drizzle.update = vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{}]),
        then: (cb: (r: unknown) => unknown) => Promise.resolve([{}]).then(cb),
      })),
    })) as never;
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const result = await snapshotAudience('aud-1');
    expect(result.status).toBe('errored');
    expect(result.erroredReason).toMatch(/max depth/i);
  });

  it('throws if DB not configured', async () => {
    vi.mocked(getDb).mockReturnValue(undefined as never);
    await expect(snapshotAudience('aud-1')).rejects.toThrow(/not configured/i);
  });

  it('stores metadata source + campaignId when provided', async () => {
    let selectCallCount = 0;
    const drizzle = makeFakeDrizzle({});
    drizzle.select = vi.fn(() => {
      selectCallCount += 1;
      const result =
        selectCallCount === 1 ? [] : selectCallCount === 2 ? [fakeAudience()] : [{ n: 5 }];
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(result),
        then: (cb: (r: unknown) => unknown) => Promise.resolve(result).then(cb),
      } as never;
    }) as never;
    let capturedInsert: Record<string, unknown> | undefined;
    drizzle.insert = vi.fn(() => ({
      values: vi.fn((v: Record<string, unknown>) => {
        capturedInsert = v;
        return { returning: vi.fn().mockResolvedValue([{ id: 'snap-2' }]) };
      }),
    })) as never;
    drizzle.execute = vi.fn() as never;
    drizzle.update = vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{}]),
        then: (cb: (r: unknown) => unknown) => Promise.resolve([{}]).then(cb),
      })),
    })) as never;
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    await snapshotAudience('aud-1', { source: 'campaign', campaignId: 'camp-42' });

    expect(capturedInsert?.metadata).toMatchObject({
      source: 'campaign',
      campaignId: 'camp-42',
    });
  });
});
