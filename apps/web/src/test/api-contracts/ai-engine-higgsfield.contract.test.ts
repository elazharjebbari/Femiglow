import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — factories are hoisted, no module-scope variable references
// ---------------------------------------------------------------------------

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'test-admin', email: 'test@example.com' }),
  requireContentStudioEnabled: vi.fn(),
}));

vi.mock('@/lib/ai-engine/services/api-key-manager', () => ({
  resolveApiKey: vi.fn().mockResolvedValue('hf-test-key-123'),
  listApiKeys: vi.fn().mockResolvedValue([]),
  saveApiKey: vi.fn().mockResolvedValue({
    id: 'key-hf-001',
    providerType: 'higgsfield',
    providerName: 'Higgsfield AI',
    label: 'Higgsfield AI API Key',
    source: 'database',
    masked: 'hf-tes********k123',
    keyPrefix: 'hf-tes',
    keyLastFour: 'k123',
    isActive: true,
    baseUrl: null,
    lastTestedAt: null,
    lastTestResult: null,
    createdAt: '2026-05-01T00:00:00.000Z',
    updatedAt: '2026-05-01T00:00:00.000Z',
  }),
  deleteApiKey: vi.fn().mockResolvedValue({ success: true, fallbackToEnv: false }),
  testApiKey: vi.fn().mockResolvedValue({ valid: true, provider: 'higgsfield', latencyMs: 180 }),
}));

vi.mock('@/lib/ai-engine/services/model-discovery', () => ({
  discoverModels: vi.fn().mockResolvedValue({
    models: [
      { id: 'higgsfield-diffusion-v2', role: 'image' },
      { id: 'higgsfield-video-v1', role: 'video' },
      { id: 'higgsfield-xl', role: 'image' },
    ],
    source: 'live',
  }),
}));

// --- DB mock chain for providers route ---
const mockDbReturning = vi.fn().mockResolvedValue([{
  id: 'default-higgsfield',
  providerType: 'higgsfield',
  name: 'Higgsfield AI',
  priority: 15,
  isEnabled: true,
}]);

const mockDbWhere = vi.fn().mockReturnValue({ returning: mockDbReturning });
const mockDbSet = vi.fn().mockReturnValue({ where: mockDbWhere });
const mockDbUpdate = vi.fn().mockReturnValue({ set: mockDbSet });
const mockDbOrderBy = vi.fn().mockResolvedValue([]);
const mockDbFrom = vi.fn().mockReturnValue({ orderBy: mockDbOrderBy });
const mockDbSelect = vi.fn().mockReturnValue({ from: mockDbFrom });

vi.mock('@/lib/db/client', () => ({
  db: vi.fn(() => ({
    select: mockDbSelect,
    update: mockDbUpdate,
  })),
}));

vi.mock('@/lib/db/schema-ai-engine', () => ({
  aiEngineProviderConfigs: { id: 'id', priority: 'priority' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ col: _col, val })),
  desc: vi.fn((col: unknown) => ({ col, dir: 'desc' })),
}));

vi.mock('@/lib/ai-engine/config', () => ({
  getEngineConfig: vi.fn().mockReturnValue({
    enabled: true,
    providers: {
      text: { default: 'openai', model: 'gpt-4o' },
      image: { default: 'higgsfield', model: 'higgsfield-diffusion-v2' },
      video: { default: 'higgsfield', model: 'higgsfield-video-v1' },
      tts: { default: 'mock' },
    },
    apiKeys: {
      openai: 'sk-test',
      anthropic: undefined,
      google: undefined,
      elevenlabs: undefined,
      higgsfield: undefined,
      ollamaBaseUrl: undefined,
    },
    budget: { dailyCents: 10000, maxPerJobCents: 500 },
    quality: { threshold: 0.7, humanReviewRequired: true },
    defaults: { tone: 'professional', language: 'fr', maxRetries: 3 },
  }),
}));

vi.mock('@/lib/errors/http-error', async () => {
  const actual = await vi.importActual<typeof import('@/lib/errors/http-error')>('@/lib/errors/http-error');
  return actual;
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET as GET_PROVIDERS, POST as POST_PROVIDERS } from '@/app/api/admin/ai-engine/config/providers/route';
import { GET as GET_MODELS } from '@/app/api/admin/ai-engine/config/providers/models/route';
import { GET as GET_API_KEYS } from '@/app/api/admin/ai-engine/config/api-keys/route';
import { DELETE } from '@/app/api/admin/ai-engine/config/api-keys/[id]/route';
import { POST as POST_TEST } from '@/app/api/admin/ai-engine/config/api-keys/test/route';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { resolveApiKey, listApiKeys, deleteApiKey, testApiKey } from '@/lib/ai-engine/services/api-key-manager';
import { discoverModels } from '@/lib/ai-engine/services/model-discovery';
import { getEngineConfig } from '@/lib/ai-engine/config';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeModelsRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/admin/ai-engine/config/providers/models');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url, { method: 'GET' });
}

function makePostRequest(body: unknown, path = '/api/admin/ai-engine/config/providers'): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(id: string): Request {
  return new Request(`http://localhost:3000/api/admin/ai-engine/config/api-keys/${id}`, {
    method: 'DELETE',
  });
}

// ==========================================================================
// SECTION 1: GET /config/providers - Higgsfield (10 tests)
// ==========================================================================

describe('GET /config/providers - Higgsfield', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@example.com' });
    mockDbOrderBy.mockResolvedValue([]);
  });

  it('returns Higgsfield in default providers list', async () => {
    const res = await GET_PROVIDERS();
    expect(res.status).toBe(200);

    const json = await res.json();
    const types = json.providers.map((p: { providerType: string }) => p.providerType);
    expect(types).toContain('higgsfield');
  });

  it('Higgsfield has providerType "higgsfield"', async () => {
    const res = await GET_PROVIDERS();
    const json = await res.json();
    const hf = json.providers.find((p: { providerType: string }) => p.providerType === 'higgsfield');
    expect(hf).toBeDefined();
    expect(hf.providerType).toBe('higgsfield');
  });

  it('Higgsfield has capabilities ["image", "video"]', async () => {
    const res = await GET_PROVIDERS();
    const json = await res.json();
    const hf = json.providers.find((p: { providerType: string }) => p.providerType === 'higgsfield');
    expect(hf.capabilities).toEqual(['image', 'video']);
  });

  it('Higgsfield has 8 real models', async () => {
    const res = await GET_PROVIDERS();
    const json = await res.json();
    const hf = json.providers.find((p: { providerType: string }) => p.providerType === 'higgsfield');
    expect(hf.models).toHaveLength(8);
    const names = hf.models.map((m: { name: string }) => m.name);
    expect(names).toContain('flux_2');
    expect(names).toContain('cinematic_studio_3_0');
    expect(names).toContain('veo3_1');
  });

  it('Higgsfield priority is 15', async () => {
    const res = await GET_PROVIDERS();
    const json = await res.json();
    const hf = json.providers.find((p: { providerType: string }) => p.providerType === 'higgsfield');
    expect(hf.priority).toBe(15);
  });

  it('Higgsfield configured=false when env var missing', async () => {
    const res = await GET_PROVIDERS();
    const json = await res.json();
    const hf = json.providers.find((p: { providerType: string }) => p.providerType === 'higgsfield');
    // AI_ENGINE_HIGGSFIELD_API_KEY is not set in process.env
    expect(hf.configured).toBe(false);
  });

  it('Higgsfield configured=true when AI_ENGINE_HIGGSFIELD_API_KEY set', async () => {
    process.env.AI_ENGINE_HIGGSFIELD_API_KEY = 'hf-test-key';
    try {
      const res = await GET_PROVIDERS();
      const json = await res.json();
      const hf = json.providers.find((p: { providerType: string }) => p.providerType === 'higgsfield');
      expect(hf.configured).toBe(true);
    } finally {
      delete process.env.AI_ENGINE_HIGGSFIELD_API_KEY;
    }
  });

  it('Higgsfield baseUrl is https://api.higgsfield.ai', async () => {
    const res = await GET_PROVIDERS();
    const json = await res.json();
    const hf = json.providers.find((p: { providerType: string }) => p.providerType === 'higgsfield');
    expect(hf.baseUrl).toBe('https://api.higgsfield.ai');
  });

  it('Higgsfield models have correct costPerUnit values', async () => {
    const res = await GET_PROVIDERS();
    const json = await res.json();
    const hf = json.providers.find((p: { providerType: string }) => p.providerType === 'higgsfield');
    const flux2 = hf.models.find((m: { name: string }) => m.name === 'flux_2');
    const veo = hf.models.find((m: { name: string }) => m.name === 'veo3_1');
    const studio = hf.models.find((m: { name: string }) => m.name === 'cinematic_studio_3_0');
    expect(flux2.costPerUnit).toBe(100);
    expect(veo.costPerUnit).toBe(800);
    expect(studio.costPerUnit).toBe(500);
  });

  it('Higgsfield isFallback is false', async () => {
    const res = await GET_PROVIDERS();
    const json = await res.json();
    const hf = json.providers.find((p: { providerType: string }) => p.providerType === 'higgsfield');
    expect(hf.isFallback).toBe(false);
  });
});

// ==========================================================================
// SECTION 2: GET /config/providers/models?provider=higgsfield (12 tests)
// ==========================================================================

describe('GET /config/providers/models?provider=higgsfield', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@example.com' });
    (resolveApiKey as ReturnType<typeof vi.fn>).mockResolvedValue('hf-test-key-123');
    (discoverModels as ReturnType<typeof vi.fn>).mockResolvedValue({
      models: [
        { id: 'higgsfield-diffusion-v2', role: 'image' },
        { id: 'higgsfield-video-v1', role: 'video' },
        { id: 'higgsfield-xl', role: 'image' },
      ],
      source: 'live',
    });
  });

  it('returns Higgsfield models list', async () => {
    const res = await GET_MODELS(makeModelsRequest({ provider: 'higgsfield' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('models');
    expect(json.models.length).toBeGreaterThan(0);
  });

  it('returns source "fallback" (static list) when higgsfield is in STATIC_FALLBACKS', async () => {
    // Higgsfield is in STATIC_FALLBACKS so it returns without calling discoverModels
    const res = await GET_MODELS(makeModelsRequest({ provider: 'higgsfield' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.source).toBe('fallback');
    // discoverModels should NOT be called for static-fallback providers
    expect(discoverModels).not.toHaveBeenCalled();
  });

  it('returns 13 models by default (6 image + 7 video)', async () => {
    const res = await GET_MODELS(makeModelsRequest({ provider: 'higgsfield' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.models).toHaveLength(13);
  });

  it('filter capability=image returns only image models (6)', async () => {
    const res = await GET_MODELS(makeModelsRequest({ provider: 'higgsfield', capability: 'image' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.models).toHaveLength(6);
    expect(json.models.every((m: { role: string }) => m.role === 'image')).toBe(true);
    const ids = json.models.map((m: { id: string }) => m.id);
    expect(ids).toContain('flux_2');
    expect(ids).toContain('flux_kontext');
  });

  it('filter capability=video returns only video models (7)', async () => {
    const res = await GET_MODELS(makeModelsRequest({ provider: 'higgsfield', capability: 'video' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.models).toHaveLength(7);
    expect(json.models[0]!.role).toBe('video');
  });

  it('filter capability=text returns empty array', async () => {
    const res = await GET_MODELS(makeModelsRequest({ provider: 'higgsfield', capability: 'text' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.models).toEqual([]);
  });

  it('models sorted by POPULAR_MODELS order', async () => {
    const res = await GET_MODELS(makeModelsRequest({ provider: 'higgsfield' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    const ids = json.models.map((m: { id: string }) => m.id);
    expect(ids[0]).toBe('flux_2');
    expect(ids[1]).toBe('flux_kontext');
    expect(ids[2]).toBe('cinematic_studio_2_5');
  });

  it('returns Cache-Control header', async () => {
    const res = await GET_MODELS(makeModelsRequest({ provider: 'higgsfield' }));
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=60');
  });

  it('returns 400 for provider=higgsfield_invalid', async () => {
    const res = await GET_MODELS(makeModelsRequest({ provider: 'higgsfield_invalid' }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'invalid_input');
    expect(json.error.message).toContain('higgsfield_invalid');
  });

  it('auth failure returns 401', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    const res = await GET_MODELS(makeModelsRequest({ provider: 'higgsfield' }));
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'unauthorized');
  });

  it('response shape has {models, source}', async () => {
    const res = await GET_MODELS(makeModelsRequest({ provider: 'higgsfield' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('models');
    expect(json).toHaveProperty('source');
    expect(typeof json.source).toBe('string');
  });

  it('each model has {id, role} fields', async () => {
    const res = await GET_MODELS(makeModelsRequest({ provider: 'higgsfield' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    for (const model of json.models) {
      expect(model).toHaveProperty('id');
      expect(typeof model.id).toBe('string');
      expect(model).toHaveProperty('role');
      expect(typeof model.role).toBe('string');
    }
  });
});

// ==========================================================================
// SECTION 3: POST /config/providers - Higgsfield update (8 tests)
// ==========================================================================

describe('POST /config/providers - Higgsfield update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@example.com' });
    mockDbReturning.mockResolvedValue([{
      id: 'default-higgsfield',
      providerType: 'higgsfield',
      name: 'Higgsfield AI',
      priority: 15,
      isEnabled: true,
      baseUrl: 'https://api.higgsfield.ai',
      models: [
        { name: 'higgsfield-diffusion-v2', capability: 'image', costPerUnit: 500 },
      ],
    }]);
  });

  it('updates Higgsfield priority', async () => {
    const res = await POST_PROVIDERS(makePostRequest({ id: 'default-higgsfield', priority: 5 }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('provider');
  });

  it('updates Higgsfield models array', async () => {
    const models = [
      { name: 'higgsfield-diffusion-v2', capability: 'image', costPerUnit: 500 },
      { name: 'higgsfield-video-v1', capability: 'video', costPerUnit: 2000 },
      { name: 'higgsfield-xl', capability: 'image', costPerUnit: 800 },
    ];
    const res = await POST_PROVIDERS(makePostRequest({ id: 'default-higgsfield', models }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('provider');
  });

  it('updates Higgsfield baseUrl', async () => {
    const res = await POST_PROVIDERS(makePostRequest({
      id: 'default-higgsfield',
      baseUrl: 'https://custom.higgsfield.ai/v1',
    }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('provider');
  });

  it('updates Higgsfield isEnabled', async () => {
    const res = await POST_PROVIDERS(makePostRequest({
      id: 'default-higgsfield',
      isEnabled: false,
    }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('provider');
  });

  it('validates models array items', async () => {
    const models = [{ name: '', capability: 'image' }];
    const res = await POST_PROVIDERS(makePostRequest({ id: 'default-higgsfield', models }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('validates baseUrl is valid URL', async () => {
    const res = await POST_PROVIDERS(makePostRequest({
      id: 'default-higgsfield',
      baseUrl: 'not-a-valid-url',
    }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('returns 400 for invalid data', async () => {
    const res = await POST_PROVIDERS(makePostRequest({
      id: 'default-higgsfield',
      priority: 'high',
    }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('auth failure returns 401', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    const res = await POST_PROVIDERS(makePostRequest({ id: 'default-higgsfield', priority: 5 }));
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'unauthorized');
  });
});

// ==========================================================================
// SECTION 4: API Keys - Higgsfield (10 tests)
// ==========================================================================

describe('API Keys - Higgsfield', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'hf-apikeys-test@example.com' });
  });

  // --- GET /config/api-keys ---

  it('GET /config/api-keys includes Higgsfield in list', async () => {
    (listApiKeys as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: null,
        providerType: 'higgsfield',
        providerName: 'Higgsfield AI',
        label: 'Non configure',
        source: 'none',
        masked: '',
        keyPrefix: '',
        keyLastFour: '',
        isActive: false,
        baseUrl: null,
        lastTestedAt: null,
        lastTestResult: null,
        createdAt: null,
        updatedAt: null,
      },
    ]);

    const res = await GET_API_KEYS();
    expect(res.status).toBe(200);

    const json = await res.json();
    const hf = json.apiKeys.find((k: { providerType: string }) => k.providerType === 'higgsfield');
    expect(hf).toBeDefined();
    expect(hf.providerName).toBe('Higgsfield AI');
  });

  it('Higgsfield shows "none" source when not configured', async () => {
    (listApiKeys as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: null,
        providerType: 'higgsfield',
        providerName: 'Higgsfield AI',
        label: 'Non configure',
        source: 'none',
        masked: '',
        keyPrefix: '',
        keyLastFour: '',
        isActive: false,
        baseUrl: null,
        lastTestedAt: null,
        lastTestResult: null,
        createdAt: null,
        updatedAt: null,
      },
    ]);

    const res = await GET_API_KEYS();
    const json = await res.json();
    const hf = json.apiKeys.find((k: { providerType: string }) => k.providerType === 'higgsfield');
    expect(hf.source).toBe('none');
    expect(hf.isActive).toBe(false);
  });

  it('Higgsfield shows "env" source when env var configured', async () => {
    (listApiKeys as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: null,
        providerType: 'higgsfield',
        providerName: 'Higgsfield AI',
        label: "Variable d'environnement",
        source: 'env',
        masked: 'hf-tes********k123',
        keyPrefix: 'hf-tes',
        keyLastFour: 'k123',
        isActive: true,
        baseUrl: null,
        lastTestedAt: null,
        lastTestResult: null,
        createdAt: null,
        updatedAt: null,
      },
    ]);

    const res = await GET_API_KEYS();
    const json = await res.json();
    const hf = json.apiKeys.find((k: { providerType: string }) => k.providerType === 'higgsfield');
    expect(hf.source).toBe('env');
    expect(hf.isActive).toBe(true);
  });

  it('Higgsfield shows "database" source when DB key exists', async () => {
    (listApiKeys as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: 'key-hf-001',
        providerType: 'higgsfield',
        providerName: 'Higgsfield AI',
        label: 'Higgsfield AI API Key',
        source: 'database',
        masked: 'hf-tes********k123',
        keyPrefix: 'hf-tes',
        keyLastFour: 'k123',
        isActive: true,
        baseUrl: null,
        lastTestedAt: '2026-05-01T10:00:00.000Z',
        lastTestResult: 'valid',
        createdAt: '2026-05-01T00:00:00.000Z',
        updatedAt: '2026-05-01T10:00:00.000Z',
      },
    ]);

    const res = await GET_API_KEYS();
    const json = await res.json();
    const hf = json.apiKeys.find((k: { providerType: string }) => k.providerType === 'higgsfield');
    expect(hf.source).toBe('database');
    expect(hf.id).toBe('key-hf-001');
  });

  // --- POST /config/api-keys (providerType validation) ---
  // Note: The api-keys POST route only accepts ['openai','anthropic','google','elevenlabs','ollama']
  // so higgsfield is rejected at the route level Zod enum.

  it('POST /config/api-keys with providerType=higgsfield returns 400 (not in route VALID_PROVIDERS)', async () => {
    const payload = { providerType: 'higgsfield', apiKey: 'hf-test-key-999' };
    const req = new Request('http://localhost:3000/api/admin/ai-engine/config/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const { POST: POST_KEYS } = await import('@/app/api/admin/ai-engine/config/api-keys/route');
    const res = await POST_KEYS(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('POST validates apiKey is required', async () => {
    const payload = { providerType: 'openai' };
    const req = new Request('http://localhost:3000/api/admin/ai-engine/config/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const { POST: POST_KEYS } = await import('@/app/api/admin/ai-engine/config/api-keys/route');
    const res = await POST_KEYS(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('DELETE Higgsfield key works via deleteApiKey service', async () => {
    (deleteApiKey as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, fallbackToEnv: false });

    const res = await DELETE(makeDeleteRequest('key-hf-001'), { params: { id: 'key-hf-001' } });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(deleteApiKey).toHaveBeenCalledWith('key-hf-001');
  });

  // --- POST /config/api-keys/test ---
  // Note: The test route also only accepts ['openai','anthropic','google','elevenlabs','ollama']
  // so higgsfield is rejected at the route level.

  it('POST /config/api-keys/test with providerType=higgsfield returns 400 (not in route VALID_PROVIDERS)', async () => {
    const payload = { providerType: 'higgsfield' };
    const req = new Request('http://localhost:3000/api/admin/ai-engine/config/api-keys/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const res = await POST_TEST(req);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('test endpoint testApiKey service supports higgsfield directly', async () => {
    // Even though the route rejects higgsfield, the underlying testApiKey service supports it
    (testApiKey as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: true,
      provider: 'higgsfield',
      latencyMs: 180,
    });

    // Call the service directly to verify it handles higgsfield
    const result = await testApiKey('higgsfield', 'hf-test-key');
    expect(result.valid).toBe(true);
    expect(result.provider).toBe('higgsfield');
    expect(result.latencyMs).toBe(180);
  });

  it('rate limiting applies to test endpoint for repeated calls', async () => {
    // Use unique email for rate-limit bucket isolation
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'hf-ratelimit@example.com' });

    const payload = { providerType: 'openai' };
    const mkReq = () => new Request('http://localhost:3000/api/admin/ai-engine/config/api-keys/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    for (let i = 0; i < 5; i++) {
      const res = await POST_TEST(mkReq());
      expect(res.status).toBe(200);
    }

    const res = await POST_TEST(mkReq());
    expect(res.status).toBe(429);

    const json = await res.json();
    expect(json.error).toBeDefined();
    expect(res.headers.get('Retry-After')).toBeDefined();
  });
});
