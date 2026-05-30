import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'test-admin', email: 'test@test.com' }),
  requireContentStudioEnabled: vi.fn(),
}));

vi.mock('@/lib/errors/http-error', async () => {
  const actual = await vi.importActual<typeof import('@/lib/errors/http-error')>('@/lib/errors/http-error');
  return actual;
});

const mockGetCollection = vi.fn();
const mockIngestText = vi.fn();
const mockIngestUrl = vi.fn();
const mockSeedKnowledgeBase = vi.fn();

vi.mock('@/lib/ai-engine/knowledge', () => ({
  getCollection: (...args: unknown[]) => mockGetCollection(...args),
  ingestText: (...args: unknown[]) => mockIngestText(...args),
  ingestUrl: (...args: unknown[]) => mockIngestUrl(...args),
  seedKnowledgeBase: (...args: unknown[]) => mockSeedKnowledgeBase(...args),
  listCollections: vi.fn().mockResolvedValue([]),
  createCollection: vi.fn(),
  searchKnowledge: vi.fn(),
  searchByCollections: vi.fn(),
  seedDefaultCollections: vi.fn(),
}));

// Mock DB to return a mock drizzle instance for GET documents
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(() => ({
    select: (...args: unknown[]) => {
      mockSelect(...args);
      return {
        from: (...fArgs: unknown[]) => {
          mockFrom(...fArgs);
          return {
            where: (...wArgs: unknown[]) => {
              mockWhere(...wArgs);
              return {
                orderBy: (...oArgs: unknown[]) => {
                  mockOrderBy(...oArgs);
                  return [
                    {
                      id: 'doc-001',
                      title: 'Test Document',
                      sourceType: 'text',
                      sourceUrl: null,
                      chunkCount: 5,
                      createdAt: new Date(),
                    },
                  ];
                },
              };
            },
          };
        },
      };
    },
  })),
}));

vi.mock('@/lib/db/schema-ai-engine', () => ({
  aiEngineKnowledgeDocuments: {
    id: 'id',
    title: 'title',
    sourceType: 'sourceType',
    sourceUrl: 'sourceUrl',
    chunkCount: 'chunkCount',
    createdAt: 'createdAt',
    collectionId: 'collectionId',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((...args: unknown[]) => args),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET as getDocuments, POST as postDocument } from '@/app/api/admin/ai-engine/knowledge/[slug]/documents/route';
import { POST as postSeed } from '@/app/api/admin/ai-engine/knowledge/seed/route';
import { requireAdminApi } from '@/lib/content-studio/auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDocPostRequest(slug: string, body: unknown): [Request, { params: { slug: string } }] {
  return [
    new Request(`http://localhost:3000/api/admin/ai-engine/knowledge/${slug}/documents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
    { params: { slug } },
  ];
}

function makeDocGetRequest(slug: string): [Request, { params: { slug: string } }] {
  return [
    new Request(`http://localhost:3000/api/admin/ai-engine/knowledge/${slug}/documents`),
    { params: { slug } },
  ];
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('API /api/admin/ai-engine/knowledge/:slug/documents — deep contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@test.com' });
    mockGetCollection.mockResolvedValue({ id: 'col-001', slug: 'brand-femiglow', name: 'Brand FemiGlow' });
    mockIngestText.mockResolvedValue({ success: true, documentId: 'doc-new-001', chunkCount: 3 });
    mockIngestUrl.mockResolvedValue({ success: true, documentId: 'doc-new-002', chunkCount: 7 });
  });

  it('POST with sourceType=text creates document and returns 201', async () => {
    const [req, params] = makeDocPostRequest('brand-femiglow', {
      sourceType: 'text',
      title: 'Brand Identity',
      content: 'FemiGlow is a J-Beauty brand focused on nail care.',
    });
    const res = await postDocument(req, params);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json).toHaveProperty('documentId', 'doc-new-001');
    expect(json).toHaveProperty('chunkCount', 3);
    expect(mockIngestText).toHaveBeenCalledWith('col-001', 'Brand Identity', 'FemiGlow is a J-Beauty brand focused on nail care.', undefined);
  });

  it('POST with sourceType=url creates document and returns 201', async () => {
    const [req, params] = makeDocPostRequest('brand-femiglow', {
      sourceType: 'url',
      url: 'https://example.com/article',
    });
    const res = await postDocument(req, params);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json).toHaveProperty('documentId', 'doc-new-002');
    expect(json).toHaveProperty('chunkCount', 7);
    expect(mockIngestUrl).toHaveBeenCalledWith('col-001', 'https://example.com/article');
  });

  it('POST missing title for sourceType=text returns 400', async () => {
    const [req, params] = makeDocPostRequest('brand-femiglow', {
      sourceType: 'text',
      content: 'Content without title',
    });
    const res = await postDocument(req, params);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('POST with invalid sourceType returns 400', async () => {
    const [req, params] = makeDocPostRequest('brand-femiglow', {
      sourceType: 'pdf',
      title: 'A doc',
      content: 'Some content',
    });
    const res = await postDocument(req, params);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('GET returns document list', async () => {
    const [req, params] = makeDocGetRequest('brand-femiglow');
    const res = await getDocuments(req, params);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('documents');
    expect(Array.isArray(json.documents)).toBe(true);
    expect(json.documents.length).toBeGreaterThan(0);
    expect(json.documents[0]).toHaveProperty('id');
    expect(json.documents[0]).toHaveProperty('title');
    expect(json.documents[0]).toHaveProperty('sourceType');
  });
});

describe('POST /api/admin/ai-engine/knowledge/seed — deep contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@test.com' });
  });

  it('POST /knowledge/seed creates collections and returns counts', async () => {
    mockSeedKnowledgeBase.mockResolvedValue({ collections: 5, documents: 12, errors: [] });

    const res = await postSeed();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('collections', 5);
    expect(json).toHaveProperty('documents', 12);
    expect(json).toHaveProperty('errors');
    expect(Array.isArray(json.errors)).toBe(true);
    expect(json.errors.length).toBe(0);
  });

  it('POST /knowledge/seed is idempotent (second call does not duplicate)', async () => {
    // First call seeds documents
    mockSeedKnowledgeBase.mockResolvedValue({ collections: 5, documents: 12, errors: [] });
    const res1 = await postSeed();
    expect(res1.status).toBe(200);

    // Second call returns 0 new documents (they already exist)
    mockSeedKnowledgeBase.mockResolvedValue({ collections: 5, documents: 0, errors: [] });
    const res2 = await postSeed();
    expect(res2.status).toBe(200);

    const json2 = await res2.json();
    expect(json2.documents).toBe(0);
    expect(json2.collections).toBe(5);
  });

  it('returns 401 when auth fails on any endpoint', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    // Test seed endpoint
    const resSeed = await postSeed();
    expect(resSeed.status).toBe(401);

    // Test documents GET
    const [getReq, getParams] = makeDocGetRequest('brand-femiglow');
    const resGet = await getDocuments(getReq, getParams);
    expect(resGet.status).toBe(401);

    // Test documents POST
    const [postReq, postParams] = makeDocPostRequest('brand-femiglow', {
      sourceType: 'text',
      title: 'Test',
      content: 'Content',
    });
    const resPost = await postDocument(postReq, postParams);
    expect(resPost.status).toBe(401);
  });
});
