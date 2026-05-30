import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

const mockSeedDefaultCollections = vi.fn();
const mockIngestText = vi.fn();
const mockDb = vi.fn();

vi.mock('./collections', () => ({
  seedDefaultCollections: (...args: unknown[]) => mockSeedDefaultCollections(...args),
}));

vi.mock('./ingestion', () => ({
  ingestText: (...args: unknown[]) => mockIngestText(...args),
}));

vi.mock('@/lib/db/client', () => ({
  db: () => mockDb(),
}));

vi.mock('@/lib/db/schema-ai-engine', () => ({
  aiEngineKnowledgeDocuments: { id: 'id', collectionId: 'collectionId', title: 'title' },
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { seedStrategicBrief, STRATEGIC_BRIEF_DOCUMENTS } from './seed-strategic-brief';

const ALL_SLUGS = Object.keys(STRATEGIC_BRIEF_DOCUMENTS);
const TOTAL_DOCS = Object.values(STRATEGIC_BRIEF_DOCUMENTS).reduce((n, d) => n + d.length, 0);

function collectionsFor(slugs: string[]) {
  return slugs.map((slug, i) => ({ id: `col-${i}`, slug, documentCount: 0 }));
}

// Chainable drizzle stub whose terminal .limit() resolves to `existing`.
function dbStub(existing: unknown[]) {
  const chain = {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    limit: vi.fn(async () => existing),
  };
  return chain;
}

describe('seedStrategicBrief', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('targets the eight strategic collections', () => {
    expect(ALL_SLUGS.sort()).toEqual(
      [
        'ai-content-rules',
        'brand-femiglow',
        'copywriting',
        'emerging-trends',
        'jbeauty-strategy',
        'neuromarketing',
        'platform-algorithms',
        'viral-content',
      ].sort(),
    );
  });

  it('content is free of raw citation markers and emoji', () => {
    for (const docs of Object.values(STRATEGIC_BRIEF_DOCUMENTS)) {
      for (const doc of docs) {
        // Raw research-tool citation markers like "citeturn0search0" / "turn13search0"
        expect(doc.content).not.toMatch(/cite\w*turn\d|turn\d+(search|file|view|news)/i);
        // No emoji in the high-altitude range
        expect(doc.content).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
      }
    }
  });

  it('ingests every strategic document when none exist yet', async () => {
    mockSeedDefaultCollections.mockResolvedValue(collectionsFor(ALL_SLUGS));
    mockDb.mockReturnValue(dbStub([])); // no existing docs
    mockIngestText.mockResolvedValue({ documentId: 'd', chunkCount: 3, success: true });

    const result = await seedStrategicBrief();
    expect(result.documents).toBe(TOTAL_DOCS);
    expect(result.skipped).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(mockIngestText).toHaveBeenCalledTimes(TOTAL_DOCS);
  });

  it('is idempotent — skips documents whose title already exists', async () => {
    mockSeedDefaultCollections.mockResolvedValue(collectionsFor(ALL_SLUGS));
    mockDb.mockReturnValue(dbStub([{ id: 'existing' }])); // every title already present
    mockIngestText.mockResolvedValue({ documentId: 'd', chunkCount: 3, success: true });

    const result = await seedStrategicBrief();
    expect(result.skipped).toBe(TOTAL_DOCS);
    expect(result.documents).toBe(0);
    expect(mockIngestText).not.toHaveBeenCalled();
  });

  it('records an error when a target collection is missing', async () => {
    mockSeedDefaultCollections.mockResolvedValue(collectionsFor(['brand-femiglow']));
    mockDb.mockReturnValue(dbStub([]));
    mockIngestText.mockResolvedValue({ documentId: 'd', chunkCount: 3, success: true });

    const result = await seedStrategicBrief();
    // Only brand-femiglow can be seeded; the other 7 collections are reported missing.
    expect(result.errors.length).toBe(ALL_SLUGS.length - 1);
    expect(result.documents).toBe(STRATEGIC_BRIEF_DOCUMENTS['brand-femiglow']!.length);
  });

  it('still ingests when DB is unavailable (idempotency check skipped)', async () => {
    mockSeedDefaultCollections.mockResolvedValue(collectionsFor(ALL_SLUGS));
    mockDb.mockReturnValue(null);
    mockIngestText.mockResolvedValue({ documentId: 'd', chunkCount: 3, success: true });

    const result = await seedStrategicBrief();
    expect(result.documents).toBe(TOTAL_DOCS);
    expect(mockIngestText).toHaveBeenCalledTimes(TOTAL_DOCS);
  });

  it('surfaces ingestion failures in errors', async () => {
    mockSeedDefaultCollections.mockResolvedValue(collectionsFor(ALL_SLUGS));
    mockDb.mockReturnValue(dbStub([]));
    mockIngestText.mockResolvedValue({ documentId: '', chunkCount: 0, success: false, error: 'boom' });

    const result = await seedStrategicBrief();
    expect(result.documents).toBe(0);
    expect(result.errors.length).toBe(TOTAL_DOCS);
  });
});
