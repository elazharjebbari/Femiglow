import { describe, expect, it, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { server, http, HttpResponse } from '@/test/msw/server';

import {
  type DiscoverableProvider,
  type ModelEntry,
  FALLBACK_MODELS,
  MODEL_CACHE_TTL_MS,
  _modelCache,
  dedupeMerge,
  discoverModels,
  fetchOllama,
  fetchOpenAI,
  inferRole,
  invalidateModelCache,
} from './model-discovery';

// ---------------------------------------------------------------------------
// Mocks (module mock — NOT fetch)
// ---------------------------------------------------------------------------

vi.mock('../utils/logger', () => ({
  createLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// ---------------------------------------------------------------------------
// Endpoints (ARC-004 — interception réseau MSW au lieu de stubber globalThis.fetch)
// ---------------------------------------------------------------------------

const OPENAI_MODELS_URL = 'https://api.openai.com/v1/models';
const DEEPSEEK_MODELS_URL = 'https://api.deepseek.com/v1/models';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  _modelCache.clear();
});

afterEach(() => {
  _modelCache.clear();
});

// ===========================================================================
// inferRole
// ===========================================================================

describe('inferRole', () => {
  it('returns "embedding" for ids containing "embed"', () => {
    expect(inferRole('text-embedding-3-small')).toBe('embedding');
    expect(inferRole('mistral-embed')).toBe('embedding');
    expect(inferRole('nomic-embed-text')).toBe('embedding');
  });

  it('returns "embedding" for ids containing "embedding" (case-insensitive)', () => {
    expect(inferRole('Embedding-v3')).toBe('embedding');
    expect(inferRole('TEXT-EMBEDDING-004')).toBe('embedding');
  });

  it('returns "chat" for non-embedding ids', () => {
    expect(inferRole('gpt-4o')).toBe('chat');
    expect(inferRole('claude-3-5-sonnet-latest')).toBe('chat');
    expect(inferRole('llama3.2')).toBe('chat');
    expect(inferRole('deepseek-chat')).toBe('chat');
  });
});

// ===========================================================================
// dedupeMerge
// ===========================================================================

describe('dedupeMerge', () => {
  it('deduplicates by id, primary wins', () => {
    const primary: ModelEntry[] = [
      { id: 'gpt-4o', role: 'chat' },
      { id: 'gpt-4o-mini', role: 'chat' },
    ];
    const fallback: ModelEntry[] = [
      { id: 'gpt-4o', role: 'embedding' }, // should be ignored (dup)
      { id: 'o1', role: 'chat' },
    ];
    const result = dedupeMerge(primary, fallback);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ id: 'gpt-4o', role: 'chat' }); // primary wins
    expect(result[2]).toEqual({ id: 'o1', role: 'chat' });
  });

  it('preserves insertion order', () => {
    const primary: ModelEntry[] = [
      { id: 'b', role: 'chat' },
      { id: 'a', role: 'chat' },
    ];
    const fallback: ModelEntry[] = [
      { id: 'c', role: 'chat' },
    ];
    const ids = dedupeMerge(primary, fallback).map((m) => m.id);
    expect(ids).toEqual(['b', 'a', 'c']);
  });

  it('handles empty arrays', () => {
    expect(dedupeMerge([], [])).toEqual([]);
    const single: ModelEntry[] = [{ id: 'x', role: 'chat' }];
    expect(dedupeMerge(single, [])).toEqual(single);
    expect(dedupeMerge([], single)).toEqual(single);
  });
});

// ===========================================================================
// fetchOpenAI
// ===========================================================================

describe('fetchOpenAI', () => {
  it('sends correct URL and Authorization header', async () => {
    let capturedUrl = '';
    let capturedAuth: string | null = null;
    let callCount = 0;
    server.use(
      http.get(OPENAI_MODELS_URL, ({ request }) => {
        callCount += 1;
        capturedUrl = request.url;
        capturedAuth = request.headers.get('Authorization');
        return HttpResponse.json({ data: [{ id: 'gpt-4o' }] });
      }),
    );

    await fetchOpenAI('sk-test');

    expect(callCount).toBe(1);
    expect(capturedUrl).toBe('https://api.openai.com/v1/models');
    expect(capturedAuth).toBe('Bearer sk-test');
  });

  it('uses custom apiBase when provided', async () => {
    let capturedUrl = '';
    server.use(
      http.get('https://my-proxy.example.com/v1/models', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ data: [{ id: 'gpt-4o' }] });
      }),
    );

    await fetchOpenAI('sk-test', 'https://my-proxy.example.com/v1/');

    expect(capturedUrl).toBe('https://my-proxy.example.com/v1/models');
  });

  it('maps models with inferRole', async () => {
    server.use(
      http.get(OPENAI_MODELS_URL, () =>
        HttpResponse.json({
          data: [
            { id: 'gpt-4o' },
            { id: 'text-embedding-3-small' },
          ],
        }),
      ),
    );

    const result = await fetchOpenAI('sk-test');
    expect(result).toEqual([
      { id: 'gpt-4o', role: 'chat' },
      { id: 'text-embedding-3-small', role: 'embedding' },
    ]);
  });

  it('throws on non-ok response', async () => {
    server.use(
      http.get(OPENAI_MODELS_URL, () => new HttpResponse(null, { status: 401 })),
    );
    await expect(fetchOpenAI('bad-key')).rejects.toThrow('openai 401');
  });
});

// ===========================================================================
// fetchOllama
// ===========================================================================

describe('fetchOllama', () => {
  it('calls /api/tags on the provided base', async () => {
    let capturedUrl = '';
    server.use(
      http.get('http://localhost:11434/api/tags', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ models: [{ name: 'llama3.2' }] });
      }),
    );

    await fetchOllama('http://localhost:11434');

    expect(capturedUrl).toBe('http://localhost:11434/api/tags');
  });

  it('strips trailing slash from apiBase', async () => {
    let capturedUrl = '';
    server.use(
      http.get('http://ollama.local:11434/api/tags', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ models: [] });
      }),
    );

    await fetchOllama('http://ollama.local:11434/');

    expect(capturedUrl).toBe('http://ollama.local:11434/api/tags');
  });

  it('sends no Authorization header when authToken is undefined', async () => {
    let capturedAuth: string | null = null;
    server.use(
      http.get('http://localhost:11434/api/tags', ({ request }) => {
        capturedAuth = request.headers.get('Authorization');
        return HttpResponse.json({ models: [] });
      }),
    );

    await fetchOllama('http://localhost:11434');

    expect(capturedAuth).toBeNull();
  });

  it('sends Bearer header when authToken is a non-URL string', async () => {
    let capturedAuth: string | null = null;
    server.use(
      http.get('http://localhost:11434/api/tags', ({ request }) => {
        capturedAuth = request.headers.get('Authorization');
        return HttpResponse.json({ models: [] });
      }),
    );

    await fetchOllama('http://localhost:11434', 'my-secret-token');

    expect(capturedAuth).toBe('Bearer my-secret-token');
  });

  it('does NOT send Bearer header when authToken starts with "http"', async () => {
    let capturedAuth: string | null = null;
    server.use(
      http.get('http://localhost:11434/api/tags', ({ request }) => {
        capturedAuth = request.headers.get('Authorization');
        return HttpResponse.json({ models: [] });
      }),
    );

    await fetchOllama('http://localhost:11434', 'http://some-url');

    expect(capturedAuth).toBeNull();
  });

  it('maps model names with inferRole', async () => {
    server.use(
      http.get('http://localhost:11434/api/tags', () =>
        HttpResponse.json({
          models: [
            { name: 'llama3.2' },
            { name: 'nomic-embed-text' },
          ],
        }),
      ),
    );

    const result = await fetchOllama('http://localhost:11434');
    expect(result).toEqual([
      { id: 'llama3.2', role: 'chat' },
      { id: 'nomic-embed-text', role: 'embedding' },
    ]);
  });
});

// ===========================================================================
// discoverModels
// ===========================================================================

describe('discoverModels', () => {
  it('returns live models merged with fallback on successful fetch', async () => {
    server.use(
      http.get(OPENAI_MODELS_URL, () =>
        HttpResponse.json({
          data: [
            { id: 'gpt-4o' },
            { id: 'gpt-4o-mini' },
            { id: 'custom-model' },
          ],
        }),
      ),
    );

    const result = await discoverModels('openai', { apiKey: 'sk-test' });
    expect(result.source).toBe('live');
    // Should include the 3 live models + any fallback models not yet seen
    const ids = result.models.map((m) => m.id);
    expect(ids).toContain('gpt-4o');
    expect(ids).toContain('custom-model');
    // Fallback models that weren't in the live list should be appended
    const fallbackIds = (FALLBACK_MODELS['openai'] ?? []).map((m) => m.id);
    for (const fid of fallbackIds) {
      expect(ids).toContain(fid);
    }
  });

  it('returns fallback models when apiKey is missing', async () => {
    const result = await discoverModels('openai', {});
    expect(result.source).toBe('fallback');
    expect(result.models).toEqual(FALLBACK_MODELS['openai']);
  });

  it('returns fallback models when fetch throws', async () => {
    server.use(
      http.get(OPENAI_MODELS_URL, () => HttpResponse.error()),
    );

    const result = await discoverModels('openai', { apiKey: 'sk-test' });
    expect(result.source).toBe('fallback');
    expect(result.models).toEqual(FALLBACK_MODELS['openai']);
  });

  it('returns fallback for providers without live fetchers (qwen, zhipu, azure-openai)', async () => {
    for (const provider of ['qwen', 'zhipu', 'azure-openai'] as DiscoverableProvider[]) {
      const result = await discoverModels(provider, { apiKey: 'sk-test' });
      expect(result.source).toBe('fallback');
      expect(result.models).toEqual(FALLBACK_MODELS[provider]);
    }
  });

  // -------------------------------------------------------------------------
  // Caching
  // -------------------------------------------------------------------------

  it('returns cached result on second call', async () => {
    let callCount = 0;
    server.use(
      http.get(OPENAI_MODELS_URL, () => {
        callCount += 1;
        return HttpResponse.json({ data: [{ id: 'gpt-4o' }] });
      }),
    );

    const first = await discoverModels('openai', { apiKey: 'sk-test' });
    expect(first.source).toBe('live');
    expect(callCount).toBe(1);

    const second = await discoverModels('openai', { apiKey: 'sk-test' });
    expect(second.source).toBe('cache');
    // fetch should NOT have been called again
    expect(callCount).toBe(1);
    expect(second.models).toEqual(first.models);
  });

  it('re-fetches after cache expires', async () => {
    let callCount = 0;
    server.use(
      http.get(OPENAI_MODELS_URL, () => {
        callCount += 1;
        // First call returns 1 model, subsequent calls return 2.
        const data =
          callCount === 1
            ? [{ id: 'gpt-4o' }]
            : [{ id: 'gpt-4o' }, { id: 'gpt-4.1' }];
        return HttpResponse.json({ data });
      }),
    );

    await discoverModels('openai', { apiKey: 'sk-test' });
    expect(callCount).toBe(1);

    // Manually expire the cache entry
    const entry = _modelCache.get('openai');
    if (entry) {
      entry.expiresAt = Date.now() - 1;
    }

    const result = await discoverModels('openai', { apiKey: 'sk-test' });
    expect(result.source).toBe('live');
    expect(callCount).toBe(2);
  });

  it('different providers have independent caches', async () => {
    let openaiCalls = 0;
    let deepseekCalls = 0;
    server.use(
      http.get(OPENAI_MODELS_URL, () => {
        openaiCalls += 1;
        return HttpResponse.json({ data: [{ id: 'gpt-4o' }] });
      }),
      http.get(DEEPSEEK_MODELS_URL, () => {
        deepseekCalls += 1;
        return HttpResponse.json({ data: [{ id: 'deepseek-chat' }] });
      }),
    );

    await discoverModels('openai', { apiKey: 'sk-openai' });
    await discoverModels('deepseek', { apiKey: 'sk-deepseek' });

    expect(openaiCalls).toBe(1);
    expect(deepseekCalls).toBe(1);

    // Both should now be cached
    const openai = await discoverModels('openai', { apiKey: 'sk-openai' });
    const deepseek = await discoverModels('deepseek', { apiKey: 'sk-deepseek' });
    expect(openai.source).toBe('cache');
    expect(deepseek.source).toBe('cache');
    expect(openaiCalls).toBe(1); // no new calls
    expect(deepseekCalls).toBe(1);
  });
});

// ===========================================================================
// invalidateModelCache
// ===========================================================================

describe('invalidateModelCache', () => {
  let openaiCalls = 0;
  let deepseekCalls = 0;

  beforeEach(async () => {
    openaiCalls = 0;
    deepseekCalls = 0;
    server.use(
      http.get(OPENAI_MODELS_URL, () => {
        openaiCalls += 1;
        return HttpResponse.json({ data: [{ id: 'gpt-4o' }] });
      }),
      http.get(DEEPSEEK_MODELS_URL, () => {
        deepseekCalls += 1;
        return HttpResponse.json({ data: [{ id: 'deepseek-chat' }] });
      }),
    );

    // Populate cache for two providers
    await discoverModels('openai', { apiKey: 'sk-openai' });
    await discoverModels('deepseek', { apiKey: 'sk-deepseek' });
    // Reset counters so the test body asserts only its own fetches.
    openaiCalls = 0;
    deepseekCalls = 0;
  });

  it('clears only the specified provider', async () => {
    invalidateModelCache('openai');

    // OpenAI should re-fetch
    const openai = await discoverModels('openai', { apiKey: 'sk-openai' });
    expect(openai.source).toBe('live');
    expect(openaiCalls).toBe(1);

    // Deepseek should still be cached
    const deepseek = await discoverModels('deepseek', { apiKey: 'sk-deepseek' });
    expect(deepseek.source).toBe('cache');
    expect(deepseekCalls).toBe(0);
  });

  it('clears all providers when called without argument', async () => {
    invalidateModelCache();

    const openai = await discoverModels('openai', { apiKey: 'sk-openai' });
    const deepseek = await discoverModels('deepseek', { apiKey: 'sk-deepseek' });

    expect(openai.source).toBe('live');
    expect(deepseek.source).toBe('live');
    expect(openaiCalls).toBe(1);
    expect(deepseekCalls).toBe(1);
  });
});

// ===========================================================================
// FALLBACK_MODELS
// ===========================================================================

describe('FALLBACK_MODELS', () => {
  it('ollama fallback starts with glm-5.1:cloud', () => {
    const ollamaFallback = FALLBACK_MODELS['ollama'];
    expect(ollamaFallback?.[0]).toEqual({ id: 'glm-5.1:cloud', role: 'chat' });
  });

  it('has entries for all 9 providers', () => {
    const providers: DiscoverableProvider[] = [
      'openai', 'anthropic', 'mistral', 'gemini', 'qwen',
      'deepseek', 'zhipu', 'azure-openai', 'ollama',
    ];
    for (const p of providers) {
      expect(FALLBACK_MODELS[p]).toBeDefined();
      expect(FALLBACK_MODELS[p]?.length).toBeGreaterThan(0);
    }
  });
});

// ===========================================================================
// MODEL_CACHE_TTL_MS
// ===========================================================================

describe('MODEL_CACHE_TTL_MS', () => {
  it('equals 5 minutes in ms', () => {
    expect(MODEL_CACHE_TTL_MS).toBe(300_000);
  });
});
