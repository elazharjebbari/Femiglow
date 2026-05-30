import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockInsertReturning = vi.fn();
const mockInsertValues = vi.fn();
const mockSelectFrom = vi.fn();
const mockSelectWhere = vi.fn();
const mockSelectOrderBy = vi.fn();
const mockSelectLimit = vi.fn();
const mockUpdateSet = vi.fn();
const mockUpdateWhere = vi.fn();

const baseCollectionRow = {
  id: 'col-1',
  name: 'Test Collection',
  slug: 'test-collection',
  description: 'A test collection',
  category: 'science',
  documentCount: 5,
  chunkCount: 50,
  lastIndexedAt: new Date('2026-01-01'),
  isActive: true,
  createdAt: new Date('2025-12-01'),
  updatedAt: new Date('2025-12-01'),
};

const baseDocumentRow = {
  id: 'doc-1',
  collectionId: 'col-1',
  title: 'Test Document',
  sourceType: 'text',
  sourceUrl: null,
  contentText: 'Some content here',
  metadata: null,
  chunkCount: 3,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockUpdateReturning = vi.fn();

const mockDb = {
  insert: vi.fn(() => ({
    values: mockInsertValues.mockReturnValue({
      returning: mockInsertReturning,
    }),
  })),
  select: vi.fn(() => ({
    from: mockSelectFrom.mockReturnValue({
      where: mockSelectWhere.mockReturnValue({
        orderBy: mockSelectOrderBy.mockResolvedValue([baseCollectionRow]),
        limit: mockSelectLimit.mockResolvedValue([baseCollectionRow]),
      }),
      orderBy: mockSelectOrderBy,
      limit: mockSelectLimit,
    }),
  })),
  update: vi.fn(() => ({
    set: mockUpdateSet.mockReturnValue({
      where: mockUpdateWhere.mockReturnValue({
        returning: mockUpdateReturning.mockResolvedValue([baseCollectionRow]),
      }),
    }),
  })),
};

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(() => mockDb),
}));

vi.mock('@/lib/db/schema-ai-engine', () => ({
  aiEngineKnowledgeCollections: {
    isActive: 'is_active',
    name: 'name',
    slug: 'slug',
    id: 'id',
    collectionId: 'collection_id',
  },
  aiEngineKnowledgeDocuments: {
    id: 'id',
    collectionId: 'collection_id',
    title: 'title',
    sourceType: 'source_type',
  },
  aiEngineKnowledgeChunks: {
    collectionId: 'collection_id',
  },
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  createCollection,
  listCollections,
  getCollection,
  deleteCollection,
  updateCollection,
  updateCollectionCounts,
  getDocumentById,
  seedDefaultCollections,
} from './collections';
import { db } from '@/lib/db/client';

describe('collections', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockInsertReturning.mockResolvedValue([baseCollectionRow]);
    mockInsertValues.mockReturnValue({ returning: mockInsertReturning });
    mockDb.insert.mockReturnValue({ values: mockInsertValues });

    mockSelectOrderBy.mockResolvedValue([baseCollectionRow]);
    mockSelectLimit.mockResolvedValue([baseCollectionRow]);
    mockSelectWhere.mockReturnValue({
      orderBy: mockSelectOrderBy,
      limit: mockSelectLimit,
    });
    mockSelectFrom.mockReturnValue({
      where: mockSelectWhere,
      orderBy: mockSelectOrderBy,
    });
    mockDb.select.mockReturnValue({ from: mockSelectFrom });

    mockUpdateReturning.mockResolvedValue([baseCollectionRow]);
    mockUpdateWhere.mockReturnValue({ returning: mockUpdateReturning });
    mockUpdateSet.mockReturnValue({ where: mockUpdateWhere });
    mockDb.update.mockReturnValue({ set: mockUpdateSet });
  });

  it('createCollection inserts and returns row', async () => {
    const result = await createCollection('Test Collection', 'test-collection', 'A test', 'science');
    expect(result).toMatchObject({
      id: 'col-1',
      name: 'Test Collection',
      slug: 'test-collection',
      category: 'science',
      isActive: true,
    });
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it('listCollections returns all active collections', async () => {
    const results = await listCollections();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('slug');
    expect(results[0]).toHaveProperty('isActive', true);
  });

  it('getCollection returns single collection by slug', async () => {
    const result = await getCollection('test-collection');
    expect(result).not.toBeNull();
    expect(result!.slug).toBe('test-collection');
  });

  it('getCollection returns null for unknown slug', async () => {
    mockSelectLimit.mockResolvedValueOnce([]);
    mockSelectWhere.mockReturnValueOnce({
      orderBy: mockSelectOrderBy,
      limit: mockSelectLimit,
    });
    mockSelectFrom.mockReturnValueOnce({
      where: mockSelectWhere,
    });

    const result = await getCollection('non-existent-slug');
    expect(result).toBeNull();
  });

  it('seedDefaultCollections creates 9 collections', async () => {
    // For seeding, getCollection is called for each of the 9 defaults.
    // Simulate none exist yet (all return null).
    let callCount = 0;
    mockSelectLimit.mockImplementation(() => {
      callCount++;
      return Promise.resolve([]);
    });

    const results = await seedDefaultCollections();
    expect(results.length).toBe(9);
  });

  it('seedDefaultCollections is idempotent (no duplicates)', async () => {
    // Simulate all already exist
    mockSelectLimit.mockResolvedValue([baseCollectionRow]);

    const results = await seedDefaultCollections();
    expect(results.length).toBe(9);
    // No insert calls for existing collections
    // (getCollection returns existing, so createCollection is not called for those)
    // The returned collections should all be the existing row
    for (const r of results) {
      expect(r.id).toBe('col-1');
    }
  });

  it('updateCollectionCounts updates doc/chunk counts', async () => {
    // Mock the select for doc count and chunk count
    const mockCount = vi.fn();
    mockSelectFrom.mockReturnValue({
      where: vi.fn().mockResolvedValue([{ count: 10 }]),
    });
    mockDb.select.mockReturnValue({ from: mockSelectFrom });

    await updateCollectionCounts('col-1');
    expect(mockDb.update).toHaveBeenCalled();
  });

  it('deleteCollection sets is_active=false (soft delete)', async () => {
    await deleteCollection('col-1');
    expect(mockDb.update).toHaveBeenCalled();
    expect(mockUpdateSet).toHaveBeenCalledWith({ isActive: false });
  });

  describe('updateCollection', () => {
    it('updates name and returns updated row', async () => {
      const updated = { ...baseCollectionRow, name: 'Updated Name', updatedAt: new Date() };
      mockUpdateReturning.mockResolvedValueOnce([updated]);

      const result = await updateCollection('col-1', { name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('updates description to null', async () => {
      const updated = { ...baseCollectionRow, description: null, updatedAt: new Date() };
      mockUpdateReturning.mockResolvedValueOnce([updated]);

      const result = await updateCollection('col-1', { description: null });
      expect(result.description).toBeNull();
    });

    it('updates category', async () => {
      const updated = { ...baseCollectionRow, category: 'brand', updatedAt: new Date() };
      mockUpdateReturning.mockResolvedValueOnce([updated]);

      const result = await updateCollection('col-1', { category: 'brand' });
      expect(result.category).toBe('brand');
    });

    it('throws when collection not found', async () => {
      mockUpdateReturning.mockResolvedValueOnce([]);

      await expect(updateCollection('non-existent', { name: 'X' })).rejects.toThrow(
        'Collection non-existent not found',
      );
    });

    it('throws when DB is null', async () => {
      (db as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

      await expect(updateCollection('col-1', { name: 'X' })).rejects.toThrow(
        'Database connection required',
      );
    });

    it('always sets updatedAt', async () => {
      mockUpdateReturning.mockResolvedValueOnce([baseCollectionRow]);
      await updateCollection('col-1', { name: 'Test' });

      const setCall = mockUpdateSet.mock.calls[0]![0] as Record<string, unknown>;
      expect(setCall).toHaveProperty('updatedAt');
      expect(setCall.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('getDocumentById', () => {
    it('returns document when found', async () => {
      mockSelectLimit.mockResolvedValueOnce([baseDocumentRow]);
      mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit });
      mockSelectFrom.mockReturnValueOnce({ where: mockSelectWhere });

      const result = await getDocumentById('col-1', 'doc-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('doc-1');
      expect(result!.title).toBe('Test Document');
      expect(result!.contentText).toBe('Some content here');
    });

    it('returns null when document not found', async () => {
      mockSelectLimit.mockResolvedValueOnce([]);
      mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit });
      mockSelectFrom.mockReturnValueOnce({ where: mockSelectWhere });

      const result = await getDocumentById('col-1', 'non-existent');
      expect(result).toBeNull();
    });

    it('returns null when DB is null', async () => {
      (db as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

      const result = await getDocumentById('col-1', 'doc-1');
      expect(result).toBeNull();
    });

    it('maps all fields correctly', async () => {
      mockSelectLimit.mockResolvedValueOnce([baseDocumentRow]);
      mockSelectWhere.mockReturnValueOnce({ limit: mockSelectLimit });
      mockSelectFrom.mockReturnValueOnce({ where: mockSelectWhere });

      const result = await getDocumentById('col-1', 'doc-1');
      expect(result).toEqual({
        id: 'doc-1',
        collectionId: 'col-1',
        title: 'Test Document',
        sourceType: 'text',
        sourceUrl: null,
        contentText: 'Some content here',
        metadata: null,
        chunkCount: 3,
        createdAt: baseDocumentRow.createdAt,
        updatedAt: baseDocumentRow.updatedAt,
      });
    });
  });
});
