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
  listApiKeys: vi.fn().mockResolvedValue([]),
  saveApiKey: vi.fn().mockResolvedValue({
    id: 'key-001',
    providerType: 'openai',
    providerName: 'OpenAI',
    label: 'OpenAI API Key',
    source: 'database',
    masked: 'sk-pr********abcd',
    keyPrefix: 'sk-pr',
    keyLastFour: 'abcd',
    isActive: true,
    baseUrl: null,
    lastTestedAt: null,
    lastTestResult: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }),
  deleteApiKey: vi.fn().mockResolvedValue({ success: true, fallbackToEnv: false }),
  testApiKey: vi.fn().mockResolvedValue({ valid: true, provider: 'openai', latencyMs: 120 }),
}));

vi.mock('@/lib/errors/http-error', async () => {
  const actual = await vi.importActual<typeof import('@/lib/errors/http-error')>('@/lib/errors/http-error');
  return actual;
});

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { GET, POST } from '@/app/api/admin/ai-engine/config/api-keys/route';
import { DELETE } from '@/app/api/admin/ai-engine/config/api-keys/[id]/route';
import { POST as POST_TEST } from '@/app/api/admin/ai-engine/config/api-keys/test/route';
import { requireAdminApi } from '@/lib/content-studio/auth';
import {
  listApiKeys,
  saveApiKey,
  deleteApiKey,
  testApiKey,
} from '@/lib/ai-engine/services/api-key-manager';

// ---------------------------------------------------------------------------
// Test-scoped mock data
// ---------------------------------------------------------------------------

const mockApiKeys = [
  {
    id: 'key-001',
    providerType: 'openai',
    providerName: 'OpenAI',
    label: 'OpenAI API Key',
    source: 'database',
    masked: 'sk-pr********abcd',
    keyPrefix: 'sk-pr',
    keyLastFour: 'abcd',
    isActive: true,
    baseUrl: null,
    lastTestedAt: '2026-01-15T10:00:00.000Z',
    lastTestResult: 'valid',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
  },
  {
    id: null,
    providerType: 'anthropic',
    providerName: 'Anthropic',
    label: "Variable d'environnement",
    source: 'env',
    masked: 'sk-ant********wxyz',
    keyPrefix: 'sk-ant',
    keyLastFour: 'wxyz',
    isActive: true,
    baseUrl: null,
    lastTestedAt: null,
    lastTestResult: null,
    createdAt: null,
    updatedAt: null,
  },
];

const mockSavedKey = {
  id: 'key-002',
  providerType: 'openai',
  providerName: 'OpenAI',
  label: 'OpenAI API Key',
  source: 'database',
  masked: 'sk-pr********efgh',
  keyPrefix: 'sk-pr',
  keyLastFour: 'efgh',
  isActive: true,
  baseUrl: null,
  lastTestedAt: null,
  lastTestResult: null,
  createdAt: '2026-01-20T00:00:00.000Z',
  updatedAt: '2026-01-20T00:00:00.000Z',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePostRequest(body: unknown, path = '/api/admin/ai-engine/config/api-keys'): Request {
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

// ---------------------------------------------------------------------------
// GET /api/admin/ai-engine/config/api-keys
// ---------------------------------------------------------------------------

describe('GET /api/admin/ai-engine/config/api-keys — contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (listApiKeys as ReturnType<typeof vi.fn>).mockResolvedValue(mockApiKeys);
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@example.com' });
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

  it('returns apiKeys array with status 200', async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('apiKeys');
    expect(Array.isArray(json.apiKeys)).toBe(true);
    expect(json.apiKeys.length).toBe(2);
  });

  it('includes Cache-Control: no-store header', async () => {
    const res = await GET();
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('includes Pragma: no-cache header', async () => {
    const res = await GET();
    expect(res.headers.get('Pragma')).toBe('no-cache');
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/ai-engine/config/api-keys
// ---------------------------------------------------------------------------

describe('POST /api/admin/ai-engine/config/api-keys — contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (saveApiKey as ReturnType<typeof vi.fn>).mockResolvedValue(mockSavedKey);
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@example.com' });
  });

  it('returns 401 when auth fails', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    const payload = { providerType: 'openai', apiKey: 'sk-test123' };
    const res = await POST(makePostRequest(payload));
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'unauthorized');
  });

  it('returns 400 when providerType is missing', async () => {
    const payload = { apiKey: 'sk-test123' };
    const res = await POST(makePostRequest(payload));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
    expect(json.details).toBeDefined();
  });

  it('returns 400 when providerType is invalid', async () => {
    const payload = { providerType: 'invalid-provider', apiKey: 'sk-test123' };
    const res = await POST(makePostRequest(payload));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('returns 400 when apiKey is missing', async () => {
    const payload = { providerType: 'openai' };
    const res = await POST(makePostRequest(payload));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('returns 400 when apiKey is empty string', async () => {
    const payload = { providerType: 'openai', apiKey: '' };
    const res = await POST(makePostRequest(payload));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('returns 503 when encryption is not configured', async () => {
    (saveApiKey as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('Encryption service not available — configure AI_ENGINE_ENCRYPTION_KEY and AI_ENGINE_ENCRYPTION_SALT'),
    );

    const payload = { providerType: 'openai', apiKey: 'sk-test123' };
    const res = await POST(makePostRequest(payload));
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.error).toContain('chiffrement');
  });

  it('returns 201 with apiKey on valid payload', async () => {
    const payload = { providerType: 'openai', apiKey: 'sk-realkey123456' };
    const res = await POST(makePostRequest(payload));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json).toHaveProperty('apiKey');
    expect(json.apiKey).toHaveProperty('id', 'key-002');
    expect(json.apiKey).toHaveProperty('providerType', 'openai');
    expect(json.apiKey).toHaveProperty('masked');
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('does NOT leak raw apiKey value in response — only masked', async () => {
    const rawKey = 'sk-SUPER-SECRET-KEY-9999';
    const payload = { providerType: 'openai', apiKey: rawKey };
    const res = await POST(makePostRequest(payload));
    expect(res.status).toBe(201);

    const text = await res.text();
    expect(text).not.toContain(rawKey);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/admin/ai-engine/config/api-keys/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/admin/ai-engine/config/api-keys/:id — contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (deleteApiKey as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, fallbackToEnv: false });
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@example.com' });
  });

  it('returns 401 when auth fails', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    const res = await DELETE(makeDeleteRequest('key-001'), { params: { id: 'key-001' } });
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'unauthorized');
  });

  it('returns 404 when key not found', async () => {
    (deleteApiKey as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error('API key not found'),
    );

    const res = await DELETE(makeDeleteRequest('nonexistent'), { params: { id: 'nonexistent' } });
    expect(res.status).toBe(404);

    const json = await res.json();
    expect(json.error).toBe('Clé API introuvable');
  });

  it('returns 200 with success:true, fallbackToEnv:false', async () => {
    (deleteApiKey as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, fallbackToEnv: false });

    const res = await DELETE(makeDeleteRequest('key-001'), { params: { id: 'key-001' } });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.fallbackToEnv).toBe(false);
  });

  it('returns 200 with success:true, fallbackToEnv:true when env key exists', async () => {
    (deleteApiKey as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true, fallbackToEnv: true });

    const res = await DELETE(makeDeleteRequest('key-001'), { params: { id: 'key-001' } });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.fallbackToEnv).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /api/admin/ai-engine/config/api-keys/test
// ---------------------------------------------------------------------------

describe('POST /api/admin/ai-engine/config/api-keys/test — contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (testApiKey as ReturnType<typeof vi.fn>).mockResolvedValue({ valid: true, provider: 'openai', latencyMs: 120 });
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'test@example.com' });
  });

  it('returns 401 when auth fails', async () => {
    const { HttpError } = await import('@/lib/errors/http-error');
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValue(
      new HttpError('unauthorized', 'Session expired'),
    );

    const payload = { providerType: 'openai' };
    const res = await POST_TEST(makePostRequest(payload, '/api/admin/ai-engine/config/api-keys/test'));
    expect(res.status).toBe(401);

    const json = await res.json();
    expect(json.error).toHaveProperty('code', 'unauthorized');
  });

  it('returns 400 when providerType is missing', async () => {
    const payload = {};
    const res = await POST_TEST(makePostRequest(payload, '/api/admin/ai-engine/config/api-keys/test'));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
    expect(json.details).toBeDefined();
  });

  it('returns 200 with result.valid:true on successful test', async () => {
    (testApiKey as ReturnType<typeof vi.fn>).mockResolvedValue({ valid: true, provider: 'openai', latencyMs: 95 });

    const payload = { providerType: 'openai' };
    const res = await POST_TEST(makePostRequest(payload, '/api/admin/ai-engine/config/api-keys/test'));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('result');
    expect(json.result.valid).toBe(true);
  });

  it('returns 200 with result.valid:false on failed test', async () => {
    (testApiKey as ReturnType<typeof vi.fn>).mockResolvedValue({
      valid: false,
      provider: 'openai',
      latencyMs: 0,
      error: 'Invalid API key',
    });

    const payload = { providerType: 'openai' };
    const res = await POST_TEST(makePostRequest(payload, '/api/admin/ai-engine/config/api-keys/test'));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('result');
    expect(json.result.valid).toBe(false);
    expect(json.result.error).toBeDefined();
  });

  it('returns 429 with Retry-After header on 6th request within 60s window', async () => {
    // Use a unique email so this test gets a fresh rate-limit bucket
    // (the in-memory rateLimitMap is keyed by session email and persists across tests).
    (requireAdminApi as ReturnType<typeof vi.fn>).mockResolvedValue({ adminId: 'test-admin', email: 'ratelimit-test@example.com' });

    const payload = { providerType: 'openai' };

    // The rate limiter allows 5 requests per 60s window.
    // Calls 1-5 should succeed; the 6th should be rate-limited.
    for (let i = 0; i < 5; i++) {
      const res = await POST_TEST(makePostRequest(payload, '/api/admin/ai-engine/config/api-keys/test'));
      expect(res.status).toBe(200);
    }

    // 6th request should be rate limited
    const res = await POST_TEST(makePostRequest(payload, '/api/admin/ai-engine/config/api-keys/test'));
    expect(res.status).toBe(429);

    const json = await res.json();
    expect(json.error).toBeDefined();

    const retryAfter = res.headers.get('Retry-After');
    expect(retryAfter).toBeDefined();
    expect(Number(retryAfter)).toBeGreaterThan(0);
    expect(Number(retryAfter)).toBeLessThanOrEqual(60);
  });
});
