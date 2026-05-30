import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Shared mock config
// ---------------------------------------------------------------------------

const mockEngineConfig = {
  enabled: true,
  providers: {
    text: { default: 'openai', model: 'gpt-4' },
    image: { default: 'mock', model: 'mock' },
    video: { default: 'mock' },
    tts: { default: 'mock' },
  },
  apiKeys: {
    openai: 'sk-test',
    anthropic: undefined,
    google: undefined,
    elevenlabs: undefined,
    ollamaBaseUrl: undefined,
  },
  budget: { dailyCents: 1000, maxPerJobCents: 200 },
  quality: { threshold: 0.7, humanReviewRequired: false },
  defaults: { tone: 'professional', language: 'fr', maxRetries: 3 },
};

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'test-admin', email: 'test@test.com' }),
  requireContentStudioEnabled: vi.fn(),
}));

vi.mock('@/lib/ai-engine/config', () => ({
  getEngineConfig: vi.fn(() => mockEngineConfig),
}));

// Mock DB to return null (forces defaults)
vi.mock('@/lib/db/client', () => ({
  db: vi.fn(() => null),
}));

vi.mock('@/lib/db/schema-ai-engine', () => ({
  aiEngineWorkflowConfigs: {},
  aiEngineProviderConfigs: {},
  aiEnginePromptTemplates: {},
}));

vi.mock('drizzle-orm', () => ({
  desc: vi.fn(),
  eq: vi.fn(),
}));

vi.mock('@/lib/errors/http-error', async () => {
  const actual = await vi.importActual<typeof import('@/lib/errors/http-error')>('@/lib/errors/http-error');
  return actual;
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET as getWorkflows } from '@/app/api/admin/ai-engine/config/workflows/route';
import { GET as getProviders } from '@/app/api/admin/ai-engine/config/providers/route';
import { GET as getPrompts } from '@/app/api/admin/ai-engine/config/prompts/route';
import { requireAdminApi } from '@/lib/content-studio/auth';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GET /api/admin/ai-engine/config/workflows — contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@test.com' });
  });

  it('returns array of workflows (defaults when DB empty)', async () => {
    const res = await getWorkflows();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('workflows');
    expect(Array.isArray(json.workflows)).toBe(true);
    expect(json.workflows.length).toBeGreaterThan(0);
  });

  it('each workflow has name, qualityThreshold, maxRetries', async () => {
    const res = await getWorkflows();
    const json = await res.json();

    for (const wf of json.workflows) {
      expect(typeof wf.name).toBe('string');
      expect(wf.name.length).toBeGreaterThan(0);
      expect(typeof wf.qualityThreshold).toBe('string');
      expect(typeof wf.maxRetries).toBe('number');
    }
  });
});

describe('GET /api/admin/ai-engine/config/providers — contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@test.com' });
  });

  it('returns array of providers with configured flag', async () => {
    const res = await getProviders();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('providers');
    expect(Array.isArray(json.providers)).toBe(true);
    expect(json.providers.length).toBeGreaterThan(0);
  });

  it('each provider has id, name, capabilities, models fields', async () => {
    const res = await getProviders();
    const json = await res.json();

    for (const p of json.providers) {
      expect(typeof p.id).toBe('string');
      expect(typeof p.name).toBe('string');
      expect(Array.isArray(p.capabilities)).toBe(true);
      expect(p.capabilities.length).toBeGreaterThan(0);
      expect(p).toHaveProperty('models');
      expect(typeof p.configured).toBe('boolean');
    }
  });
});

describe('GET /api/admin/ai-engine/config/prompts — contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@test.com' });
  });

  it('returns array of prompts (defaults when DB empty)', async () => {
    const res = await getPrompts();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('prompts');
    expect(Array.isArray(json.prompts)).toBe(true);
    expect(json.prompts.length).toBeGreaterThan(0);
  });

  it('each prompt has nodeName, systemPrompt, version', async () => {
    const res = await getPrompts();
    const json = await res.json();

    for (const p of json.prompts) {
      expect(typeof p.nodeName).toBe('string');
      expect(p.nodeName.length).toBeGreaterThan(0);
      expect(typeof p.systemPrompt).toBe('string');
      expect(p.systemPrompt.length).toBeGreaterThan(0);
      expect(typeof p.version).toBe('number');
    }
  });
});

describe('Config API endpoints — auth required', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('workflows returns 401 when auth fails', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    const res = await getWorkflows();
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'unauthorized');
  });

  it('providers returns 401 when auth fails', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    const res = await getProviders();
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'unauthorized');
  });
});
