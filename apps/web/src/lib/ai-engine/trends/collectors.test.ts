import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { server, http, HttpResponse } from '@/test/msw/server';

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
} from './collectors';

// ARC-004 — l'API Reddit est interceptée par MSW (au lieu de vi.spyOn(fetch)).
const REDDIT_RE = /reddit\.com\/r\//;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function redditResponse(children: Array<{ data: Record<string, unknown> }>) {
  return HttpResponse.json({ data: { children } });
}

describe('collectSeasonalSignals', () => {
  it('returns signals for current month', async () => {
    const signals = await collectSeasonalSignals();
    expect(Array.isArray(signals)).toBe(true);
    expect(signals.length).toBeGreaterThan(0);
  });

  it('includes year-round trends', async () => {
    const signals = await collectSeasonalSignals();
    const evergreenSources = signals.filter((s) => s.source === 'evergreen');
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
  it('calls Reddit API', async () => {
    let capturedUrl = '';
    server.use(
      http.get(REDDIT_RE, ({ request }) => {
        capturedUrl = request.url;
        return redditResponse([
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
        ]);
      }),
    );

    await collectRedditSignals(['SkincareAddiction']);
    expect(capturedUrl).toContain('reddit.com/r/SkincareAddiction');
  });

  it('filters beauty-related posts', async () => {
    server.use(
      http.get(REDDIT_RE, () =>
        redditResponse([
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
        ]),
      ),
    );

    const signals = await collectRedditSignals(['test']);
    expect(signals.length).toBe(1);
    expect(signals[0]!.title).toContain('nail care');
  });

  it('handles fetch error gracefully', async () => {
    server.use(http.get(REDDIT_RE, () => HttpResponse.error()));
    const signals = await collectRedditSignals(['SkincareAddiction']);
    expect(signals).toEqual([]);
  });

  it('each Reddit signal has required fields', async () => {
    server.use(
      http.get(REDDIT_RE, () =>
        redditResponse([
          {
            data: {
              title: 'Japanese beauty oil routine',
              selftext: 'Camellia oil is great for skin care',
              url: 'https://reddit.com/r/AsianBeauty/1',
              score: 300,
              created_utc: Date.now() / 1000,
            },
          },
        ]),
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
