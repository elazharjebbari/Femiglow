/**
 * Tests preview engine — DB mockée via fake-drizzle.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle } from '@/lib/mail/__tests__/_helpers/fake-drizzle';

vi.mock('@/lib/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/client')>('@/lib/db/client');
  return { ...actual, db: vi.fn() };
});

import { db as getDb } from '@/lib/db/client';
import { previewAudienceSize, previewAudienceSample } from './preview';
import type { ExclusionFlags, RulesGroup } from './rules-types';

const defaultExclusions: ExclusionFlags = {
  hard_bounce: true,
  unsubscribe: true,
  manual_suppression: true,
  marketing_optout: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('previewAudienceSize', () => {
  it('returns count + durationMs', async () => {
    const drizzle = makeFakeDrizzle({ selectResult: [{ n: 47 }] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const result = await previewAudienceSize(
      {
        kind: 'all',
        conditions: [{ kind: 'consent_marketing', value: true }],
      },
      defaultExclusions,
    );

    expect(result.size).toBe(47);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns 0 when nobody matches', async () => {
    const drizzle = makeFakeDrizzle({ selectResult: [{ n: 0 }] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const result = await previewAudienceSize(
      { kind: 'all', conditions: [{ kind: 'order_count', operator: 'gte', value: 99999 }] },
      defaultExclusions,
    );

    expect(result.size).toBe(0);
  });

  it('uses a transaction to set statement_timeout', async () => {
    const drizzle = makeFakeDrizzle({ selectResult: [{ n: 5 }] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    await previewAudienceSize(
      { kind: 'all', conditions: [] },
      defaultExclusions,
    );

    expect(drizzle.transaction).toHaveBeenCalledTimes(1);
  });

  it('throws if DB not configured', async () => {
    vi.mocked(getDb).mockReturnValue(undefined as never);
    await expect(
      previewAudienceSize({ kind: 'all', conditions: [] }, defaultExclusions),
    ).rejects.toThrow(/not configured/i);
  });

  it('propagates compile errors', async () => {
    const drizzle = makeFakeDrizzle({});
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const deep: RulesGroup = {
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
    await expect(previewAudienceSize(deep, defaultExclusions)).rejects.toThrow(
      /max depth/i,
    );
  });
});

describe('previewAudienceSample', () => {
  it('returns capped sample + total size', async () => {
    let callCount = 0;
    const drizzle = makeFakeDrizzle({});
    // Custom select that alternates between sample query and count query
    drizzle.select = vi.fn(() => {
      callCount += 1;
      const isCountQuery = callCount % 2 === 0;
      const finalResult = isCountQuery
        ? [{ n: 100 }]
        : [
            { email: 'a@b.c', firstName: 'Alice', createdAt: new Date() },
            { email: 'd@e.f', firstName: 'Bob', createdAt: new Date() },
          ];
      return {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue(finalResult),
        orderBy: vi.fn().mockReturnThis(),
        then: (cb: (r: unknown) => unknown) => Promise.resolve(finalResult).then(cb),
      } as never;
    }) as never;
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const result = await previewAudienceSample(
      { kind: 'all', conditions: [{ kind: 'consent_marketing', value: true }] },
      defaultExclusions,
      10,
    );

    expect(result.samples.length).toBeLessThanOrEqual(10);
    expect(result.size).toBeGreaterThanOrEqual(0);
  });

  it('caps limit to MAX_SAMPLE=50', async () => {
    const drizzle = makeFakeDrizzle({});
    let capturedLimit: number | undefined;
    drizzle.select = vi.fn(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn((n: number) => {
        capturedLimit = n;
        return Promise.resolve([]);
      }),
      then: (cb: (r: unknown) => unknown) => Promise.resolve([]).then(cb),
    })) as never;
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    await previewAudienceSample(
      { kind: 'all', conditions: [] },
      defaultExclusions,
      9999,
    );

    expect(capturedLimit).toBeLessThanOrEqual(50);
  });

  it('uses default limit 10 if not specified', async () => {
    const drizzle = makeFakeDrizzle({});
    let capturedLimit: number | undefined;
    drizzle.select = vi.fn(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn((n: number) => {
        capturedLimit = n;
        return Promise.resolve([]);
      }),
      then: (cb: (r: unknown) => unknown) => Promise.resolve([]).then(cb),
    })) as never;
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    await previewAudienceSample(
      { kind: 'all', conditions: [] },
      defaultExclusions,
    );

    expect(capturedLimit).toBe(10);
  });
});
