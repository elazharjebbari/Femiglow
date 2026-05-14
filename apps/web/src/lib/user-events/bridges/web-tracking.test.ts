/**
 * Tests bridge web tracking → user_event.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle } from '@/lib/mail/__tests__/_helpers/fake-drizzle';

vi.mock('@/lib/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/client')>('@/lib/db/client');
  return { ...actual, db: vi.fn() };
});

import { db as getDb } from '@/lib/db/client';
import {
  bridgeWebTrackingToUserEvent,
  extractEmail,
} from './web-tracking';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('extractEmail', () => {
  it('finds email at top level', () => {
    expect(extractEmail({ email: 'a@b.com' })).toBe('a@b.com');
  });

  it('finds email inside user object', () => {
    expect(extractEmail({ user: { email: 'a@b.com' } })).toBe('a@b.com');
  });

  it('finds email inside lead object', () => {
    expect(extractEmail({ lead: { email: 'a@b.com' } })).toBe('a@b.com');
  });

  it('returns null if no email', () => {
    expect(extractEmail({ foo: 'bar' })).toBeNull();
    expect(extractEmail({})).toBeNull();
    expect(extractEmail(null)).toBeNull();
    expect(extractEmail('not an object')).toBeNull();
  });

  it('rejects short non-emails', () => {
    expect(extractEmail({ email: 'x' })).toBeNull();
  });
});

describe('bridgeWebTrackingToUserEvent', () => {
  it('skips event without email', async () => {
    const drizzle = makeFakeDrizzle({});
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const persisted = await bridgeWebTrackingToUserEvent({
      eventName: 'page_view',
      email: null,
    });

    expect(persisted).toBe(false);
    expect(drizzle.calls.insert).toHaveLength(0);
  });

  it('persists event when email is explicit', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [],
      insertReturning: [{ id: 1, leadId: null }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const persisted = await bridgeWebTrackingToUserEvent({
      eventName: 'purchase',
      email: 'buyer@example.com',
      sessionId: 'sess-1',
      properties: { total: 780 },
    });

    expect(persisted).toBe(true);
    const values = drizzle.calls.insert[0]!.values as {
      email: string;
      eventName: string;
      source: string;
      sessionId: string;
    };
    expect(values.email).toBe('buyer@example.com');
    expect(values.eventName).toBe('purchase');
    expect(values.source).toBe('web');
    expect(values.sessionId).toBe('sess-1');
  });

  it('extracts email from properties when not explicit', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [],
      insertReturning: [{ id: 2, leadId: null }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    await bridgeWebTrackingToUserEvent({
      eventName: 'lead_capture',
      email: null,
      properties: { user: { email: 'lead@example.com' }, ref: 'footer' },
    });

    const values = drizzle.calls.insert[0]!.values as { email: string };
    expect(values.email).toBe('lead@example.com');
  });

  it('does not throw on insert error (safe mode)', async () => {
    vi.mocked(getDb).mockReturnValue(undefined as never);
    const persisted = await bridgeWebTrackingToUserEvent({
      eventName: 'purchase',
      email: 'buyer@example.com',
    });
    expect(persisted).toBe(false);
  });

  it('forwards ts override to insertUserEvent', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [],
      insertReturning: [{ id: 3, leadId: null }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const ts = new Date('2026-01-15T10:00:00Z');
    await bridgeWebTrackingToUserEvent({
      eventName: 'page_view',
      email: 'visitor@example.com',
      ts,
    });

    const values = drizzle.calls.insert[0]!.values as { ts: Date };
    expect(values.ts).toEqual(ts);
  });
});
