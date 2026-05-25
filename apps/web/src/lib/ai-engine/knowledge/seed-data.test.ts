import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockSeedDefaultCollections = vi.fn();
const mockIngestText = vi.fn();

vi.mock('./collections', () => ({
  seedDefaultCollections: (...args: unknown[]) => mockSeedDefaultCollections(...args),
  getCollection: vi.fn(),
}));

vi.mock('./ingestion', () => ({
  ingestText: (...args: unknown[]) => mockIngestText(...args),
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { seedKnowledgeBase } from './seed-data';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('seedKnowledgeBase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates default collections', async () => {
    mockSeedDefaultCollections.mockResolvedValue([
      { id: 'col-1', slug: 'brand-femiglow', documentCount: 0 },
      { id: 'col-2', slug: 'neuromarketing', documentCount: 0 },
      { id: 'col-3', slug: 'platform-algorithms', documentCount: 0 },
    ]);

    mockIngestText.mockResolvedValue({ documentId: 'doc-1', chunkCount: 5, success: true });

    const result = await seedKnowledgeBase();
    expect(mockSeedDefaultCollections).toHaveBeenCalledTimes(1);
    expect(result.collections).toBe(3);
  });

  it('ingests documents into matching collections', async () => {
    mockSeedDefaultCollections.mockResolvedValue([
      { id: 'col-1', slug: 'brand-femiglow', documentCount: 0 },
      { id: 'col-2', slug: 'neuromarketing', documentCount: 0 },
      { id: 'col-3', slug: 'platform-algorithms', documentCount: 0 },
    ]);

    mockIngestText.mockResolvedValue({ documentId: 'doc-1', chunkCount: 5, success: true });

    const result = await seedKnowledgeBase();
    // brand-femiglow has 4 docs, neuromarketing has 3 docs, platform-algorithms has 3 docs = 10 total
    expect(mockIngestText).toHaveBeenCalled();
    expect(result.documents).toBeGreaterThan(0);
  });

  it('handles errors gracefully (returns partial results)', async () => {
    mockSeedDefaultCollections.mockResolvedValue([
      { id: 'col-1', slug: 'brand-femiglow', documentCount: 0 },
      { id: 'col-2', slug: 'neuromarketing', documentCount: 0 },
    ]);

    // Some succeed, some fail
    let callCount = 0;
    mockIngestText.mockImplementation(async () => {
      callCount++;
      if (callCount % 2 === 0) {
        return { documentId: '', chunkCount: 0, success: false, error: 'DB error' };
      }
      return { documentId: `doc-${callCount}`, chunkCount: 5, success: true };
    });

    const result = await seedKnowledgeBase();
    // Should have some successful documents and some errors
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.documents).toBeGreaterThan(0);
  });

  it('returns collections and documents counts', async () => {
    mockSeedDefaultCollections.mockResolvedValue([
      { id: 'col-1', slug: 'brand-femiglow', documentCount: 0 },
    ]);

    mockIngestText.mockResolvedValue({ documentId: 'doc-1', chunkCount: 5, success: true });

    const result = await seedKnowledgeBase();
    expect(typeof result.collections).toBe('number');
    expect(typeof result.documents).toBe('number');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(result.collections).toBe(1);
    // brand-femiglow has 4 seed documents
    expect(result.documents).toBe(4);
  });
});
