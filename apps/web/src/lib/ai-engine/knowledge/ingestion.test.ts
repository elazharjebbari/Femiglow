import { afterAll, afterEach, beforeAll, describe, expect, it, vi, beforeEach } from 'vitest';
import { server, http, HttpResponse } from '@/test/msw/server';

const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockReturning = vi.fn();
const mockValues = vi.fn();
const mockSet = vi.fn();
const mockWhere = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockSelectWhere = vi.fn();
const mockLimit = vi.fn();
const mockDelete = vi.fn();
const mockDeleteWhere = vi.fn();
const mockTransaction = vi.fn();

const mockDb = {
  insert: mockInsert,
  update: mockUpdate,
  select: mockSelect,
  delete: mockDelete,
  transaction: mockTransaction,
};

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((...args: unknown[]) => ({ type: 'eq', args })),
  and: vi.fn((...args: unknown[]) => ({ type: 'and', args })),
}));

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

import { ingestText, ingestUrl, updateDocument } from './ingestion';
import { db } from '@/lib/db/client';

// ARC-004 — l'appel fetch(url) de ingestUrl est intercepté par MSW (au lieu de
// vi.spyOn(globalThis, 'fetch')). Les embeddings passent par le module mocké
// @langchain/openai, donc pas de handler MSW pour eux.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

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
    let capturedUrl = '';
    let capturedUserAgent: string | null = null;
    server.use(
      http.get('https://example.com/article', ({ request }) => {
        capturedUrl = request.url;
        capturedUserAgent = request.headers.get('User-Agent');
        return new HttpResponse(
          '<html><title>Test Page</title><body><p>Test body content</p></body></html>',
          { status: 200 },
        );
      }),
    );

    await ingestUrl('col-1', 'https://example.com/article');
    expect(capturedUrl).toBe('https://example.com/article');
    expect(capturedUserAgent).toBe('FemiGlow-KnowledgeBot/1.0');
  });

  it('calls ingestText with fetched content', async () => {
    server.use(
      http.get('https://example.com/article', () =>
        new HttpResponse(
          '<html><title>My Article</title><body><p>Article content here</p></body></html>',
          { status: 200 },
        ),
      ),
    );

    const result = await ingestUrl('col-1', 'https://example.com/article');
    expect(result.success).toBe(true);
    expect(result.documentId).toBe('doc-url-1');
  });

  it('handles fetch error', async () => {
    server.use(http.get('https://example.com/broken', () => HttpResponse.error()));
    const result = await ingestUrl('col-1', 'https://example.com/broken');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Failed to fetch');
  });
});

describe('updateDocument', () => {
  /**
   * Helper: wire up the select→from→where→limit chain on mockDb
   * so that `db().select().from().where().limit()` resolves to `rows`.
   */
  function setupSelectChain(rows: Array<{ id: string; chunkCount: number }>) {
    mockLimit.mockResolvedValue(rows);
    mockSelectWhere.mockReturnValue({ limit: mockLimit });
    mockFrom.mockReturnValue({ where: mockSelectWhere });
    mockSelect.mockReturnValue({ from: mockFrom });
  }

  /**
   * Helper: wire up update→set→where and delete→where chains.
   */
  function setupMutationChains() {
    mockWhere.mockResolvedValue(undefined);
    mockSet.mockReturnValue({ where: mockWhere });
    mockUpdate.mockReturnValue({ set: mockSet });

    mockDeleteWhere.mockResolvedValue(undefined);
    mockDelete.mockReturnValue({ where: mockDeleteWhere });

    mockValues.mockReturnValue({ returning: mockReturning });
    mockInsert.mockReturnValue({ values: mockValues });
  }

  /**
   * Helper: wire up transaction so it calls fn(mockDb).
   * The transaction callback receives the same mock object so
   * delete / insert / update calls inside can be verified.
   */
  function setupTransaction() {
    mockTransaction.mockImplementation(async (fn: (tx: typeof mockDb) => Promise<void>) => {
      await fn(mockDb);
    });
  }

  beforeEach(async () => {
    vi.clearAllMocks();

    // Re-wire constructor mocks cleared by clearAllMocks
    const { RecursiveCharacterTextSplitter } = await import('@langchain/textsplitters');
    vi.mocked(RecursiveCharacterTextSplitter).mockImplementation(() => ({
      splitText: mockSplitText,
    }) as never);

    const { OpenAIEmbeddings } = await import('@langchain/openai');
    vi.mocked(OpenAIEmbeddings).mockImplementation(() => ({
      embedDocuments: mockEmbedDocuments,
    }) as never);

    // Default: document exists with 2 chunks
    setupSelectChain([{ id: 'doc-1', chunkCount: 2 }]);
    setupMutationChains();
    setupTransaction();

    // Default embeddings & splitter
    mockEmbedDocuments.mockResolvedValue([
      new Array(1536).fill(0.1),
      new Array(1536).fill(0.2),
    ]);
    mockSplitText.mockResolvedValue(['chunk 1', 'chunk 2']);
  });

  // ── Title-only update (no re-chunking) ────────────────────────

  it('updates title without triggering re-chunking — returns reChunked false', async () => {
    const result = await updateDocument('col-1', 'doc-1', { title: 'New Title' });

    expect(result.success).toBe(true);
    expect(result.reChunked).toBe(false);
    expect(result.documentId).toBe('doc-1');
    // update was called for the title change
    expect(mockUpdate).toHaveBeenCalled();
    // transaction was NOT used
    expect(mockTransaction).not.toHaveBeenCalled();
  });

  it('preserves existing chunkCount on title-only update', async () => {
    setupSelectChain([{ id: 'doc-1', chunkCount: 5 }]);

    const result = await updateDocument('col-1', 'doc-1', { title: 'Renamed' });

    expect(result.success).toBe(true);
    expect(result.reChunked).toBe(false);
    expect(result.chunkCount).toBe(5);
  });

  // ── Content update with re-chunking ───────────────────────────

  it('deletes old chunks, creates new ones, updates document — returns reChunked true', async () => {
    mockSplitText.mockResolvedValueOnce(['new chunk A', 'new chunk B', 'new chunk C']);
    mockEmbedDocuments.mockResolvedValueOnce([
      new Array(1536).fill(0.3),
      new Array(1536).fill(0.4),
      new Array(1536).fill(0.5),
    ]);

    const result = await updateDocument('col-1', 'doc-1', { content: 'Updated long content' });

    expect(result.success).toBe(true);
    expect(result.reChunked).toBe(true);
    expect(result.chunkCount).toBe(3);
    // Transaction was used
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    // Inside the transaction: delete old chunks
    expect(mockDelete).toHaveBeenCalled();
    // Inside the transaction: insert new chunks
    expect(mockInsert).toHaveBeenCalled();
  });

  it('calls updateCollectionCounts after re-chunking', async () => {
    const { updateCollectionCounts } = await import('./collections');

    await updateDocument('col-1', 'doc-1', { content: 'New content' });

    expect(updateCollectionCounts).toHaveBeenCalledWith('col-1');
  });

  it('updates title and content simultaneously', async () => {
    mockSplitText.mockResolvedValueOnce(['combined chunk']);
    mockEmbedDocuments.mockResolvedValueOnce([new Array(1536).fill(0.6)]);

    const result = await updateDocument('col-1', 'doc-1', {
      title: 'New Title',
      content: 'New Content',
    });

    expect(result.success).toBe(true);
    expect(result.reChunked).toBe(true);
    expect(result.chunkCount).toBe(1);
    // Transaction path is taken because content changed
    expect(mockTransaction).toHaveBeenCalledTimes(1);
  });

  // ── Error cases ───────────────────────────────────────────────

  it('returns error when document not found', async () => {
    setupSelectChain([]); // empty result set

    const result = await updateDocument('col-1', 'doc-missing', { title: 'X' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Document not found');
    expect(result.reChunked).toBe(false);
    expect(result.chunkCount).toBe(0);
  });

  it('returns error when no DB connection', async () => {
    vi.mocked(db).mockReturnValueOnce(null as never);

    const result = await updateDocument('col-1', 'doc-1', { title: 'X' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('No database connection');
  });

  it('returns error when no API key (embeddings unavailable)', async () => {
    const configMod = await import('../config');
    const origConfig = configMod.getEngineConfig();
    const spy = vi.spyOn(configMod, 'getEngineConfig').mockReturnValue({
      ...origConfig,
      apiKeys: { ...origConfig.apiKeys, openai: undefined },
    });

    const result = await updateDocument('col-1', 'doc-1', { content: 'Re-chunk me' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('OpenAI API key not configured');
    expect(result.reChunked).toBe(false);
    spy.mockRestore();
  });

  it('returns error when transaction throws (simulates rollback)', async () => {
    mockTransaction.mockRejectedValueOnce(new Error('DB write failed'));

    const result = await updateDocument('col-1', 'doc-1', { content: 'Will fail' });

    expect(result.success).toBe(false);
    expect(result.error).toBe('DB write failed');
    expect(result.reChunked).toBe(false);
    expect(result.chunkCount).toBe(0);
  });

  // ── Edge cases ────────────────────────────────────────────────

  it('handles empty content after split (0 chunks) — skips insert', async () => {
    mockSplitText.mockResolvedValueOnce([]);
    mockEmbedDocuments.mockResolvedValueOnce([]);

    const result = await updateDocument('col-1', 'doc-1', { content: '' });

    expect(result.success).toBe(true);
    expect(result.reChunked).toBe(true);
    expect(result.chunkCount).toBe(0);
    // Transaction was used
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    // Old chunks were deleted
    expect(mockDelete).toHaveBeenCalled();
    // No insert because there are no new chunks
    expect(mockInsert).not.toHaveBeenCalled();
    // Document metadata was still updated (chunkCount = 0)
    expect(mockUpdate).toHaveBeenCalled();
  });
});
