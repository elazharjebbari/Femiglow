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
  resolveApiKey: vi.fn().mockResolvedValue('sk-test-key'),
}));

vi.mock('@/lib/ai-engine/services/model-discovery', () => ({
  discoverModels: vi.fn().mockResolvedValue({
    models: [
      { id: 'gpt-4o', role: 'chat' },
      { id: 'gpt-4o-mini', role: 'chat' },
      { id: 'text-embedding-3-small', role: 'embedding' },
    ],
    source: 'live',
  }),
}));

vi.mock('@/lib/errors/http-error', async () => {
  const actual = await vi.importActual<typeof import('@/lib/errors/http-error')>('@/lib/errors/http-error');
  return actual;
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET } from '@/app/api/admin/ai-engine/config/providers/models/route';
import { requireAdminApi } from '@/lib/content-studio/auth';
import { resolveApiKey } from '@/lib/ai-engine/services/api-key-manager';
import { discoverModels } from '@/lib/ai-engine/services/model-discovery';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost:3000/api/admin/ai-engine/config/providers/models');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url, { method: 'GET' });
}

// ---------------------------------------------------------------------------
// Tests — GET /api/admin/ai-engine/config/providers/models
// ---------------------------------------------------------------------------

describe('GET /api/admin/ai-engine/config/providers/models — contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@example.com' });
    (resolveApiKey as ReturnType<typeof vi.fn>).mockResolvedValue('sk-test-key');
    (discoverModels as ReturnType<typeof vi.fn>).mockResolvedValue({
      models: [
        { id: 'gpt-4o', role: 'chat' },
        { id: 'gpt-4o-mini', role: 'chat' },
        { id: 'text-embedding-3-small', role: 'embedding' },
      ],
      source: 'live',
    });
  });

  // ---- Validation ----

  it('returns 400 when provider param is missing', async () => {
    const res = await GET(makeGetRequest());
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'invalid_input');
    expect(json.error.message).toContain('provider');
  });

  it('returns 400 when provider param is invalid', async () => {
    const res = await GET(makeGetRequest({ provider: 'invalid-provider' }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'invalid_input');
    expect(json.error.message).toContain('invalid-provider');
  });

  it('returns 400 for empty provider param', async () => {
    const res = await GET(makeGetRequest({ provider: '' }));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'invalid_input');
  });

  // ---- Auth ----

  it('returns 401 when auth fails', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    const res = await GET(makeGetRequest({ provider: 'openai' }));
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'unauthorized');
  });

  // ---- OpenAI provider ----

  it('returns models for openai provider', async () => {
    const res = await GET(makeGetRequest({ provider: 'openai' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('models');
    expect(Array.isArray(json.models)).toBe(true);
    expect(json.models.length).toBeGreaterThan(0);
    expect(discoverModels).toHaveBeenCalledWith('openai', { apiKey: 'sk-test-key' });
  });

  it('returns source field from discovery result', async () => {
    const res = await GET(makeGetRequest({ provider: 'openai' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('source', 'live');
  });

  it('returns Cache-Control header', async () => {
    const res = await GET(makeGetRequest({ provider: 'openai' }));
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=60');
  });

  // ---- Anthropic provider ----

  it('returns models for anthropic provider', async () => {
    (discoverModels as ReturnType<typeof vi.fn>).mockResolvedValue({
      models: [
        { id: 'claude-sonnet-4-20250514', role: 'chat' },
        { id: 'claude-haiku-4-20250514', role: 'chat' },
      ],
      source: 'live',
    });

    const res = await GET(makeGetRequest({ provider: 'anthropic' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.models.length).toBe(2);
    expect(discoverModels).toHaveBeenCalledWith('anthropic', { apiKey: 'sk-test-key' });
  });

  // ---- Google (maps to gemini) ----

  it('returns models for google provider (maps to gemini discovery)', async () => {
    (discoverModels as ReturnType<typeof vi.fn>).mockResolvedValue({
      models: [
        { id: 'gemini-2.5-flash', role: 'chat' },
        { id: 'gemini-2.5-pro', role: 'chat' },
      ],
      source: 'cache',
    });

    const res = await GET(makeGetRequest({ provider: 'google' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.models.length).toBe(2);
    expect(json.source).toBe('cache');
    expect(discoverModels).toHaveBeenCalledWith('gemini', { apiKey: 'sk-test-key' });
  });

  // ---- Ollama (passes authToken and apiBase) ----

  it('returns models for ollama provider with authToken and apiBase', async () => {
    (discoverModels as ReturnType<typeof vi.fn>).mockResolvedValue({
      models: [
        { id: 'llama3.1:8b', role: 'chat' },
        { id: 'mistral', role: 'chat' },
      ],
      source: 'live',
    });

    const res = await GET(makeGetRequest({ provider: 'ollama' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.models.length).toBe(2);
    expect(discoverModels).toHaveBeenCalledWith('ollama', {
      apiBase: expect.any(String),
      authToken: 'sk-test-key',
    });
  });

  it('ollama resolves base URL from env (default fallback)', async () => {
    (discoverModels as ReturnType<typeof vi.fn>).mockResolvedValue({
      models: [],
      source: 'fallback',
    });

    const res = await GET(makeGetRequest({ provider: 'ollama' }));
    expect(res.status).toBe(200);

    // Verify the apiBase was passed (it falls back to http://localhost:11434)
    expect(discoverModels).toHaveBeenCalledWith('ollama', expect.objectContaining({
      apiBase: expect.any(String),
    }));
  });

  // ---- Static fallback providers ----

  it('returns fallback models for elevenlabs (static list)', async () => {
    const res = await GET(makeGetRequest({ provider: 'elevenlabs' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('source', 'fallback');
    expect(json.models.length).toBeGreaterThan(0);
    expect(json.models.every((m: { id: string; role: string }) => m.role === 'tts')).toBe(true);
    // Should NOT call discoverModels for static-fallback providers
    expect(discoverModels).not.toHaveBeenCalled();
  });

  it('returns fallback models for stability (static list)', async () => {
    const res = await GET(makeGetRequest({ provider: 'stability' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('source', 'fallback');
    expect(json.models.length).toBeGreaterThan(0);
    expect(json.models.every((m: { id: string; role: string }) => m.role === 'image')).toBe(true);
    expect(discoverModels).not.toHaveBeenCalled();
  });

  it('returns fallback models for runway (static list)', async () => {
    const res = await GET(makeGetRequest({ provider: 'runway' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('source', 'fallback');
    expect(json.models.length).toBeGreaterThan(0);
    expect(discoverModels).not.toHaveBeenCalled();
  });

  // ---- Capability filtering ----

  it('filters by capability=text (maps to chat role)', async () => {
    const res = await GET(makeGetRequest({ provider: 'openai', capability: 'text' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    // Only chat-role models should be returned (embedding excluded)
    expect(json.models.every((m: { id: string; role: string }) => m.role === 'chat')).toBe(true);
    expect(json.models.some((m: { id: string }) => m.id === 'text-embedding-3-small')).toBe(false);
  });

  it('filters by capability=embedding', async () => {
    const res = await GET(makeGetRequest({ provider: 'openai', capability: 'embedding' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.models.every((m: { id: string; role: string }) => m.role === 'embedding')).toBe(true);
    expect(json.models.some((m: { id: string }) => m.id === 'gpt-4o')).toBe(false);
  });

  it('returns all models when capability is not specified', async () => {
    const res = await GET(makeGetRequest({ provider: 'openai' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.models.length).toBe(3); // chat + embedding
  });

  it('returns empty array when capability filter matches no models', async () => {
    const res = await GET(makeGetRequest({ provider: 'openai', capability: 'image' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.models).toEqual([]);
  });

  // ---- Sorting ----

  it('sorts popular models first', async () => {
    (discoverModels as ReturnType<typeof vi.fn>).mockResolvedValue({
      models: [
        { id: 'alpha-model', role: 'chat' },
        { id: 'gpt-4o', role: 'chat' },
        { id: 'zebra-model', role: 'chat' },
        { id: 'gpt-4o-mini', role: 'chat' },
      ],
      source: 'live',
    });

    const res = await GET(makeGetRequest({ provider: 'openai' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    const ids = json.models.map((m: { id: string }) => m.id);
    // gpt-4o and gpt-4o-mini are in POPULAR_MODELS for openai, should come first
    expect(ids.indexOf('gpt-4o')).toBeLessThan(ids.indexOf('alpha-model'));
    expect(ids.indexOf('gpt-4o-mini')).toBeLessThan(ids.indexOf('alpha-model'));
  });

  // ---- Empty model list ----

  it('returns empty array when discoverModels returns empty list', async () => {
    (discoverModels as ReturnType<typeof vi.fn>).mockResolvedValue({
      models: [],
      source: 'fallback',
    });

    const res = await GET(makeGetRequest({ provider: 'openai' }));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.models).toEqual([]);
    expect(json.source).toBe('fallback');
  });

  // ---- Internal error ----

  it('returns 500 when discoverModels throws unexpected error', async () => {
    (discoverModels as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Unexpected failure'),
    );

    const res = await GET(makeGetRequest({ provider: 'openai' }));
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'internal_error');
  });

  it('returns 500 when resolveApiKey throws unexpected error', async () => {
    (resolveApiKey as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Key resolution failed'),
    );

    const res = await GET(makeGetRequest({ provider: 'openai' }));
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'internal_error');
  });

  // ---- Cache-Control on static fallbacks ----

  it('includes Cache-Control header for static fallback providers', async () => {
    const res = await GET(makeGetRequest({ provider: 'elevenlabs' }));
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=60');
  });

  // ---- Model entry shape ----

  it('each model entry has id and role fields', async () => {
    const res = await GET(makeGetRequest({ provider: 'openai' }));
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
