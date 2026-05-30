import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server, http, HttpResponse } from '@/test/msw/server';

// ARC-004 — interception réseau MSW (host api.higgsfield.ai, GET /v1/models,
// header `Authorization: Bearer <key>`), au lieu de stubber globalThis.fetch.
// server.listen idempotent (cf. test/msw/server.ts).
const HIGGSFIELD_MODELS_URL = 'https://api.higgsfield.ai/v1/models';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockDbSelectResult: unknown[] = [];
const mockDbLimit = vi.fn().mockImplementation(() => Promise.resolve(mockDbSelectResult));
const mockDbWhere = vi.fn().mockReturnValue({ limit: mockDbLimit });
const mockDbFrom = vi.fn().mockReturnValue({ where: mockDbWhere });
const mockDbSelect = vi.fn().mockReturnValue({ from: mockDbFrom });
const mockDbUpdateSet = vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }) });
const mockDbUpdate = vi.fn().mockReturnValue({ set: mockDbUpdateSet });
const mockDbInsertValues = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) });
const mockDbInsert = vi.fn().mockReturnValue({ values: mockDbInsertValues });
const mockDbDeleteWhere = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) });
const mockDbDelete = vi.fn().mockReturnValue({ where: mockDbDeleteWhere });

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(() => ({
    select: mockDbSelect,
    update: mockDbUpdate,
    insert: mockDbInsert,
    delete: mockDbDelete,
  })),
}));

vi.mock('@/lib/db/schema-ai-engine', () => ({
  aiEngineApiKeys: {
    providerType: 'providerType',
    isActive: 'isActive',
    encryptedKey: 'encryptedKey',
    id: 'id',
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ col: _col, val })),
  and: vi.fn((...conds: unknown[]) => ({ conditions: conds })),
  desc: vi.fn((col: unknown) => ({ col, dir: 'desc' })),
}));

const mockEncrypt = vi.fn((v: string) => `encrypted:${v}`);
const mockDecrypt = vi.fn((v: string) => v.replace('encrypted:', ''));
const mockMask = vi.fn((v: string) => ({
  prefix: v.slice(0, 6),
  lastFour: v.slice(-4),
  masked: `${v.slice(0, 6)}********${v.slice(-4)}`,
}));

vi.mock('../encryption-service', () => ({
  getEncryptionService: vi.fn(() => ({
    encrypt: mockEncrypt,
    decrypt: mockDecrypt,
    mask: mockMask,
  })),
  EncryptionService: vi.fn(),
  resetEncryptionService: vi.fn(),
}));

vi.mock('../utils/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// We need to mock the logger used inside model-discovery and api-key-manager
vi.mock('../../utils/logger', () => ({
  createLogger: vi.fn(() => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import {
  resolveApiKey,
  invalidateCache,
  listApiKeys,
} from '../api-key-manager';

import {
  discoverModels,
  invalidateModelCache,
  FALLBACK_MODELS,
  _modelCache,
  MODEL_CACHE_TTL_MS,
  fetchHiggsfield,
  type ModelEntry,
} from '../model-discovery';

import {
  validateApiKey,
} from '../api-key-validator';

// ==========================================================================
// SECTION 1: API Key Resolution Chain - Higgsfield (8 tests)
// ==========================================================================

describe('API Key Resolution Chain - Higgsfield', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateCache();
    // Reset env vars
    delete process.env.AI_ENGINE_HIGGSFIELD_API_KEY;
  });

  it('resolveApiKey("higgsfield") returns DB key when exists', async () => {
    mockDbSelectResult.length = 0;
    mockDbSelectResult.push({ encryptedKey: 'encrypted:hf-db-key-1234' });
    mockDbLimit.mockResolvedValueOnce([{ encryptedKey: 'encrypted:hf-db-key-1234' }]);

    const key = await resolveApiKey('higgsfield');
    expect(key).toBe('hf-db-key-1234');
  });

  it('resolveApiKey("higgsfield") returns env key when no DB row', async () => {
    mockDbLimit.mockResolvedValueOnce([]);
    process.env.AI_ENGINE_HIGGSFIELD_API_KEY = 'hf-env-key-5678';

    const key = await resolveApiKey('higgsfield');
    expect(key).toBe('hf-env-key-5678');

    delete process.env.AI_ENGINE_HIGGSFIELD_API_KEY;
  });

  it('resolveApiKey("higgsfield") returns undefined when neither DB nor env', async () => {
    mockDbLimit.mockResolvedValueOnce([]);
    delete process.env.AI_ENGINE_HIGGSFIELD_API_KEY;

    const key = await resolveApiKey('higgsfield');
    expect(key).toBeUndefined();
  });

  it('resolveApiKey caches result for 5 minutes', async () => {
    mockDbLimit.mockResolvedValue([{ encryptedKey: 'encrypted:hf-cached-key' }]);

    const key1 = await resolveApiKey('higgsfield');
    expect(key1).toBe('hf-cached-key');

    // Second call should use cache (we clear the mock result to prove it)
    mockDbLimit.mockResolvedValue([]);
    const key2 = await resolveApiKey('higgsfield');
    expect(key2).toBe('hf-cached-key');
  });

  it('invalidateCache("higgsfield") clears Higgsfield cache only', async () => {
    // Populate cache for higgsfield and openai
    mockDbLimit.mockResolvedValue([{ encryptedKey: 'encrypted:hf-key' }]);
    await resolveApiKey('higgsfield');

    mockDbLimit.mockResolvedValue([{ encryptedKey: 'encrypted:openai-key' }]);
    await resolveApiKey('openai');

    // Invalidate only higgsfield
    invalidateCache('higgsfield');

    // openai should still be cached
    mockDbLimit.mockResolvedValue([]);
    const openaiKey = await resolveApiKey('openai');
    expect(openaiKey).toBe('openai-key');

    // higgsfield should re-fetch (and get undefined since no DB/env)
    delete process.env.AI_ENGINE_HIGGSFIELD_API_KEY;
    const hfKey = await resolveApiKey('higgsfield');
    expect(hfKey).toBeUndefined();
  });

  it('listApiKeys includes Higgsfield with correct providerName', async () => {
    // Mock listApiKeys DB query chain: select -> from -> where -> rows
    const mockSelectFrom = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    });
    mockDbSelect.mockReturnValue({ from: mockSelectFrom });

    const keys = await listApiKeys();
    const hf = keys.find((k) => k.providerType === 'higgsfield');
    expect(hf).toBeDefined();
    expect(hf!.providerName).toBe('Higgsfield AI');
  });

  it('listApiKeys Higgsfield source="env" when env set', async () => {
    process.env.AI_ENGINE_HIGGSFIELD_API_KEY = 'hf-env-key-9999';

    const mockSelectFrom = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    });
    mockDbSelect.mockReturnValue({ from: mockSelectFrom });

    const keys = await listApiKeys();
    const hf = keys.find((k) => k.providerType === 'higgsfield');
    expect(hf).toBeDefined();
    expect(hf!.source).toBe('env');

    delete process.env.AI_ENGINE_HIGGSFIELD_API_KEY;
  });

  it('listApiKeys Higgsfield source="none" when nothing set', async () => {
    delete process.env.AI_ENGINE_HIGGSFIELD_API_KEY;

    const mockSelectFrom = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    });
    mockDbSelect.mockReturnValue({ from: mockSelectFrom });

    const keys = await listApiKeys();
    const hf = keys.find((k) => k.providerType === 'higgsfield');
    expect(hf).toBeDefined();
    expect(hf!.source).toBe('none');
    expect(hf!.isActive).toBe(false);
  });
});

// ==========================================================================
// SECTION 2: Model Discovery - Higgsfield (10 tests)
// ==========================================================================

describe('Model Discovery - Higgsfield', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    invalidateModelCache();
  });

  it('discoverModels("higgsfield") with apiKey fetches from API', async () => {
    let calls = 0;
    let capturedUrl: string | undefined;
    let capturedAuth: string | null = null;
    server.use(
      http.get(HIGGSFIELD_MODELS_URL, ({ request }) => {
        calls += 1;
        capturedUrl = request.url;
        capturedAuth = request.headers.get('Authorization');
        return HttpResponse.json({
          data: [
            { id: 'higgsfield-diffusion-v2', type: 'image' },
            { id: 'higgsfield-video-v1', type: 'video' },
          ],
        });
      }),
    );

    const result = await discoverModels('higgsfield', { apiKey: 'hf-key' });
    expect(result.source).toBe('live');
    expect(result.models.length).toBeGreaterThanOrEqual(2);
    expect(calls).toBe(1);
    expect(capturedUrl).toBe('https://api.higgsfield.ai/v1/models');
    expect(capturedAuth).toBe('Bearer hf-key');
  });

  it('discoverModels("higgsfield") without apiKey returns fallback', async () => {
    let calls = 0;
    server.use(
      http.get(HIGGSFIELD_MODELS_URL, () => {
        calls += 1;
        return HttpResponse.json({ data: [] });
      }),
    );

    const result = await discoverModels('higgsfield', {});
    expect(result.source).toBe('fallback');
    expect(result.models).toEqual(FALLBACK_MODELS.higgsfield);
    expect(calls).toBe(0);
  });

  it('discoverModels("higgsfield") merges live + fallback', async () => {
    server.use(
      http.get(HIGGSFIELD_MODELS_URL, () =>
        HttpResponse.json({
          data: [{ id: 'higgsfield-new-model', type: 'image' }],
        }),
      ),
    );

    const result = await discoverModels('higgsfield', { apiKey: 'hf-key' });
    expect(result.source).toBe('live');
    const ids = result.models.map((m: ModelEntry) => m.id);
    expect(ids).toContain('higgsfield-new-model');
    expect(ids).toContain('flux_2');
    expect(ids).toContain('cinematic_studio_3_0');
  });

  it('discoverModels("higgsfield") caches result', async () => {
    let calls = 0;
    server.use(
      http.get(HIGGSFIELD_MODELS_URL, () => {
        calls += 1;
        return HttpResponse.json({ data: [{ id: 'higgsfield-diffusion-v2' }] });
      }),
    );

    await discoverModels('higgsfield', { apiKey: 'hf-key' });
    expect(calls).toBe(1);

    // Cache should be populated
    expect(_modelCache.has('higgsfield')).toBe(true);
  });

  it('cache hit on second call', async () => {
    let calls = 0;
    server.use(
      http.get(HIGGSFIELD_MODELS_URL, () => {
        calls += 1;
        return HttpResponse.json({ data: [{ id: 'higgsfield-diffusion-v2' }] });
      }),
    );

    const result1 = await discoverModels('higgsfield', { apiKey: 'hf-key' });
    expect(result1.source).toBe('live');
    expect(calls).toBe(1);

    // Second call should return cached
    const result2 = await discoverModels('higgsfield', { apiKey: 'hf-key' });
    expect(result2.source).toBe('cache');
    expect(calls).toBe(1); // still only 1
  });

  it('cache expired triggers re-fetch', async () => {
    let calls = 0;
    server.use(
      http.get(HIGGSFIELD_MODELS_URL, () => {
        calls += 1;
        return HttpResponse.json({ data: [{ id: 'higgsfield-diffusion-v2' }] });
      }),
    );

    await discoverModels('higgsfield', { apiKey: 'hf-key' });
    expect(calls).toBe(1);

    // Manually expire the cache entry
    const entry = _modelCache.get('higgsfield');
    if (entry) {
      entry.expiresAt = Date.now() - 1;
    }

    await discoverModels('higgsfield', { apiKey: 'hf-key' });
    expect(calls).toBe(2);
  });

  it('invalidateModelCache("higgsfield") clears cache', async () => {
    server.use(
      http.get(HIGGSFIELD_MODELS_URL, () =>
        HttpResponse.json({ data: [{ id: 'higgsfield-diffusion-v2' }] }),
      ),
    );

    await discoverModels('higgsfield', { apiKey: 'hf-key' });
    expect(_modelCache.has('higgsfield')).toBe(true);

    invalidateModelCache('higgsfield');
    expect(_modelCache.has('higgsfield')).toBe(false);
  });

  it('fetch error returns fallback', async () => {
    server.use(http.get(HIGGSFIELD_MODELS_URL, () => HttpResponse.error()));

    const result = await discoverModels('higgsfield', { apiKey: 'hf-key' });
    expect(result.source).toBe('fallback');
    expect(result.models).toEqual(FALLBACK_MODELS.higgsfield);
  });

  it('fetch timeout returns fallback', async () => {
    // Équivalent MSW d'un échec réseau/abort : la branche catch du fetcher
    // retombe sur le fallback, quelle que soit la nature de l'erreur.
    server.use(http.get(HIGGSFIELD_MODELS_URL, () => HttpResponse.error()));

    const result = await discoverModels('higgsfield', { apiKey: 'hf-key' });
    expect(result.source).toBe('fallback');
    expect(result.models).toEqual(FALLBACK_MODELS.higgsfield);
  });

  it('FALLBACK_MODELS.higgsfield has real models with correct roles', () => {
    const models = FALLBACK_MODELS.higgsfield;
    expect(models.length).toBeGreaterThanOrEqual(15);

    const flux2 = models.find((m) => m.id === 'flux_2');
    expect(flux2).toBeDefined();
    expect(flux2!.role).toBe('image');

    const veo = models.find((m) => m.id === 'veo3_1');
    expect(veo).toBeDefined();
    expect(veo!.role).toBe('video');

    const studio = models.find((m) => m.id === 'cinematic_studio_3_0');
    expect(studio).toBeDefined();
    expect(studio!.role).toBe('video');
  });
});

// ==========================================================================
// SECTION 3: Key Validation - Higgsfield (7 tests)
// ==========================================================================

describe('Key Validation - Higgsfield', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validateApiKey("higgsfield", "valid-key") returns valid:true on 200', async () => {
    let capturedUrl: string | undefined;
    let capturedAuth: string | null = null;
    server.use(
      http.get(HIGGSFIELD_MODELS_URL, ({ request }) => {
        capturedUrl = request.url;
        capturedAuth = request.headers.get('Authorization');
        return new HttpResponse(null, { status: 200 });
      }),
    );

    const result = await validateApiKey('higgsfield', 'valid-key');
    expect(result.valid).toBe(true);
    expect(result.provider).toBe('higgsfield');
    expect(capturedUrl).toBe('https://api.higgsfield.ai/v1/models');
    expect(capturedAuth).toBe('Bearer valid-key');
  });

  it('validateApiKey("higgsfield", "valid-key") returns valid:true on 429 (rate limited = key valid)', async () => {
    server.use(
      http.get(HIGGSFIELD_MODELS_URL, () => new HttpResponse(null, { status: 429 })),
    );

    const result = await validateApiKey('higgsfield', 'valid-key');
    expect(result.valid).toBe(true);
    expect(result.provider).toBe('higgsfield');
  });

  it('validateApiKey("higgsfield", "bad-key") returns valid:false on 401', async () => {
    server.use(
      http.get(HIGGSFIELD_MODELS_URL, () => new HttpResponse(null, { status: 401 })),
    );

    const result = await validateApiKey('higgsfield', 'bad-key');
    expect(result.valid).toBe(false);
    expect(result.provider).toBe('higgsfield');
    expect(result.error).toContain('401');
  });

  it('validateApiKey("higgsfield", "bad-key") returns valid:false on 403', async () => {
    server.use(
      http.get(HIGGSFIELD_MODELS_URL, () => new HttpResponse(null, { status: 403 })),
    );

    const result = await validateApiKey('higgsfield', 'bad-key');
    expect(result.valid).toBe(false);
    expect(result.provider).toBe('higgsfield');
    expect(result.error).toContain('403');
  });

  it('validateApiKey returns error message on 500', async () => {
    server.use(
      http.get(HIGGSFIELD_MODELS_URL, () => new HttpResponse(null, { status: 500 })),
    );

    const result = await validateApiKey('higgsfield', 'some-key');
    expect(result.valid).toBe(false);
    expect(result.provider).toBe('higgsfield');
    expect(result.error).toContain('500');
  });

  it('timeout returns valid:false with error', async () => {
    // Échec réseau (équivalent MSW d'un abort/timeout) : la branche catch de
    // validateApiKey renvoie valid:false avec un message d'erreur.
    server.use(http.get(HIGGSFIELD_MODELS_URL, () => HttpResponse.error()));

    const result = await validateApiKey('higgsfield', 'some-key');
    expect(result.valid).toBe(false);
    expect(result.provider).toBe('higgsfield');
    expect(result.error).toBeDefined();
  });

  it('latencyMs is always positive', async () => {
    server.use(
      http.get(HIGGSFIELD_MODELS_URL, () => new HttpResponse(null, { status: 200 })),
    );

    const result = await validateApiKey('higgsfield', 'valid-key');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(typeof result.latencyMs).toBe('number');
  });
});
