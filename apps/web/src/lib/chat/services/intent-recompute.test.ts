/**
 * CHA-307 — Tests `recomputeAllCentroids`.
 *
 * On mocke `intentExampleRepo`, `intentCentroidRepo` et `embedTexts`
 * pour valider :
 *   - 0 exemple → skip 'no-examples'
 *   - provider absent → skip 'no-provider' (sans erreur)
 *   - happy path : group par intent, UPSERT pour chaque
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EmbeddingProviderUnavailableError } from './embeddings';

vi.mock('../repos/intent', () => ({
  intentExampleRepo: {
    listActive: vi.fn(),
  },
  intentCentroidRepo: {
    upsert: vi.fn(),
  },
}));

vi.mock('./embeddings', async () => {
  const mod = await vi.importActual<typeof import('./embeddings')>('./embeddings');
  return {
    ...mod,
    embedTexts: vi.fn(),
  };
});

import { intentCentroidRepo, intentExampleRepo } from '../repos/intent';
import { embedTexts } from './embeddings';
import { recomputeAllCentroids } from './intent-recompute';

const listActiveMock = intentExampleRepo.listActive as unknown as ReturnType<
  typeof vi.fn
>;
const upsertMock = intentCentroidRepo.upsert as unknown as ReturnType<typeof vi.fn>;
const embedTextsMock = embedTexts as unknown as ReturnType<typeof vi.fn>;

function makeVector(seed: number, dim = 8): number[] {
  return new Array(dim).fill(0).map((_, i) => Math.sin(seed + i));
}

afterEach(() => {
  vi.resetAllMocks();
});

describe('recomputeAllCentroids', () => {
  it("skip 'no-examples' si la table est vide", async () => {
    listActiveMock.mockResolvedValueOnce([]);
    const report = await recomputeAllCentroids();
    expect(report.skipped).toBe('no-examples');
    expect(embedTextsMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it("skip 'no-provider' si embedTexts throws unavailable", async () => {
    listActiveMock.mockResolvedValueOnce([
      { id: 'e1', intent: 'pricing', language: 'fr', text: 'prix', deletedAt: null },
    ]);
    embedTextsMock.mockRejectedValueOnce(new EmbeddingProviderUnavailableError());
    const report = await recomputeAllCentroids();
    expect(report.skipped).toBe('no-provider');
    expect(report.examplesScanned).toBe(1);
    expect(upsertMock).not.toHaveBeenCalled();
  });

  it('group par intent et UPSERT pour chaque cluster', async () => {
    listActiveMock.mockResolvedValueOnce([
      { id: 'e1', intent: 'pricing', language: 'fr', text: 'combien' },
      { id: 'e2', intent: 'pricing', language: 'ar', text: 'بالكم' },
      { id: 'e3', intent: 'shipping', language: 'fr', text: 'délai livraison' },
    ]);
    embedTextsMock.mockResolvedValueOnce({
      vectors: [makeVector(1), makeVector(2), makeVector(3)],
      model: 'text-embedding-3-small',
      provider: 'openai',
      dim: 8,
    });
    upsertMock.mockResolvedValueOnce({
      inserted: true,
      updated: false,
      id: 'ic_a',
    });
    upsertMock.mockResolvedValueOnce({
      inserted: false,
      updated: true,
      id: 'ic_b',
    });

    const report = await recomputeAllCentroids();
    expect(report.skipped).toBeNull();
    expect(report.examplesScanned).toBe(3);
    expect(report.intentsTouched).toBe(2);
    expect(report.centroidsInserted).toBe(1);
    expect(report.centroidsUpdated).toBe(1);
    expect(report.embeddingModel).toBe('text-embedding-3-small');

    expect(upsertMock).toHaveBeenCalledTimes(2);
    const intentNames = upsertMock.mock.calls.map(
      (c) => (c[0] as { intent: string }).intent,
    );
    expect(intentNames.sort()).toEqual(['pricing', 'shipping']);
    const sampleCounts = upsertMock.mock.calls.map(
      (c) => (c[0] as { sampleCount: number }).sampleCount,
    );
    expect(sampleCounts.sort()).toEqual([1, 2]); // pricing=2, shipping=1
    const languages = upsertMock.mock.calls.map(
      (c) => (c[0] as { language: string }).language,
    );
    expect(languages.every((l) => l === 'all')).toBe(true);
  });

  it('batche les embeddings (≥16 textes appelle embedTexts plusieurs fois)', async () => {
    const examples = Array.from({ length: 20 }, (_, i) => ({
      id: `e${i}`,
      intent: 'misc',
      language: 'fr' as const,
      text: `t${i}`,
    }));
    listActiveMock.mockResolvedValueOnce(examples);

    // Premier batch (16) puis second (4)
    embedTextsMock.mockResolvedValueOnce({
      vectors: Array.from({ length: 16 }, (_, i) => makeVector(i)),
      model: 'm',
      provider: 'p',
      dim: 8,
    });
    embedTextsMock.mockResolvedValueOnce({
      vectors: Array.from({ length: 4 }, (_, i) => makeVector(20 + i)),
      model: 'm',
      provider: 'p',
      dim: 8,
    });
    upsertMock.mockResolvedValueOnce({ inserted: true, updated: false, id: 'x' });

    const report = await recomputeAllCentroids();
    expect(embedTextsMock).toHaveBeenCalledTimes(2);
    expect(report.examplesScanned).toBe(20);
    expect(report.intentsTouched).toBe(1);
  });
});
