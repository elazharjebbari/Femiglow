/**
 * Tests pour `classifyByEmbedding` — couvre seuil, labels invalides,
 * top-1 multiple langues.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import { classifyByEmbedding, INTENT_VECTOR_THRESHOLD } from './intent-vector';
import { intentCentroidRepo } from '../repos/intent';

vi.mock('../repos/intent', () => ({
  intentCentroidRepo: {
    match: vi.fn(),
  },
}));

const matchMock = intentCentroidRepo.match as unknown as ReturnType<typeof vi.fn>;

afterEach(() => {
  matchMock.mockReset();
});

describe('classifyByEmbedding', () => {
  it("retourne null si aucun centroid n'est trouvé", async () => {
    matchMock.mockResolvedValueOnce([]);
    const result = await classifyByEmbedding([0.1, 0.2], 'fr');
    expect(result).toBeNull();
  });

  it("retourne null si le score top-1 est sous le seuil", async () => {
    matchMock.mockResolvedValueOnce([
      { intent: 'pricing', language: 'all', score: INTENT_VECTOR_THRESHOLD - 0.05, sampleCount: 5 },
    ]);
    const result = await classifyByEmbedding([0.1], 'fr');
    expect(result).toBeNull();
  });

  it('retourne le match si le score est ≥ seuil et le label est valide', async () => {
    matchMock.mockResolvedValueOnce([
      { intent: 'pricing', language: 'all', score: 0.72, sampleCount: 6 },
    ]);
    const result = await classifyByEmbedding([0.1], 'fr');
    expect(result).toEqual({ intent: 'pricing', score: 0.72, sampleCount: 6 });
  });

  it('rejette les labels inconnus (defensive)', async () => {
    matchMock.mockResolvedValueOnce([
      { intent: 'something-new', language: 'all', score: 0.9, sampleCount: 10 },
    ]);
    const result = await classifyByEmbedding([0.1], 'fr');
    expect(result).toBeNull();
  });

  it('appelle le repo avec la langue cible', async () => {
    matchMock.mockResolvedValueOnce([]);
    await classifyByEmbedding([0.1], 'ar-MA');
    expect(matchMock).toHaveBeenCalledWith([0.1], { language: 'ar-MA', limit: 1 });
  });
});
