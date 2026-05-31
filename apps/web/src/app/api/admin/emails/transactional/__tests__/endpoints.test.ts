/**
 * Tests intégration des 4 endpoints transactional cockpit (M5.1.3).
 *
 * Pattern : Zod validation aux frontières + auth mocked + DB mockée
 * via fake-drizzle. On exerce le contrat HTTP (400, 422, 200, 500).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { makeFakeDrizzle } from '@/lib/mail/__tests__/_helpers/fake-drizzle';

// Auth toujours OK pour les tests — l'admin est fictif.
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

// ── POST /search ──────────────────────────────────────────────────────

describe('POST /api/admin/emails/transactional/search', () => {
  it('returns 400 on invalid JSON body', async () => {
    const { POST } = await import('../search/route');
    const req = new Request('http://test/x', { method: 'POST', body: 'not json' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 422 on missing pagination', async () => {
    const { POST } = await import('../search/route');
    const req = new Request('http://test/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ filters: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('returns 422 on invalid filter shape', async () => {
    const { POST } = await import('../search/route');
    const req = new Request('http://test/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        filters: [{ key: 'status', value: ['INVALID_STATUS'], raw: 'status:foo' }],
        pagination: { limit: 50, offset: 0 },
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('returns 200 with valid body', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeFakeDrizzle({ selectResult: [] }) as never,
    );
    const { POST } = await import('../search/route');
    const req = new Request('http://test/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        filters: [],
        pagination: { limit: 50, offset: 0 },
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('rows');
    expect(body).toHaveProperty('total');
  });
});

// ── GET /summary ──────────────────────────────────────────────────────

describe('GET /api/admin/emails/transactional/summary', () => {
  it('returns 422 on invalid window param', async () => {
    const { GET } = await import('../summary/route');
    const req = new Request('http://test/x?window=invalid');
    const res = await GET(req);
    expect(res.status).toBe(422);
  });

  it('defaults to 1h when no param', async () => {
    const { GET } = await import('../summary/route');
    const req = new Request('http://test/x');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.window).toBe('1h');
  });

  it('returns KPI shape', async () => {
    const { GET } = await import('../summary/route');
    const req = new Request('http://test/x?window=24h');
    const res = await GET(req);
    const body = await res.json();
    expect(body).toMatchObject({
      window: '24h',
      delivered: expect.any(Number),
      queued: expect.any(Number),
      failed: expect.any(Number),
      hardBounced: expect.any(Number),
    });
    expect(body.sparkline).toHaveLength(12);
  });
});

// ── POST /bulk-retry ──────────────────────────────────────────────────

describe('POST /api/admin/emails/transactional/bulk-retry', () => {
  it('returns 422 if ids missing', async () => {
    const { POST } = await import('../bulk-retry/route');
    const req = new Request('http://test/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('returns 422 if ids contains non-UUID', async () => {
    const { POST } = await import('../bulk-retry/route');
    const req = new Request('http://test/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['not-a-uuid'] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('returns 422 if ids > 500', async () => {
    const { POST } = await import('../bulk-retry/route');
    const tooMany = Array.from({ length: 501 }, () =>
      '00000000-0000-0000-0000-000000000000',
    );
    const req = new Request('http://test/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: tooMany }),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('returns 200 with retried+skipped counts on empty ids', async () => {
    const { POST } = await import('../bulk-retry/route');
    const req = new Request('http://test/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: [] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ retried: 0, skipped: 0 });
  });

  it('processes valid UUIDs', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeFakeDrizzle({
        selectResult: [
          { id: '11111111-1111-1111-1111-111111111111', status: 'failed' },
        ],
      }) as never,
    );
    const { POST } = await import('../bulk-retry/route');
    const req = new Request('http://test/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['11111111-1111-1111-1111-111111111111'] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.retried).toBe(1);
  });
});

// ── POST /bulk-suppress ───────────────────────────────────────────────

describe('POST /api/admin/emails/transactional/bulk-suppress', () => {
  it('returns 422 on non-UUID ids', async () => {
    const { POST } = await import('../bulk-suppress/route');
    const req = new Request('http://test/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['bad'] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('defaults reason to manual_admin', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeFakeDrizzle({
        selectResult: [{ id: '11111111-1111-1111-1111-111111111111', toEmail: 'a@b.c' }],
      }) as never,
    );
    const { POST } = await import('../bulk-suppress/route');
    const req = new Request('http://test/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: ['11111111-1111-1111-1111-111111111111'] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suppressed).toBe(1);
  });
});
