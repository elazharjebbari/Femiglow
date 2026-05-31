/**
 * Tests condition evaluator — DB mockée.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle } from '@/lib/mail/__tests__/_helpers/fake-drizzle';

vi.mock('@/lib/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/client')>('@/lib/db/client');
  return { ...actual, db: vi.fn() };
});

import { db as getDb } from '@/lib/db/client';
import { evaluateConditionAgainstUser } from '../condition-evaluator';
import type { RulesGroup } from '@/lib/mail/audiences/rules-types';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('evaluateConditionAgainstUser', () => {
  it('returns true when SELECT returns a row', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeFakeDrizzle({ selectResult: [{ one: 1 }] }) as never,
    );
    const condition: RulesGroup = {
      kind: 'all',
      conditions: [{ kind: 'consent_marketing', value: true }],
    };
    const r = await evaluateConditionAgainstUser(condition, 'user@example.com');
    expect(r).toBe(true);
  });

  it('returns false when SELECT returns empty', async () => {
    vi.mocked(getDb).mockReturnValue(makeFakeDrizzle({ selectResult: [] }) as never);
    const r = await evaluateConditionAgainstUser(
      {
        kind: 'all',
        conditions: [{ kind: 'order_count', operator: 'gte', value: 100 }],
      },
      'newbie@example.com',
    );
    expect(r).toBe(false);
  });

  it('normalizes email to lowercase before query', async () => {
    const drizzle = makeFakeDrizzle({ selectResult: [] });
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    await evaluateConditionAgainstUser(
      { kind: 'all', conditions: [{ kind: 'consent_marketing', value: true }] },
      'USER@X.Y',
    );
    expect(drizzle.calls.select).toHaveLength(1);
  });

  it('throws if DB not configured', async () => {
    vi.mocked(getDb).mockReturnValue(undefined as never);
    await expect(
      evaluateConditionAgainstUser(
        { kind: 'all', conditions: [] },
        'x@y.c',
      ),
    ).rejects.toThrow(/not configured/i);
  });

  it('handles complex AND/OR conditions', async () => {
    vi.mocked(getDb).mockReturnValue(makeFakeDrizzle({ selectResult: [{ one: 1 }] }) as never);
    const r = await evaluateConditionAgainstUser(
      {
        kind: 'all',
        conditions: [
          { kind: 'consent_marketing', value: true },
          {
            kind: 'any',
            conditions: [
              { kind: 'order_count', operator: 'gte', value: 1 },
              { kind: 'has_tag', tag: 'vip' },
            ],
          },
        ],
      },
      'vip@example.com',
    );
    expect(r).toBe(true);
  });
});
