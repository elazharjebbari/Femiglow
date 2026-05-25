import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — vi.mock factories are hoisted, so they cannot reference module-scope
// variables. We use inline literal values and override via mockReturnValue in
// beforeEach.
// ---------------------------------------------------------------------------

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'test-admin', email: 'test@test.com' }),
  requireContentStudioEnabled: vi.fn(),
}));

vi.mock('@/lib/ai-engine/orchestrator', () => ({
  runGeneration: vi.fn().mockResolvedValue({
    jobId: 'job-001',
    status: 'completed',
    script: { hook: 'Discover the ritual', body: 'Japanese beauty', cta: 'Shop now' },
    caption: 'Unlock the secret of J-Beauty',
    hashtags: ['#beauty', '#jbeauty', '#femiglow'],
    images: [{ url: 'https://cdn.example.com/img.jpg', provider: 'openai' }],
    videos: [],
    qualityScores: { average: 0.88, coherence: 0.92, brandAlignment: 0.84 },
    moderationResult: { safe: true },
    costTracking: { totalCents: 15, breakdown: {}, tokensUsed: {} },
    errors: [],
    durationMs: 4200,
  }),
}));

vi.mock('@/lib/ai-engine/config', () => ({
  getEngineConfig: vi.fn(() => ({
    enabled: true,
    providers: {
      text: { default: 'openai', model: 'gpt-4' },
      image: { default: 'mock', model: 'mock' },
      video: { default: 'mock' },
      tts: { default: 'mock' },
    },
    apiKeys: {},
    budget: { dailyCents: 1000, maxPerJobCents: 200 },
    quality: { threshold: 0.7, humanReviewRequired: false },
    defaults: { tone: 'professional', language: 'fr', maxRetries: 3 },
  })),
}));

vi.mock('@/lib/ai-engine/bridge', () => ({
  bridgeToContentStudio: vi.fn().mockResolvedValue({
    ideaId: 'idea-001',
    briefId: 'brief-001',
    draftId: 'draft-001',
  }),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/admin/ai-engine/generate/route';
import { runGeneration } from '@/lib/ai-engine/orchestrator';
import { getEngineConfig } from '@/lib/ai-engine/config';

// ---------------------------------------------------------------------------
// Test-scoped mock values
// ---------------------------------------------------------------------------

const mockSuccessResult = {
  jobId: 'job-001',
  status: 'completed' as const,
  script: { hook: 'Discover the ritual', body: 'Japanese beauty', cta: 'Shop now' },
  caption: 'Unlock the secret of J-Beauty',
  hashtags: ['#beauty', '#jbeauty', '#femiglow'],
  images: [{ url: 'https://cdn.example.com/img.jpg', provider: 'openai' }],
  videos: [],
  qualityScores: { average: 0.88, coherence: 0.92, brandAlignment: 0.84 },
  moderationResult: { safe: true },
  costTracking: { totalCents: 15, breakdown: {}, tokensUsed: {} },
  errors: [],
  durationMs: 4200,
};

const mockFailedResult = {
  ...mockSuccessResult,
  status: 'failed' as const,
  script: null,
  caption: '',
  hashtags: [],
  images: [],
  errors: [{ node: 'orchestrator', errorType: 'UnhandledError', message: 'Provider timeout' }],
};

const enabledConfig = {
  enabled: true,
  providers: {
    text: { default: 'openai', model: 'gpt-4' },
    image: { default: 'mock', model: 'mock' },
    video: { default: 'mock' },
    tts: { default: 'mock' },
  },
  apiKeys: {},
  budget: { dailyCents: 1000, maxPerJobCents: 200 },
  quality: { threshold: 0.7, humanReviewRequired: false },
  defaults: { tone: 'professional', language: 'fr', maxRetries: 3 },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validPayload() {
  return {
    platform: 'instagram',
    format: 'post',
    contentType: 'produit',
    briefInput: {
      objective: 'engagement',
      tone: 'professional',
      targetAudience: 'Women 25-45',
      keyMessage: 'Discover J-Beauty rituals for radiant skin',
    },
  };
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/admin/ai-engine/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/admin/ai-engine/generate — contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getEngineConfig as ReturnType<typeof vi.fn>).mockReturnValue(enabledConfig);
    (runGeneration as ReturnType<typeof vi.fn>).mockResolvedValue(mockSuccessResult);
  });

  it('returns 200 with GenerationResult shape for a valid payload', async () => {
    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('jobId');
    expect(json).toHaveProperty('status', 'completed');
    expect(json).toHaveProperty('script');
    expect(json).toHaveProperty('caption');
    expect(json).toHaveProperty('hashtags');
  });

  it('returns 400 when platform is missing', async () => {
    const payload = validPayload();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (payload as any).platform;

    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json).toHaveProperty('error', 'Validation error');
    expect(json).toHaveProperty('details');
  });

  it('returns 400 when briefInput.keyMessage is missing', async () => {
    const payload = validPayload();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (payload as any).briefInput.keyMessage;

    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('returns 400 for an invalid objective enum value', async () => {
    const payload = validPayload();
    payload.briefInput.objective = 'invalid_objective' as never;

    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('returns 400 for an invalid platform enum value', async () => {
    const payload = { ...validPayload(), platform: 'snapchat' };

    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('returns 400 for an empty body', async () => {
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toBe('Validation error');
  });

  it('returns 503 when the AI engine is disabled', async () => {
    (getEngineConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      ...enabledConfig,
      enabled: false,
    });

    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.error).toMatch(/disabled/i);
  });

  it('returns 500 with error details when generation fails', async () => {
    (runGeneration as ReturnType<typeof vi.fn>).mockResolvedValue(mockFailedResult);

    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(500);

    const json = await res.json();
    expect(json.status).toBe('failed');
    expect(json.errors).toBeInstanceOf(Array);
    expect(json.errors.length).toBeGreaterThan(0);
  });

  it('response includes jobId, status, script, caption, and hashtags', async () => {
    const res = await POST(makeRequest(validPayload()));
    const json = await res.json();

    expect(json.jobId).toBe('job-001');
    expect(json.status).toBe('completed');
    expect(json.script).toEqual({ hook: 'Discover the ritual', body: 'Japanese beauty', cta: 'Shop now' });
    expect(json.caption).toBe('Unlock the secret of J-Beauty');
    expect(json.hashtags).toEqual(['#beauty', '#jbeauty', '#femiglow']);
  });

  it('response includes bridgeResult and contentStudioUrl', async () => {
    const res = await POST(makeRequest(validPayload()));
    const json = await res.json();

    expect(json.bridgeResult).toEqual({
      ideaId: 'idea-001',
      briefId: 'brief-001',
      draftId: 'draft-001',
    });
    expect(json.contentStudioUrl).toContain('/admin/content-studio-v2/library');
    expect(json.contentStudioUrl).toContain('draft-001');
  });
});
