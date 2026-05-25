import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import {
  collectSeasonalSignals,
  collectRedditSignals,
  collectGoogleTrends,
  collectRSSFeeds,
  type RawTrendSignal,
} from './collectors';

describe('collectSeasonalSignals', () => {
  it('returns signals for current month', async () => {
    const signals = await collectSeasonalSignals();
    expect(Array.isArray(signals)).toBe(true);
    // Should always return at least the evergreen signals
    expect(signals.length).toBeGreaterThan(0);
  });

  it('includes year-round trends', async () => {
    const signals = await collectSeasonalSignals();
    const evergreenSources = signals.filter((s) => s.source === 'evergreen');
    // There are 4 evergreen signals defined
    expect(evergreenSources.length).toBe(4);
    expect(evergreenSources.every((s) => s.rawScore === 0.75)).toBe(true);
  });

  it('each signal has source, category, title, description, detectedAt', async () => {
    const signals = await collectSeasonalSignals();
    for (const s of signals) {
      expect(s).toHaveProperty('source');
      expect(s).toHaveProperty('category');
      expect(s).toHaveProperty('title');
      expect(s).toHaveProperty('description');
      expect(s).toHaveProperty('detectedAt');
      expect(s.detectedAt).toBeInstanceOf(Date);
    }
  });
});

describe('collectRedditSignals', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('calls Reddit API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            children: [
              {
                data: {
                  title: 'Amazing nail care routine with Japanese camellia oil',
                  selftext: 'I tried this beauty routine and my skin glows',
                  url: 'https://reddit.com/r/SkincareAddiction/1',
                  score: 500,
                  created_utc: Date.now() / 1000,
                },
              },
              {
                data: {
                  title: 'Random unrelated post about cooking',
                  selftext: 'Recipe for pasta',
                  url: 'https://reddit.com/r/SkincareAddiction/2',
                  score: 200,
                  created_utc: Date.now() / 1000,
                },
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const signals = await collectRedditSignals(['SkincareAddiction']);
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('reddit.com/r/SkincareAddiction'),
      expect.any(Object),
    );
    fetchSpy.mockRestore();
  });

  it('filters beauty-related posts', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            children: [
              {
                data: {
                  title: 'Amazing nail care routine',
                  selftext: 'My beauty skin glow routine',
                  url: 'https://reddit.com/r/test/1',
                  score: 500,
                  created_utc: Date.now() / 1000,
                },
              },
              {
                data: {
                  title: 'How to fix a flat tire',
                  selftext: 'Car maintenance tips',
                  url: 'https://reddit.com/r/test/2',
                  score: 800,
                  created_utc: Date.now() / 1000,
                },
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const signals = await collectRedditSignals(['test']);
    // Only beauty-related post should pass
    expect(signals.length).toBe(1);
    expect(signals[0]!.title).toContain('nail care');
    vi.restoreAllMocks();
  });

  it('handles fetch error gracefully', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Network timeout'));
    const signals = await collectRedditSignals(['SkincareAddiction']);
    expect(signals).toEqual([]);
    vi.restoreAllMocks();
  });

  it('each Reddit signal has required fields', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          data: {
            children: [
              {
                data: {
                  title: 'Japanese beauty oil routine',
                  selftext: 'Camellia oil is great for skin care',
                  url: 'https://reddit.com/r/AsianBeauty/1',
                  score: 300,
                  created_utc: Date.now() / 1000,
                },
              },
            ],
          },
        }),
        { status: 200 },
      ),
    );

    const signals = await collectRedditSignals(['AsianBeauty']);
    for (const s of signals) {
      expect(s).toHaveProperty('source', 'reddit');
      expect(s).toHaveProperty('category');
      expect(s).toHaveProperty('title');
      expect(s).toHaveProperty('description');
      expect(s).toHaveProperty('detectedAt');
      expect(s.detectedAt).toBeInstanceOf(Date);
    }
    vi.restoreAllMocks();
  });
});

describe('collectGoogleTrends', () => {
  it('returns signals for queries', async () => {
    const signals = await collectGoogleTrends(['j-beauty', 'nail care']);
    expect(signals.length).toBe(2);
    expect(signals[0]!.source).toBe('google_trends');
    expect(signals[0]!.title).toContain('j-beauty');
    expect(signals[1]!.title).toContain('nail care');
  });
});

describe('collectRSSFeeds', () => {
  it('returns empty array (not yet implemented)', async () => {
    const signals = await collectRSSFeeds([{ url: 'https://example.com/feed', source: 'test' }]);
    expect(signals).toEqual([]);
  });
});
