import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockExecute = vi.fn();
const mockDb = {
  execute: mockExecute,
};

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(() => mockDb),
}));

vi.mock('../config', () => ({
  getEngineConfig: vi.fn(() => ({
    enabled: true,
    apiKeys: { openai: 'test-key' },
    providers: {
      text: { default: 'openai', model: 'gpt-4o-mini' },
      image: { default: 'mock', model: 'mock' },
      video: { default: 'mock' },
      tts: { default: 'mock' },
    },
    budget: { dailyCents: 1000, maxPerJobCents: 100 },
    quality: { threshold: 0.7, humanReviewRequired: false },
    defaults: { tone: 'professional', language: 'fr', maxRetries: 3 },
  })),
}));

const mockEmbedQuery = vi.fn().mockResolvedValue(new Array(1536).fill(0.1));

vi.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: vi.fn().mockImplementation(() => ({
    embedQuery: mockEmbedQuery,
  })),
}));

import { searchKnowledge, searchByCollections } from './retrieval';
import { db } from '@/lib/db/client';
import { getEngineConfig } from '../config';

const defaultRows = [
  {
    id: 'chunk-1',
    content: 'Test content about camellia oil',
    metadata: { chunkIndex: 0 },
    document_title: 'Camellia Guide',
    similarity: 0.92,
  },
  {
    id: 'chunk-2',
    content: 'Nail care routine',
    metadata: null,
    document_title: 'Nail Care',
    similarity: 0.85,
  },
];

describe('searchKnowledge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute.mockResolvedValue({ rows: defaultRows });
    vi.mocked(db).mockReturnValue(mockDb as never);
    vi.mocked(getEngineConfig).mockReturnValue({
      enabled: true,
      apiKeys: { openai: 'test-key', anthropic: undefined, google: undefined, elevenlabs: undefined, higgsfield: undefined, ollamaBaseUrl: undefined },
      providers: {
        text: { default: 'openai', model: 'gpt-4o-mini' },
        image: { default: 'mock', model: 'mock' },
        video: { default: 'mock' },
        tts: { default: 'mock' },
      },
      budget: { dailyCents: 1000, maxPerJobCents: 100 },
      quality: { threshold: 0.7, humanReviewRequired: false },
      defaults: { tone: 'professional', language: 'fr', maxRetries: 3 },
    });
  });

  it('returns array of SearchResult', async () => {
    const results = await searchKnowledge('camellia oil benefits');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBe(2);
    expect(results[0]).toMatchObject({
      id: 'chunk-1',
      content: 'Test content about camellia oil',
      documentTitle: 'Camellia Guide',
      similarity: 0.92,
    });
  });

  it('returns empty array when no DB', async () => {
    vi.mocked(db).mockReturnValueOnce(null as never);
    const results = await searchKnowledge('test query');
    expect(results).toEqual([]);
  });

  it('returns empty array when no API key', async () => {
    vi.mocked(getEngineConfig).mockReturnValueOnce({
      enabled: true,
      apiKeys: { openai: undefined, anthropic: undefined, google: undefined, elevenlabs: undefined, higgsfield: undefined, ollamaBaseUrl: undefined },
      providers: {
        text: { default: 'openai', model: 'gpt-4o-mini' },
        image: { default: 'mock', model: 'mock' },
        video: { default: 'mock' },
        tts: { default: 'mock' },
      },
      budget: { dailyCents: 1000, maxPerJobCents: 100 },
      quality: { threshold: 0.7, humanReviewRequired: false },
      defaults: { tone: 'professional', language: 'fr', maxRetries: 3 },
    });

    const results = await searchKnowledge('test query');
    expect(results).toEqual([]);
  });

  it('filters by collection slugs', async () => {
    await searchKnowledge('test', { collectionSlugs: ['neuromarketing', 'brand-femiglow'] });
    expect(mockExecute).toHaveBeenCalled();
  });

  it('filters by score threshold', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { id: 'c1', content: 'High score', metadata: null, document_title: 'Doc', similarity: 0.95 },
      ],
    });

    const results = await searchKnowledge('test', { scoreThreshold: 0.9 });
    expect(results.length).toBe(1);
    expect(results[0]!.similarity).toBe(0.95);
  });

  it('limits results to k', async () => {
    mockExecute.mockResolvedValueOnce({
      rows: [
        { id: 'c1', content: 'A', metadata: null, document_title: 'D1', similarity: 0.9 },
      ],
    });

    const results = await searchKnowledge('test', { k: 1 });
    expect(results.length).toBeLessThanOrEqual(1);
  });

  it('searchByCollections is convenience wrapper', async () => {
    const results = await searchByCollections('test query', ['brand-femiglow'], 3);
    expect(Array.isArray(results)).toBe(true);
    expect(mockEmbedQuery).toHaveBeenCalledWith('test query');
  });

  it('results have content, documentTitle, similarity', async () => {
    const results = await searchKnowledge('camellia');
    for (const r of results) {
      expect(r).toHaveProperty('content');
      expect(r).toHaveProperty('documentTitle');
      expect(r).toHaveProperty('similarity');
      expect(typeof r.content).toBe('string');
      expect(typeof r.documentTitle).toBe('string');
      expect(typeof r.similarity).toBe('number');
    }
  });

  it('empty query returns empty array', async () => {
    mockExecute.mockResolvedValueOnce({ rows: [] });
    const results = await searchKnowledge('');
    expect(results).toEqual([]);
  });

  it('handles DB query error gracefully', async () => {
    mockExecute.mockRejectedValueOnce(new Error('DB connection lost'));
    const results = await searchKnowledge('test query');
    expect(results).toEqual([]);
  });
});
