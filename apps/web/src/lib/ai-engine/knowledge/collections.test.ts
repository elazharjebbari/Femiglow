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
};

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
      where: mockUpdateWhere.mockResolvedValue(undefined),
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
    collectionId: 'collection_id',
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
  updateCollectionCounts,
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

    mockUpdateWhere.mockResolvedValue(undefined);
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
});
