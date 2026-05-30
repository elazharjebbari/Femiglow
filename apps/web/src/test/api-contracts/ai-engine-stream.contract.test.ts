/**
 * generate-stream SSE endpoint contract tests — Gap #21
 *
 * Validates the streaming SSE endpoint returns correct headers,
 * status codes, and handles error cases properly.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({ get: vi.fn() })),
}));

vi.mock('@/lib/content-studio/auth', () => ({
  requireAdminApi: vi.fn().mockResolvedValue({ adminId: 'test-admin', email: 'test@test.com' }),
}));

// Mock the graph engine's stream method
const mockStream = vi.fn();
vi.mock('@/lib/ai-engine/graph', () => ({
  createContentEngine: vi.fn(() => ({
    stream: mockStream,
  })),
}));

vi.mock('@/lib/ai-engine/config', () => ({
  getEngineConfig: vi.fn(() => ({
    enabled: true,
    providers: { text: { default: 'openai', model: 'gpt-4' }, image: { default: 'mock', model: 'mock' }, video: { default: 'mock' }, tts: { default: 'mock' } },
    apiKeys: {},
    budget: { dailyCents: 1000, maxPerJobCents: 200 },
    quality: { threshold: 0.7, humanReviewRequired: false },
    defaults: { tone: 'professional', language: 'fr', maxRetries: 3 },
  })),
}));

vi.mock('@/lib/ai-engine/jobs', () => ({
  createJob: vi.fn().mockResolvedValue(undefined),
  updateJobResult: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/ai-engine/bridge', () => ({
  bridgeToContentStudio: vi.fn().mockResolvedValue({
    ideaId: 'idea-001',
    briefId: 'brief-001',
    draftId: 'draft-001',
  }),
}));

vi.mock('@/lib/errors/http-error', () => ({
  formatErrorResponse: vi.fn((err: unknown) => ({
    status: 500,
    body: { error: err instanceof Error ? err.message : 'Internal error' },
  })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/admin/ai-engine/generate-stream/route';
import { getEngineConfig } from '@/lib/ai-engine/config';
import { requireAdminApi } from '@/lib/content-studio/auth';

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
  return new Request('http://localhost:3000/api/admin/ai-engine/generate-stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Create a mock async iterable that yields graph stream chunks */
function createMockAsyncIterable(chunks: Array<Record<string, unknown>>) {
  return {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        async next() {
          if (index < chunks.length) {
            return { value: chunks[index++], done: false };
          }
          return { value: undefined, done: true };
        },
      };
    },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/admin/ai-engine/generate-stream — SSE contract tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getEngineConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      enabled: true,
      providers: { text: { default: 'openai', model: 'gpt-4' }, image: { default: 'mock', model: 'mock' }, video: { default: 'mock' }, tts: { default: 'mock' } },
      apiKeys: {},
      budget: { dailyCents: 1000, maxPerJobCents: 200 },
      quality: { threshold: 0.7, humanReviewRequired: false },
      defaults: { tone: 'professional', language: 'fr', maxRetries: 3 },
    });

    // Default: stream yields a single node completion
    mockStream.mockResolvedValue(
      createMockAsyncIterable([
        { parseBrief: { currentStep: 'parse_brief' } },
        { generateScript: { script: { hook: 'Test' }, currentStep: 'generate_script' } },
        { generateCaption: { caption: 'Hello', hashtags: ['#test'], currentStep: 'generate_caption' } },
        { qualityCheck: { qualityScores: { average: 0.9 }, currentStep: 'quality_check' } },
      ]),
    );
  });

  it('returns Content-Type: text/event-stream', async () => {
    const res = await POST(makeRequest(validPayload()));
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');
  });

  it('returns Cache-Control: no-cache', async () => {
    const res = await POST(makeRequest(validPayload()));
    expect(res.headers.get('Cache-Control')).toContain('no-cache');
  });

  it('valid payload returns 200', async () => {
    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(200);
  });

  it('missing platform returns 400', async () => {
    const payload = validPayload();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (payload as any).platform;

    const res = await POST(makeRequest(payload));
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json).toHaveProperty('error', 'Validation error');
  });

  it('engine disabled returns 503', async () => {
    (getEngineConfig as ReturnType<typeof vi.fn>).mockReturnValue({
      enabled: false,
      providers: { text: { default: 'openai', model: 'gpt-4' }, image: { default: 'mock', model: 'mock' }, video: { default: 'mock' }, tts: { default: 'mock' } },
      apiKeys: {},
      budget: { dailyCents: 1000, maxPerJobCents: 200 },
      quality: { threshold: 0.7, humanReviewRequired: false },
      defaults: { tone: 'professional', language: 'fr', maxRetries: 3 },
    });

    const res = await POST(makeRequest(validPayload()));
    expect(res.status).toBe(503);

    const json = await res.json();
    expect(json.error).toMatch(/disabled/i);
  });

  it('auth failure returns error status', async () => {
    (requireAdminApi as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error('Unauthorized'),
    );

    const res = await POST(makeRequest(validPayload()));
    // The route catches auth errors and returns an error response
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});
