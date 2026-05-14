/**
 * Tests intégration endpoints audiences CRUD + preview + snapshot.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle } from '@/lib/mail/__tests__/_helpers/fake-drizzle';

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ email: 'admin@test', id: 'admin-1' }),
  getAdminSession: vi.fn().mockResolvedValue({ email: 'admin@test', id: 'admin-1' }),
}));

vi.mock('@/lib/db/client', async () => {
  const actual = await vi.importActual<typeof import('@/lib/db/client')>('@/lib/db/client');
  return { ...actual, db: vi.fn() };
});

import { db as getDb } from '@/lib/db/client';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getDb).mockReturnValue(makeFakeDrizzle({ selectResult: [] }) as never);
});

const validCreatePayload = {
  slug: 'test-vip',
  name: 'Test VIP',
  rules: {
    kind: 'all' as const,
    conditions: [{ kind: 'consent_marketing' as const, value: true }],
  },
};

// ── POST /audiences (create) ───────────────────────────────────────────

describe('POST /api/admin/emails/audiences', () => {
  it('returns 400 on malformed JSON', async () => {
    const { POST } = await import('../route');
    const req = new Request('http://t', { method: 'POST', body: 'not json' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 422 on missing slug', async () => {
    const { POST } = await import('../route');
    const req = new Request('http://t', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'X', rules: { kind: 'all', conditions: [] } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('returns 422 on invalid slug pattern', async () => {
    const { POST } = await import('../route');
    const req = new Request('http://t', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...validCreatePayload, slug: 'Bad Slug' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('creates audience on valid payload', async () => {
    const drizzle = makeFakeDrizzle({
      insertReturning: [{ id: 'aud-1', slug: 'test-vip', name: 'Test VIP' }],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const { POST } = await import('../route');
    const req = new Request('http://t', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validCreatePayload),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(drizzle.calls.insert).toHaveLength(1);
  });

  it('returns 409 on duplicate slug', async () => {
    const drizzle = makeFakeDrizzle({});
    drizzle.insert = vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.reject(new Error('duplicate key value'))),
      })),
    })) as never;
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const { POST } = await import('../route');
    const req = new Request('http://t', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(validCreatePayload),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});

// ── GET /audiences (list) ──────────────────────────────────────────────

describe('GET /api/admin/emails/audiences', () => {
  it('returns array of audiences', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeFakeDrizzle({
        selectResult: [
          { id: 'a-1', slug: 'vip', name: 'VIP', snapshotCount: 2 },
        ],
      }) as never,
    );

    const { GET } = await import('../route');
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeInstanceOf(Array);
    expect(body[0]).toMatchObject({ slug: 'vip' });
  });
});

// ── POST /audiences/preview-size ──────────────────────────────────────

describe('POST /audiences/preview-size', () => {
  it('returns 422 on invalid rules', async () => {
    const { POST } = await import('../preview-size/route');
    const req = new Request('http://t', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ rules: { kind: 'foo' } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('returns size + durationMs on valid rules', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeFakeDrizzle({ selectResult: [{ n: 47 }] }) as never,
    );

    const { POST } = await import('../preview-size/route');
    const req = new Request('http://t', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        rules: {
          kind: 'all',
          conditions: [{ kind: 'consent_marketing', value: true }],
        },
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.size).toBe(47);
    expect(body.durationMs).toBeGreaterThanOrEqual(0);
  });
});

// ── POST /audiences/[id]/snapshot ──────────────────────────────────────

describe('POST /audiences/[id]/snapshot', () => {
  it('returns 404 if audience does not exist', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeFakeDrizzle({ selectResult: [] }) as never,
    );

    const { POST } = await import('../[id]/snapshot/route');
    const req = new Request('http://t', { method: 'POST' });
    const res = await POST(req, { params: { id: 'nope' } });
    expect(res.status).toBe(404);
  });

  it('accepts empty body (defaults to source=manual)', async () => {
    // Simulate audience found + snapshot success
    let callCount = 0;
    const drizzle = makeFakeDrizzle({});
    drizzle.select = vi.fn(() => {
      callCount += 1;
      const result =
        callCount === 1
          ? []
          : callCount === 2
            ? [
                {
                  id: 'aud-1',
                  rules: {
                    kind: 'all',
                    conditions: [{ kind: 'consent_marketing', value: true }],
                  },
                  exclusionFlags: {
                    hard_bounce: true,
                    unsubscribe: true,
                    manual_suppression: true,
                    marketing_optout: false,
                  },
                  deletedAt: null,
                },
              ]
            : [{ n: 5 }];
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
    drizzle.execute = vi.fn() as never;
    drizzle.update = vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn().mockResolvedValue([{}]),
        then: (cb: (r: unknown) => unknown) => Promise.resolve([{}]).then(cb),
      })),
    })) as never;
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const { POST } = await import('../[id]/snapshot/route');
    const req = new Request('http://t', { method: 'POST' });
    const res = await POST(req, { params: { id: 'aud-1' } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.snapshotId).toBe('snap-1');
  });
});
