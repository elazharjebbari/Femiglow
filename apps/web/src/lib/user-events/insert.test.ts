/**
 * Tests insertUserEvent — validation Zod + normalisation + lookup lead.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle } from '@/lib/mail/__tests__/_helpers/fake-drizzle';

vi.mock('@/lib/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/client')>('@/lib/db/client');
  return { ...actual, db: vi.fn() };
});

import { db as getDb } from '@/lib/db/client';
import {
  insertUserEvent,
  insertUserEventSafe,
  InsertUserEventSchema,
} from './insert';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InsertUserEventSchema (Zod)', () => {
  it('accepts valid minimal input', () => {
    const r = InsertUserEventSchema.safeParse({
      email: 'user@example.com',
      eventName: 'page.viewed',
      source: 'web',
    });
    expect(r.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const r = InsertUserEventSchema.safeParse({
      email: 'not-an-email',
      eventName: 'page.viewed',
      source: 'web',
    });
    expect(r.success).toBe(false);
  });

  it('rejects event_name with uppercase', () => {
    const r = InsertUserEventSchema.safeParse({
      email: 'x@example.com',
      eventName: 'Cart.Added',
      source: 'web',
    });
    expect(r.success).toBe(false);
  });

  it('rejects event_name with spaces', () => {
    const r = InsertUserEventSchema.safeParse({
      email: 'x@example.com',
      eventName: 'cart added',
      source: 'web',
    });
    expect(r.success).toBe(false);
  });

  it('rejects event_name > 80 chars', () => {
    const r = InsertUserEventSchema.safeParse({
      email: 'x@example.com',
      eventName: 'x'.repeat(81),
      source: 'web',
    });
    expect(r.success).toBe(false);
  });

  it('rejects unknown source', () => {
    const r = InsertUserEventSchema.safeParse({
      email: 'x@example.com',
      eventName: 'a.b',
      source: 'banana',
    });
    expect(r.success).toBe(false);
  });

  it('accepts complex properties', () => {
    const r = InsertUserEventSchema.safeParse({
      email: 'x@example.com',
      eventName: 'a.b',
      source: 'server',
      properties: { nested: { deep: [1, 2, 3] } },
    });
    expect(r.success).toBe(true);
  });

  it('coerces ts string to Date', () => {
    const r = InsertUserEventSchema.safeParse({
      email: 'x@example.com',
      eventName: 'a.b',
      source: 'web',
      ts: '2026-05-14T12:00:00Z',
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.ts).toBeInstanceOf(Date);
  });
});

describe('insertUserEvent', () => {
  it('normalizes email lowercase + trim', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [], // no lead found
      insertReturning: [{ id: 42, leadId: null }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    await insertUserEvent({
      email: '  USER@Example.COM  ',
      eventName: 'cart.added',
      source: 'web',
    });

    const insertedValues = drizzle.calls.insert[0]!.values as { email: string };
    expect(insertedValues.email).toBe('user@example.com');
  });

  it('looks up lead_id from email if not provided', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [{ id: 'lead-abc' }],
      insertReturning: [{ id: 1, leadId: 'lead-abc' }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const result = await insertUserEvent({
      email: 'user@example.com',
      eventName: 'cart.added',
      source: 'web',
    });

    expect(drizzle.calls.select.length).toBeGreaterThan(0);
    expect(result.leadId).toBe('lead-abc');
    const insertedValues = drizzle.calls.insert[0]!.values as { leadId: string };
    expect(insertedValues.leadId).toBe('lead-abc');
  });

  it('uses provided leadId without DB lookup', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [],
      insertReturning: [{ id: 1, leadId: 'lead-explicit' }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    await insertUserEvent({
      email: 'user@example.com',
      eventName: 'cart.added',
      source: 'web',
      leadId: 'lead-explicit',
    });

    // No lookup SELECT done
    expect(drizzle.calls.select).toHaveLength(0);
  });

  it('handles missing lead gracefully (leadId = null)', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [], // no lead
      insertReturning: [{ id: 99, leadId: null }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const result = await insertUserEvent({
      email: 'orphan@example.com',
      eventName: 'page.viewed',
      source: 'web',
    });

    expect(result.leadId).toBeNull();
  });

  it('clamps large properties payload', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [],
      insertReturning: [{ id: 1, leadId: null }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const huge = { huge: 'x'.repeat(50_000) };
    await insertUserEvent({
      email: 'user@example.com',
      eventName: 'big.event',
      source: 'web',
      properties: huge,
    });

    const insertedValues = drizzle.calls.insert[0]!.values as {
      properties: Record<string, unknown>;
    };
    expect(insertedValues.properties).toMatchObject({ _truncated: true });
  });

  it('passes session_id if provided', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [],
      insertReturning: [{ id: 1, leadId: null }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    await insertUserEvent({
      email: 'x@example.com',
      eventName: 'page.viewed',
      source: 'web',
      sessionId: 'session-xyz',
    });

    const inserted = drizzle.calls.insert[0]!.values as { sessionId: string };
    expect(inserted.sessionId).toBe('session-xyz');
  });

  it('throws ZodError on invalid input', async () => {
    await expect(
      insertUserEvent({
        email: 'not-an-email',
        eventName: 'a.b',
        source: 'web',
      }),
    ).rejects.toThrow();
  });

  it('throws if DB not configured', async () => {
    vi.mocked(getDb).mockReturnValue(undefined as never);
    await expect(
      insertUserEvent({
        email: 'x@example.com',
        eventName: 'a.b',
        source: 'web',
      }),
    ).rejects.toThrow(/not configured/i);
  });
});

describe('insertUserEventSafe', () => {
  it('returns result on success', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [],
      insertReturning: [{ id: 5, leadId: null }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const r = await insertUserEventSafe({
      email: 'x@example.com',
      eventName: 'a.b',
      source: 'web',
    });
    expect(r).toEqual({ id: 5, leadId: null });
  });

  it('returns null on validation error (logged, not thrown)', async () => {
    const r = await insertUserEventSafe({
      email: 'invalid',
      eventName: 'a.b',
      source: 'web',
    });
    expect(r).toBeNull();
  });

  it('returns null on DB error (logged, not thrown)', async () => {
    vi.mocked(getDb).mockReturnValue(undefined as never);
    const r = await insertUserEventSafe({
      email: 'x@example.com',
      eventName: 'a.b',
      source: 'web',
    });
    expect(r).toBeNull();
  });
});
