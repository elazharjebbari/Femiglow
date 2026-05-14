/**
 * Tests intégration views CRUD (M5.1.3).
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

describe('GET /api/admin/emails/views', () => {
  it('returns 422 on invalid scope', async () => {
    const { GET } = await import('../route');
    const req = new Request('http://test/x?scope=invalid');
    const res = await GET(req);
    expect(res.status).toBe(422);
  });

  it('defaults to transactional scope', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeFakeDrizzle({
        selectResult: [
          {
            id: '11111111-1111-1111-1111-111111111111',
            ownerEmail: 'system',
            name: 'All today',
            scope: 'transactional',
            filterState: {},
            isSystem: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      }) as never,
    );
    const { GET } = await import('../route');
    const req = new Request('http://test/x');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeInstanceOf(Array);
    expect(body[0]).toMatchObject({ name: 'All today', isSystem: true });
  });
});

describe('POST /api/admin/emails/views', () => {
  it('returns 422 on missing name', async () => {
    const { POST } = await import('../route');
    const req = new Request('http://test/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope: 'transactional', filterState: {} }),
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it('returns 400 on malformed JSON', async () => {
    const { POST } = await import('../route');
    const req = new Request('http://test/x', { method: 'POST', body: 'not json' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('creates a view on valid body', async () => {
    const drizzle = makeFakeDrizzle({
      insertReturning: [
        {
          id: '11111111-1111-1111-1111-111111111111',
          ownerEmail: 'admin@test',
          name: 'My VIPs',
          scope: 'transactional',
          filterState: {},
          isSystem: false,
        },
      ],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const { POST } = await import('../route');
    const req = new Request('http://test/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'My VIPs',
        scope: 'transactional',
        filterState: { filters: { status: ['failed'] } },
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(drizzle.calls.insert).toHaveLength(1);
  });

  it('returns 409 on unique constraint violation', async () => {
    const drizzle = makeFakeDrizzle({});
    // Simuler une exception .returning sur INSERT
    drizzle.insert = vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.reject(new Error('duplicate key value'))),
      })),
    })) as never;
    vi.mocked(getDb).mockReturnValue(drizzle as never);

    const { POST } = await import('../route');
    const req = new Request('http://test/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'All today',
        scope: 'transactional',
        filterState: {},
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});

describe('PATCH /api/admin/emails/views/[id]', () => {
  it('returns 404 if view does not exist', async () => {
    vi.mocked(getDb).mockReturnValue(makeFakeDrizzle({ selectResult: [] }) as never);
    const { PATCH } = await import('../[id]/route');
    const req = new Request('http://test/x', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'New name' }),
    });
    const res = await PATCH(req, { params: { id: '00000000-0000-0000-0000-000000000000' } });
    expect(res.status).toBe(404);
  });

  it('returns 403 if view is system', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeFakeDrizzle({
        selectResult: [
          {
            id: 'sys-1',
            ownerEmail: 'system',
            name: 'All today',
            scope: 'transactional',
            filterState: {},
            isSystem: true,
            deletedAt: null,
          },
        ],
      }) as never,
    );
    const { PATCH } = await import('../[id]/route');
    const req = new Request('http://test/x', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    });
    const res = await PATCH(req, { params: { id: 'sys-1' } });
    expect(res.status).toBe(403);
  });

  it('returns 403 if owned by another admin', async () => {
    vi.mocked(getDb).mockReturnValue(
      makeFakeDrizzle({
        selectResult: [
          {
            id: 'view-1',
            ownerEmail: 'someone-else@x.y',
            name: 'X',
            scope: 'transactional',
            filterState: {},
            isSystem: false,
            deletedAt: null,
          },
        ],
      }) as never,
    );
    const { PATCH } = await import('../[id]/route');
    const req = new Request('http://test/x', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'X' }),
    });
    const res = await PATCH(req, { params: { id: 'view-1' } });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/admin/emails/views/[id]', () => {
  it('returns 404 if not found', async () => {
    vi.mocked(getDb).mockReturnValue(makeFakeDrizzle({ selectResult: [] }) as never);
    const { DELETE } = await import('../[id]/route');
    const req = new Request('http://test/x', { method: 'DELETE' });
    const res = await DELETE(req, { params: { id: '00000000-0000-0000-0000-000000000000' } });
    expect(res.status).toBe(404);
  });

  it('soft-deletes an owned view', async () => {
    const drizzle = makeFakeDrizzle({
      selectResult: [
        {
          id: 'view-1',
          ownerEmail: 'admin@test',
          name: 'X',
          scope: 'transactional',
          filterState: {},
          isSystem: false,
          deletedAt: null,
        },
      ],
    });
    vi.mocked(getDb).mockReturnValue(drizzle as never);
    const { DELETE } = await import('../[id]/route');
    const req = new Request('http://test/x', { method: 'DELETE' });
    const res = await DELETE(req, { params: { id: 'view-1' } });
    expect(res.status).toBe(200);
    expect(drizzle.calls.update).toHaveLength(1);
    const set = drizzle.calls.update[0]!.set as Record<string, unknown>;
    expect(set.deletedAt).toBeInstanceOf(Date);
  });
});
