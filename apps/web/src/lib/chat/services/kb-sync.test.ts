/**
 * CHA-308 — Tests `syncKnowledgeSources`.
 *
 * On mocke `sourceRepo.listForResync` + `ragService.ingest` pour valider :
 *  - aucune source → rapport vide
 *  - source sans locator → comptée en erreur
 *  - happy path : compte refreshed vs unchanged via `reused`
 *  - erreur ingest → comptée + détaillée
 *  - limite `maxSources` respectée
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../repos/knowledge', () => ({
  sourceRepo: {
    listForResync: vi.fn(),
  },
}));

vi.mock('../rag/service', () => ({
  ragService: {
    ingest: vi.fn(),
  },
}));

import { sourceRepo } from '../repos/knowledge';
import { ragService } from '../rag/service';
import { syncKnowledgeSources } from './kb-sync';

const listMock = sourceRepo.listForResync as unknown as ReturnType<typeof vi.fn>;
const ingestMock = ragService.ingest as unknown as ReturnType<typeof vi.fn>;

function source(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'ck_1',
    kind: 'url',
    label: 'Pricing page',
    locator: 'https://example.com/pricing',
    rawHash: 'abc',
    language: 'fr',
    tags: [],
    audience: 'all',
    freshness: 'volatile',
    enabled: true,
    chunkCount: 5,
    blobUrl: null,
    lastIngestedAt: new Date(),
    createdBy: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('syncKnowledgeSources', () => {
  it('renvoie un rapport vide si aucune source à sync', async () => {
    listMock.mockResolvedValueOnce([]);
    const report = await syncKnowledgeSources();
    expect(report.scanned).toBe(0);
    expect(report.refreshed).toBe(0);
    expect(report.unchanged).toBe(0);
    expect(report.errors).toBe(0);
    expect(ingestMock).not.toHaveBeenCalled();
  });

  it('compte refreshed quand ingest renvoie reused=false', async () => {
    listMock.mockResolvedValueOnce([source()]);
    ingestMock.mockResolvedValueOnce({
      sourceId: 'ck_1',
      chunkCount: 8,
      reused: false,
    });
    const report = await syncKnowledgeSources();
    expect(report.scanned).toBe(1);
    expect(report.refreshed).toBe(1);
    expect(report.unchanged).toBe(0);
    expect(ingestMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'url',
        locator: 'https://example.com/pricing',
        createdBy: 'cron:kb-sync',
      }),
    );
  });

  it('compte unchanged quand ingest renvoie reused=true', async () => {
    listMock.mockResolvedValueOnce([source()]);
    ingestMock.mockResolvedValueOnce({
      sourceId: 'ck_1',
      chunkCount: 5,
      reused: true,
    });
    const report = await syncKnowledgeSources();
    expect(report.refreshed).toBe(0);
    expect(report.unchanged).toBe(1);
  });

  it('compte une erreur si le locator est absent', async () => {
    listMock.mockResolvedValueOnce([source({ locator: null })]);
    const report = await syncKnowledgeSources();
    expect(report.errors).toBe(1);
    expect(report.errorDetails[0]).toMatchObject({
      sourceId: 'ck_1',
      reason: 'no-locator',
    });
    expect(ingestMock).not.toHaveBeenCalled();
  });

  it("attrape les erreurs d'ingest et continue avec les sources suivantes", async () => {
    listMock.mockResolvedValueOnce([
      source({ id: 'ck_1' }),
      source({ id: 'ck_2' }),
    ]);
    ingestMock.mockRejectedValueOnce(new Error('fetch timed out'));
    ingestMock.mockResolvedValueOnce({
      sourceId: 'ck_2',
      chunkCount: 3,
      reused: false,
    });
    const report = await syncKnowledgeSources();
    expect(report.scanned).toBe(2);
    expect(report.errors).toBe(1);
    expect(report.refreshed).toBe(1);
    expect(report.errorDetails[0]).toMatchObject({
      sourceId: 'ck_1',
      reason: 'fetch timed out',
    });
  });

  it('respecte la limite maxSources', async () => {
    listMock.mockResolvedValueOnce(
      Array.from({ length: 30 }, (_, i) => source({ id: `ck_${i}` })),
    );
    ingestMock.mockResolvedValue({ sourceId: 'x', chunkCount: 1, reused: true });
    const report = await syncKnowledgeSources({ maxSources: 5 });
    expect(report.scanned).toBe(5);
    expect(ingestMock).toHaveBeenCalledTimes(5);
  });

  it("passe l'option freshness au repo", async () => {
    listMock.mockResolvedValueOnce([]);
    await syncKnowledgeSources({ freshness: ['volatile', 'seasonal'] });
    expect(listMock).toHaveBeenCalledWith({
      kinds: ['url'],
      freshness: ['volatile', 'seasonal'],
    });
  });
});
