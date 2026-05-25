import { describe, expect, it, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockReturning = vi.fn();
const mockValues = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();

const mockDb = {
  insert: mockInsert,
  update: mockUpdate,
};

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(() => mockDb),
}));

vi.mock('@/lib/db/schema-ai-engine', () => ({
  aiEngineKnowledgeDocuments: { id: 'id' },
  aiEngineKnowledgeChunks: {},
}));

vi.mock('../config', () => ({
  getEngineConfig: () => ({
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
  }),
}));

const mockEmbedDocuments = vi.fn().mockResolvedValue([new Array(1536).fill(0.1)]);

vi.mock('@langchain/openai', () => ({
  OpenAIEmbeddings: vi.fn().mockImplementation(() => ({
    embedDocuments: mockEmbedDocuments,
  })),
}));

const mockSplitText = vi.fn().mockResolvedValue(['chunk 1', 'chunk 2']);

vi.mock('@langchain/textsplitters', () => ({
  RecursiveCharacterTextSplitter: vi.fn().mockImplementation(() => ({
    splitText: mockSplitText,
  })),
}));

vi.mock('./collections', () => ({
  updateCollectionCounts: vi.fn().mockResolvedValue(undefined),
}));

import { ingestText, ingestUrl } from './ingestion';
import { db } from '@/lib/db/client';

describe('ingestText', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockReturning.mockResolvedValue([{ id: 'doc-123' }]);
    mockValues.mockReturnValue({ returning: mockReturning });
    mockInsert.mockReturnValue({ values: mockValues });

    mockWhere.mockResolvedValue(undefined);
    mockSet.mockReturnValue({ where: mockWhere });
    mockUpdate.mockReturnValue({ set: mockSet });

    mockEmbedDocuments.mockResolvedValue([
      new Array(1536).fill(0.1),
      new Array(1536).fill(0.2),
    ]);
  });

  it('creates document record', async () => {
    const result = await ingestText('col-1', 'Test Doc', 'Some content about nail care');
    expect(result.success).toBe(true);
    expect(result.documentId).toBe('doc-123');
    expect(mockInsert).toHaveBeenCalled();
  });

  it('splits text into chunks', async () => {
    await ingestText('col-1', 'Test Doc', 'Long content that should be split into chunks');
    expect(mockSplitText).toHaveBeenCalledWith('Long content that should be split into chunks');
  });

  it('handles empty content', async () => {
    mockSplitText.mockResolvedValueOnce([]);
    const result = await ingestText('col-1', 'Empty Doc', '');
    expect(result.success).toBe(true);
    expect(result.chunkCount).toBe(0);
  });

  it('updates collection counts', async () => {
    const { updateCollectionCounts } = await import('./collections');
    await ingestText('col-1', 'Test Doc', 'Content');
    expect(updateCollectionCounts).toHaveBeenCalledWith('col-1');
  });

  it('returns correct chunkCount', async () => {
    mockSplitText.mockResolvedValueOnce(['chunk1', 'chunk2', 'chunk3']);
    mockEmbedDocuments.mockResolvedValueOnce([
      new Array(1536).fill(0.1),
      new Array(1536).fill(0.2),
      new Array(1536).fill(0.3),
    ]);
    const result = await ingestText('col-1', 'Test Doc', 'Content');
    expect(result.chunkCount).toBe(3);
  });

  it('returns failure when no DB connection', async () => {
    vi.mocked(db).mockReturnValueOnce(null as never);
    const result = await ingestText('col-1', 'Test', 'content');
    expect(result.success).toBe(false);
    expect(result.error).toContain('No database connection');
  });

  it('chunk size respects configuration (1000 chars, 200 overlap)', async () => {
    const { RecursiveCharacterTextSplitter } = await import('@langchain/textsplitters');
    await ingestText('col-1', 'Test', 'content');
    expect(RecursiveCharacterTextSplitter).toHaveBeenCalledWith({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
  });

  it('returns failure when no API key', async () => {
    const configMod = await import('../config');
    const origConfig = configMod.getEngineConfig();
    const spy = vi.spyOn(configMod, 'getEngineConfig').mockReturnValue({
      ...origConfig,
      apiKeys: { ...origConfig.apiKeys, openai: undefined },
    });
    const result = await ingestText('col-1', 'Test', 'content');
    expect(result.success).toBe(false);
    expect(result.error).toContain('API key');
    spy.mockRestore();
  });
});

describe('ingestUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockReturning.mockResolvedValue([{ id: 'doc-url-1' }]);
    mockValues.mockReturnValue({ returning: mockReturning });
    mockInsert.mockReturnValue({ values: mockValues });

    mockWhere.mockResolvedValue(undefined);
    mockSet.mockReturnValue({ where: mockWhere });
    mockUpdate.mockReturnValue({ set: mockSet });

    mockEmbedDocuments.mockResolvedValue([new Array(1536).fill(0.1)]);
    mockSplitText.mockResolvedValue(['chunk from url']);
  });

  it('fetches URL content', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('<html><title>Test Page</title><body><p>Test body content</p></body></html>', {
        status: 200,
      }),
    );

    await ingestUrl('col-1', 'https://example.com/article');
    expect(fetchSpy).toHaveBeenCalledWith('https://example.com/article', expect.objectContaining({
      headers: { 'User-Agent': 'FemiGlow-KnowledgeBot/1.0' },
    }));
    fetchSpy.mockRestore();
  });

  it('calls ingestText with fetched content', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('<html><title>My Article</title><body><p>Article content here</p></body></html>', {
        status: 200,
      }),
    );

    const result = await ingestUrl('col-1', 'https://example.com/article');
    expect(result.success).toBe(true);
    expect(result.documentId).toBe('doc-url-1');
    vi.restoreAllMocks();
  });

  it('handles fetch error', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));
    const result = await ingestUrl('col-1', 'https://example.com/broken');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Network error');
    vi.restoreAllMocks();
  });
});
