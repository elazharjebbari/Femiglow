import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — factories are hoisted, no module-scope variable references
// ---------------------------------------------------------------------------

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'test-admin', email: 'test@test.com' }),
  requireContentStudioEnabled: vi.fn(),
}));

vi.mock('@/lib/ai-engine/knowledge', () => ({
  listCollections: vi.fn().mockResolvedValue([]),
  createCollection: vi.fn().mockResolvedValue({
    id: 'col-003',
    name: 'Test Collection',
    slug: 'test-collection',
    description: 'A test collection',
    category: 'test',
    documentCount: 0,
    chunkCount: 0,
    lastIndexedAt: null,
    isActive: true,
    createdAt: new Date().toISOString(),
  }),
}));

vi.mock('@/lib/errors/http-error', async () => {
  const actual = await vi.importActual<typeof import('@/lib/errors/http-error')>('@/lib/errors/http-error');
  return actual;
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET, POST } from '@/app/api/admin/ai-engine/knowledge/route';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { listCollections, createCollection } from '@/lib/ai-engine/knowledge';

// ---------------------------------------------------------------------------
// Test-scoped mock data
// ---------------------------------------------------------------------------

const mockCollections = [
  {
    id: 'col-001',
    name: 'Neuromarketing',
    slug: 'neuromarketing',
    description: 'Biais cognitifs et triggers emotionnels',
    category: 'science',
    documentCount: 12,
    chunkCount: 98,
    lastIndexedAt: new Date().toISOString(),
    isActive: true,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'col-002',
    name: 'Brand Guidelines FemiGlow',
    slug: 'brand-femiglow',
    description: 'Identite de marque, ton editorial',
    category: 'brand',
    documentCount: 5,
    chunkCount: 42,
    lastIndexedAt: new Date().toISOString(),
    isActive: true,
    createdAt: new Date().toISOString(),
  },
];

const mockCreatedCollection = {
  id: 'col-003',
  name: 'Test Collection',
  slug: 'test-collection',
  description: 'A test collection',
  category: 'test',
  documentCount: 0,
  chunkCount: 0,
  lastIndexedAt: null,
  isActive: true,
  createdAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/admin/ai-engine/knowledge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('API /api/admin/ai-engine/knowledge — contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (listCollections as ReturnType<typeof vi.fn>).mockResolvedValue(mockCollections);
    (createCollection as ReturnType<typeof vi.fn>).mockResolvedValue(mockCreatedCollection);
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@test.com' });
  });

  it('GET returns collections array', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('collections');
    expect(Array.isArray(json.collections)).toBe(true);
    expect(json.collections.length).toBe(2);
  });

  it('each collection has slug, name, category, and counts', async () => {
    const res = await GET();
    const json = await res.json();

    for (const col of json.collections) {
      expect(col).toHaveProperty('slug');
      expect(typeof col.slug).toBe('string');
      expect(col).toHaveProperty('name');
      expect(typeof col.name).toBe('string');
      expect(col).toHaveProperty('category');
      expect(typeof col.category).toBe('string');
      expect(col).toHaveProperty('documentCount');
      expect(typeof col.documentCount).toBe('number');
      expect(col).toHaveProperty('chunkCount');
      expect(typeof col.chunkCount).toBe('number');
    }
  });

  it('POST creates a collection with valid payload', async () => {
    const payload = {
      name: 'Test Collection',
      slug: 'test-collection',
      category: 'test',
      description: 'A test collection',
    };

    const res = await POST(makePostRequest(payload));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json).toHaveProperty('collection');
    expect(json.collection).toHaveProperty('id');
    expect(json.collection.slug).toBe('test-collection');
    expect(createCollection).toHaveBeenCalledWith(
      'Test Collection',
      'test-collection',
      'A test collection',
      'test',
    );
  });

  it('POST rejects invalid slug (uppercase, spaces)', async () => {
    const payload = {
      name: 'Test Collection',
      slug: 'INVALID SLUG!',
      category: 'test',
    };

    const res = await POST(makePostRequest(payload));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('GET returns 401 when auth fails', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    const res = await GET();
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'unauthorized');
  });

  it('POST returns 401 when auth fails', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    const payload = {
      name: 'Test',
      slug: 'test',
      category: 'test',
    };

    const res = await POST(makePostRequest(payload));
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'unauthorized');
  });
});
