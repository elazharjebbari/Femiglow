import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./collectors', () => ({
  collectSeasonalSignals: vi.fn().mockResolvedValue([
    {
      source: 'seasonal',
      category: 'seasonal',
      title: 'Sakura Season',
      description: 'Cherry blossom season',
      rawScore: 0.85,
      detectedAt: new Date(),
    },
  ]),
  collectRedditSignals: vi.fn().mockResolvedValue([
    {
      source: 'reddit',
      category: 'routine',
      title: 'Nail care routine hack',
      description: 'Amazing nail care beauty routine',
      rawScore: 0.7,
      detectedAt: new Date(),
    },
  ]),
  collectGoogleTrends: vi.fn().mockResolvedValue([
    {
      source: 'google_trends',
      category: 'routine',
      title: 'Trending: j-beauty',
      description: 'J-beauty trending on Google',
      rawScore: 0.6,
      detectedAt: new Date(),
    },
  ]),
}));

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { getTrends, getTrendForGeneration, clearTrendCache } from './engine';
import { collectSeasonalSignals, collectRedditSignals, collectGoogleTrends } from './collectors';

describe('getTrends', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearTrendCache();
  });

  it('returns scored trends', async () => {
    const trends = await getTrends();
    expect(Array.isArray(trends)).toBe(true);
    expect(trends.length).toBeGreaterThan(0);
    for (const t of trends) {
      expect(t).toHaveProperty('compositeScore');
      expect(t).toHaveProperty('title');
      expect(t).toHaveProperty('category');
      expect(typeof t.compositeScore).toBe('number');
    }
  });

  it('filters by minScore', async () => {
    const trends = await getTrends({ minScore: 0.9 });
    for (const t of trends) {
      expect(t.compositeScore).toBeGreaterThanOrEqual(0.9);
    }
  });

  it('filters by categories', async () => {
    const trends = await getTrends({ categories: ['seasonal'] });
    for (const t of trends) {
      expect(t.category).toBe('seasonal');
    }
  });

  it('limits results', async () => {
    const trends = await getTrends({ limit: 1 });
    expect(trends.length).toBeLessThanOrEqual(1);
  });

  it('uses cache (second call same result, no re-collect)', async () => {
    await getTrends();
    await getTrends();

    // Collectors should only be called once (first call populates cache)
    expect(collectSeasonalSignals).toHaveBeenCalledTimes(1);
    expect(collectRedditSignals).toHaveBeenCalledTimes(1);
    expect(collectGoogleTrends).toHaveBeenCalledTimes(1);
  });

  it('forceRefresh clears cache', async () => {
    await getTrends();
    expect(collectSeasonalSignals).toHaveBeenCalledTimes(1);

    await getTrends({ forceRefresh: true });
    expect(collectSeasonalSignals).toHaveBeenCalledTimes(2);
  });

  it('clearTrendCache resets cache', async () => {
    await getTrends();
    expect(collectSeasonalSignals).toHaveBeenCalledTimes(1);

    clearTrendCache();
    await getTrends();
    expect(collectSeasonalSignals).toHaveBeenCalledTimes(2);
  });

  it('getTrendForGeneration returns formatted context string', async () => {
    const context = await getTrendForGeneration('instagram', 'reel', 'engagement');
    expect(typeof context).toBe('string');
  });
});
