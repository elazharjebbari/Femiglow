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
  getCollection: vi.fn().mockResolvedValue(null),
  updateCollection: vi.fn().mockResolvedValue(null),
  deleteCollection: vi.fn().mockResolvedValue(undefined),
  getDocumentById: vi.fn().mockResolvedValue(null),
  updateCollectionCounts: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/ai-engine/knowledge/ingestion', () => ({
  updateDocument: vi.fn().mockResolvedValue({
    documentId: 'doc-001',
    reChunked: false,
    chunkCount: 5,
    success: true,
  }),
}));

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(() => null),
}));

vi.mock('@/lib/db/schema-ai-engine', () => ({
  aiEngineKnowledgeDocuments: {},
  aiEngineKnowledgeChunks: {},
  aiEngineKnowledgeCollections: {},
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  sql: vi.fn(),
}));

vi.mock('@/lib/errors/http-error', async () => {
  const actual = await vi.importActual<typeof import('@/lib/errors/http-error')>('@/lib/errors/http-error');
  return actual;
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  PATCH as patchCollection,
  DELETE as deleteCollectionRoute,
} from '@/app/api/admin/ai-engine/knowledge/[slug]/route';

import {
  GET as getDocument,
  PATCH as patchDocument,
} from '@/app/api/admin/ai-engine/knowledge/[slug]/documents/[docId]/route';

import { requireAdminApi } from '@/lib/content-studio/auth';
import {
  getCollection,
  updateCollection,
  deleteCollection,
  getDocumentById,
} from '@/lib/ai-engine/knowledge';
import { updateDocument } from '@/lib/ai-engine/knowledge/ingestion';

// ---------------------------------------------------------------------------
// Test-scoped mock data
// ---------------------------------------------------------------------------

const mockCollection = {
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
  updatedAt: new Date().toISOString(),
};

const mockUpdatedCollection = {
  ...mockCollection,
  name: 'Updated Name',
  description: 'Updated description',
  category: 'brand',
};

const mockDocument = {
  id: 'doc-001',
  collectionId: 'col-001',
  title: 'Introduction to Neuromarketing',
  sourceType: 'text',
  sourceUrl: null,
  contentText: 'Full content of the document goes here...',
  metadata: { wordCount: 250 },
  chunkCount: 5,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePatchRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(url: string): Request {
  return new Request(url, { method: 'DELETE' });
}

function makeGetRequest(url: string): Request {
  return new Request(url, { method: 'GET' });
}

// ---------------------------------------------------------------------------
// Tests — PATCH /knowledge/:slug
// ---------------------------------------------------------------------------

describe('PATCH /api/admin/ai-engine/knowledge/:slug — contract tests', () => {
  const params = { slug: 'neuromarketing' };
  const baseUrl = 'http://localhost:3000/api/admin/ai-engine/knowledge/neuromarketing';

  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@test.com' });
    (getCollection as ReturnType<typeof vi.fn>).mockResolvedValue(mockCollection);
    (updateCollection as ReturnType<typeof vi.fn>).mockResolvedValue(mockUpdatedCollection);
  });

  it('returns 401 when auth fails', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    const res = await patchCollection(
      makePatchRequest(baseUrl, { name: 'Test' }),
      { params },
    );
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'unauthorized');
  });

  it('returns 404 when collection not found', async () => {
    (getCollection as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await patchCollection(
      makePatchRequest(baseUrl, { name: 'New Name' }),
      { params },
    );
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'not_found');
  });

  it('returns 400 when body is empty {}', async () => {
    const res = await patchCollection(
      makePatchRequest(baseUrl, {}),
      { params },
    );
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
    expect(json.details).toBeDefined();
    expect(json.details.some((d: { message: string }) => d.message.includes('At least one field'))).toBe(true);
  });

  it('returns 400 when name is empty string', async () => {
    const res = await patchCollection(
      makePatchRequest(baseUrl, { name: '' }),
      { params },
    );
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('returns 200 with collection when updating name only', async () => {
    const nameOnlyResult = { ...mockCollection, name: 'Only Name Updated' };
    (updateCollection as ReturnType<typeof vi.fn>).mockResolvedValue(nameOnlyResult);

    const res = await patchCollection(
      makePatchRequest(baseUrl, { name: 'Only Name Updated' }),
      { params },
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('collection');
    expect(json.collection.name).toBe('Only Name Updated');
    expect(updateCollection).toHaveBeenCalledWith(mockCollection.id, { name: 'Only Name Updated' });
  });

  it('returns 200 with collection when updating all fields', async () => {
    const res = await patchCollection(
      makePatchRequest(baseUrl, {
        name: 'Updated Name',
        description: 'Updated description',
        category: 'brand',
      }),
      { params },
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('collection');
    expect(json.collection.name).toBe('Updated Name');
    expect(json.collection.description).toBe('Updated description');
    expect(json.collection.category).toBe('brand');
    expect(updateCollection).toHaveBeenCalledWith(mockCollection.id, {
      name: 'Updated Name',
      description: 'Updated description',
      category: 'brand',
    });
  });
});

// ---------------------------------------------------------------------------
// Tests — GET /knowledge/:slug/documents/:docId
// ---------------------------------------------------------------------------

describe('GET /api/admin/ai-engine/knowledge/:slug/documents/:docId — contract tests', () => {
  const params = { slug: 'neuromarketing', docId: 'doc-001' };
  const baseUrl = 'http://localhost:3000/api/admin/ai-engine/knowledge/neuromarketing/documents/doc-001';

  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@test.com' });
    (getCollection as ReturnType<typeof vi.fn>).mockResolvedValue(mockCollection);
    (getDocumentById as ReturnType<typeof vi.fn>).mockResolvedValue(mockDocument);
  });

  it('returns 401 when auth fails', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    const res = await getDocument(makeGetRequest(baseUrl), { params });
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'unauthorized');
  });

  it('returns 404 when collection not found', async () => {
    (getCollection as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await getDocument(makeGetRequest(baseUrl), { params });
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'not_found');
  });

  it('returns 404 when document not found', async () => {
    (getDocumentById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await getDocument(makeGetRequest(baseUrl), { params });
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'not_found');
  });

  it('returns 200 with document including contentText', async () => {
    const res = await getDocument(makeGetRequest(baseUrl), { params });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('document');
    expect(json.document.id).toBe('doc-001');
    expect(json.document.title).toBe('Introduction to Neuromarketing');
    expect(json.document.contentText).toBe('Full content of the document goes here...');
    expect(json.document).toHaveProperty('sourceType');
    expect(json.document).toHaveProperty('chunkCount');
    expect(getDocumentById).toHaveBeenCalledWith(mockCollection.id, 'doc-001');
  });
});

// ---------------------------------------------------------------------------
// Tests — PATCH /knowledge/:slug/documents/:docId
// ---------------------------------------------------------------------------

describe('PATCH /api/admin/ai-engine/knowledge/:slug/documents/:docId — contract tests', () => {
  const params = { slug: 'neuromarketing', docId: 'doc-001' };
  const baseUrl = 'http://localhost:3000/api/admin/ai-engine/knowledge/neuromarketing/documents/doc-001';

  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@test.com' });
    (getCollection as ReturnType<typeof vi.fn>).mockResolvedValue(mockCollection);
    (updateDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
      documentId: 'doc-001',
      reChunked: false,
      chunkCount: 5,
      success: true,
    });
  });

  it('returns 401 when auth fails', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    const res = await patchDocument(
      makePatchRequest(baseUrl, { title: 'New Title' }),
      { params },
    );
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'unauthorized');
  });

  it('returns 400 when body is empty {}', async () => {
    const res = await patchDocument(
      makePatchRequest(baseUrl, {}),
      { params },
    );
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
    expect(json.details).toBeDefined();
    expect(json.details.some((d: { message: string }) => d.message.includes('At least one field'))).toBe(true);
  });

  it('returns 404 when document not found', async () => {
    (updateDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
      documentId: 'doc-001',
      reChunked: false,
      chunkCount: 0,
      success: false,
      error: 'Document not found',
    });

    const res = await patchDocument(
      makePatchRequest(baseUrl, { title: 'Updated Title' }),
      { params },
    );
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'not_found');
  });

  it('returns 200 with reChunked=false for title-only update', async () => {
    (updateDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
      documentId: 'doc-001',
      reChunked: false,
      chunkCount: 5,
      success: true,
    });

    const res = await patchDocument(
      makePatchRequest(baseUrl, { title: 'Updated Title Only' }),
      { params },
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('document');
    expect(json.document.id).toBe('doc-001');
    expect(json.reChunked).toBe(false);
    expect(json.chunkCount).toBe(5);
    expect(updateDocument).toHaveBeenCalledWith(mockCollection.id, 'doc-001', { title: 'Updated Title Only' });
  });

  it('returns 200 with reChunked=true for content update', async () => {
    (updateDocument as ReturnType<typeof vi.fn>).mockResolvedValue({
      documentId: 'doc-001',
      reChunked: true,
      chunkCount: 8,
      success: true,
    });

    const res = await patchDocument(
      makePatchRequest(baseUrl, { content: 'Completely new content that will trigger re-chunking.' }),
      { params },
    );
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('document');
    expect(json.document.id).toBe('doc-001');
    expect(json.reChunked).toBe(true);
    expect(json.chunkCount).toBe(8);
    expect(updateDocument).toHaveBeenCalledWith(
      mockCollection.id,
      'doc-001',
      { content: 'Completely new content that will trigger re-chunking.' },
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — DELETE /knowledge/:slug
// ---------------------------------------------------------------------------

describe('DELETE /api/admin/ai-engine/knowledge/:slug — contract tests', () => {
  const params = { slug: 'neuromarketing' };
  const baseUrl = 'http://localhost:3000/api/admin/ai-engine/knowledge/neuromarketing';

  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@test.com' });
    (getCollection as ReturnType<typeof vi.fn>).mockResolvedValue(mockCollection);
    (deleteCollection as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
  });

  it('returns 401 when auth fails', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    const res = await deleteCollectionRoute(makeDeleteRequest(baseUrl), { params });
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'unauthorized');
  });

  it('returns 404 when collection not found', async () => {
    (getCollection as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const res = await deleteCollectionRoute(makeDeleteRequest(baseUrl), { params });
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'not_found');
  });
});
