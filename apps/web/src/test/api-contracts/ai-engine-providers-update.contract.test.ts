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

const mockDbReturning = vi.fn().mockResolvedValue([{
  id: 'provider-001',
  providerType: 'openai',
  name: 'OpenAI',
  apiKeyEnvVar: 'AI_ENGINE_OPENAI_API_KEY',
  baseUrl: null,
  capabilities: ['text', 'image'],
  models: [{ name: 'gpt-4o', capability: 'text' }],
  rateLimitRpm: 500,
  dailyBudgetCents: 5000,
  circuitBreakerConfig: { failureThreshold: 5, resetTimeoutMs: 60000, halfOpenMaxCalls: 1 },
  priority: 10,
  isFallback: false,
  isEnabled: true,
  healthStatus: 'healthy',
  lastHealthCheck: null,
  configured: true,
  updatedAt: new Date(),
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
      image: { default: 'openai', model: 'dall-e-3' },
      video: { default: 'mock' },
      tts: { default: 'mock' },
    },
    apiKeys: {
      openai: 'sk-test',
      anthropic: 'sk-ant-test',
      google: undefined,
      elevenlabs: undefined,
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

import { GET, POST } from '@/app/api/admin/ai-engine/config/providers/route';
import { requireAdminApi } from '@/lib/content-studio/auth';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePostRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/admin/ai-engine/config/providers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests — GET /api/admin/ai-engine/config/providers
// ---------------------------------------------------------------------------

describe('GET /api/admin/ai-engine/config/providers — contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@example.com' });
    mockDbOrderBy.mockResolvedValue([]);
  });

  it('returns 401 when auth fails', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    const res = await GET();
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'unauthorized');
  });

  it('returns providers array with status 200', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('providers');
    expect(Array.isArray(json.providers)).toBe(true);
  });

  it('returns default providers when DB is empty', async () => {
    mockDbOrderBy.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.providers.length).toBeGreaterThan(0);
    // Default providers should include openai, anthropic, google, elevenlabs, ollama
    const types = json.providers.map((p: { providerType: string }) => p.providerType);
    expect(types).toContain('openai');
    expect(types).toContain('anthropic');
    expect(types).toContain('google');
    expect(types).toContain('elevenlabs');
    expect(types).toContain('ollama');
  });

  it('each default provider has correct shape', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    for (const provider of json.providers) {
      expect(provider).toHaveProperty('id');
      expect(provider).toHaveProperty('providerType');
      expect(provider).toHaveProperty('name');
      expect(provider).toHaveProperty('apiKeyEnvVar');
      expect(provider).toHaveProperty('capabilities');
      expect(provider).toHaveProperty('models');
      expect(provider).toHaveProperty('priority');
      expect(provider).toHaveProperty('isEnabled');
      expect(provider).toHaveProperty('healthStatus');
      expect(provider).toHaveProperty('configured');
      expect(Array.isArray(provider.capabilities)).toBe(true);
    }
  });

  it('openai provider is configured when API key is set', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    const openai = json.providers.find((p: { providerType: string }) => p.providerType === 'openai');
    expect(openai).toBeDefined();
    expect(openai.configured).toBe(true);
  });

  it('google provider is not configured when API key is undefined', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    const google = json.providers.find((p: { providerType: string }) => p.providerType === 'google');
    expect(google).toBeDefined();
    expect(google.configured).toBe(false);
  });

  it('ollama provider includes default model glm-5.1:cloud', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    const ollama = json.providers.find((p: { providerType: string }) => p.providerType === 'ollama');
    expect(ollama).toBeDefined();
    const modelNames = ollama.models.map((m: { name: string }) => m.name);
    expect(modelNames).toContain('glm-5.1:cloud');
  });

  it('returns DB providers when DB has rows', async () => {
    const now = new Date();
    mockDbOrderBy.mockResolvedValue([
      {
        id: 'db-provider-001',
        providerType: 'openai',
        name: 'OpenAI',
        apiKeyEnvVar: 'AI_ENGINE_OPENAI_API_KEY',
        baseUrl: null,
        capabilities: ['text', 'image'],
        models: [{ name: 'gpt-4o', capability: 'text' }],
        rateLimitRpm: 500,
        dailyBudgetCents: 5000,
        circuitBreakerConfig: { failureThreshold: 5, resetTimeoutMs: 60000, halfOpenMaxCalls: 1 },
        priority: 10,
        isFallback: false,
        isEnabled: true,
        healthStatus: 'healthy',
        lastHealthCheck: now,
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.providers.length).toBe(1);
    expect(json.providers[0].id).toBe('db-provider-001');
    expect(json.providers[0].lastHealthCheck).toBe(now.toISOString());
  });

  it('DB providers include configured field derived from env key map', async () => {
    const now = new Date();
    mockDbOrderBy.mockResolvedValue([
      {
        id: 'db-provider-002',
        providerType: 'anthropic',
        name: 'Anthropic',
        apiKeyEnvVar: 'AI_ENGINE_ANTHROPIC_API_KEY',
        baseUrl: null,
        capabilities: ['text'],
        models: [],
        rateLimitRpm: 100,
        dailyBudgetCents: 3000,
        circuitBreakerConfig: null,
        priority: 20,
        isFallback: true,
        isEnabled: true,
        healthStatus: 'healthy',
        lastHealthCheck: now,
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.providers[0].configured).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Tests — POST /api/admin/ai-engine/config/providers
// ---------------------------------------------------------------------------

describe('POST /api/admin/ai-engine/config/providers — contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@example.com' });
    mockDbReturning.mockResolvedValue([{
      id: 'provider-001',
      providerType: 'openai',
      name: 'OpenAI',
      priority: 5,
      isEnabled: true,
    }]);
  });

  it('returns 401 when auth fails', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    const res = await POST(makePostRequest({ id: 'provider-001', priority: 5 }));
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'unauthorized');
  });

  it('returns 400 when id is missing', async () => {
    const res = await POST(makePostRequest({ priority: 5 }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
    expect(json.details).toBeDefined();
  });

  it('returns 400 when priority is not a number', async () => {
    const res = await POST(makePostRequest({ id: 'provider-001', priority: 'high' }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('returns 400 when priority is not an integer', async () => {
    const res = await POST(makePostRequest({ id: 'provider-001', priority: 3.5 }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('updates provider priority successfully', async () => {
    const res = await POST(makePostRequest({ id: 'provider-001', priority: 5 }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('provider');
  });

  it('updates provider models array', async () => {
    const models = [
      { name: 'gpt-4o', capability: 'text', costPer1MInput: 250, costPer1MOutput: 1000 },
      { name: 'dall-e-3', capability: 'image', costPerUnit: 4000 },
    ];
    const res = await POST(makePostRequest({ id: 'provider-001', models }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('provider');
  });

  it('validates models array items have name and capability', async () => {
    const models = [{ name: '', capability: 'text' }];
    const res = await POST(makePostRequest({ id: 'provider-001', models }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('validates models capability enum', async () => {
    const models = [{ name: 'gpt-4o', capability: 'invalid-capability' }];
    const res = await POST(makePostRequest({ id: 'provider-001', models }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('updates provider baseUrl', async () => {
    const res = await POST(makePostRequest({ id: 'provider-001', baseUrl: 'https://api.openai.com/v1' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('provider');
  });

  it('validates baseUrl is a valid URL', async () => {
    const res = await POST(makePostRequest({ id: 'provider-001', baseUrl: 'not-a-url' }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('accepts baseUrl as null', async () => {
    const res = await POST(makePostRequest({ id: 'provider-001', baseUrl: null }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('provider');
  });

  it('returns 404 when provider not found in DB', async () => {
    mockDbReturning.mockResolvedValue([]);

    const res = await POST(makePostRequest({ id: 'nonexistent', priority: 5 }));
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toBe('Fournisseur introuvable');
  });

  it('validates circuitBreakerConfig shape', async () => {
    const res = await POST(makePostRequest({
      id: 'provider-001',
      circuitBreakerConfig: { failureThreshold: 'bad' },
    }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('accepts valid circuitBreakerConfig', async () => {
    const res = await POST(makePostRequest({
      id: 'provider-001',
      circuitBreakerConfig: { failureThreshold: 3, resetTimeoutMs: 30000, halfOpenMaxCalls: 2 },
    }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('provider');
  });

  it('validates dailyBudgetCents is non-negative', async () => {
    const res = await POST(makePostRequest({ id: 'provider-001', dailyBudgetCents: -100 }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('validates rateLimitRpm is positive', async () => {
    const res = await POST(makePostRequest({ id: 'provider-001', rateLimitRpm: 0 }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });
});
