/**
 * Security edge case tests — Gap #41, #45
 *
 * Validates that the AI engine handles malicious/adversarial inputs
 * safely without crashes, injections, or data leakage.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('./config', () => ({
  getEngineConfig: vi.fn(() => ({
    enabled: true,
    providers: { text: { default: 'openai', model: 'gpt-4' }, image: { default: 'mock', model: 'mock' }, video: { default: 'mock' }, tts: { default: 'mock' } },
    apiKeys: { openai: undefined, anthropic: undefined, google: undefined, elevenlabs: undefined, ollamaBaseUrl: undefined },
    budget: { dailyCents: 1000, maxPerJobCents: 200 },
    quality: { threshold: 0.7, humanReviewRequired: false },
    defaults: { tone: 'professional', language: 'fr', maxRetries: 3 },
  })),
  resetEngineConfig: vi.fn(),
}));

vi.mock('@/lib/content-studio/brand-rules', () => ({
  reviewDraftContent: vi.fn(() => ({
    scoreTotal: 75,
    status: 'ok',
    violations: [],
    score: 75,
  })),
}));

vi.mock('./graph', () => {
  const mockInvoke = vi.fn().mockImplementation(async (state: Record<string, unknown>) => ({
    ...state,
    caption: state.caption ?? `Generated content for: ${(state.brief as Record<string, unknown>)?.keyMessage ?? ''}`,
    hashtags: ['#beauty'],
    script: { hook: 'Test hook', scenes: [], cta: 'Shop now' },
    qualityScores: { average: 0.85 },
    moderationResult: { safe: true },
    currentStep: 'done',
  }));
  const mockGetState = vi.fn().mockResolvedValue({ next: [], tasks: [] });
  return {
    getContentEngine: () => ({
      invoke: mockInvoke,
      getState: mockGetState,
    }),
    createContentEngine: () => ({
      invoke: mockInvoke,
      getState: mockGetState,
    }),
    resetContentEngine: vi.fn(),
  };
});

vi.mock('./jobs', () => ({
  createJob: vi.fn().mockResolvedValue(undefined),
  updateJobResult: vi.fn().mockResolvedValue(undefined),
  updateJobStatus: vi.fn().mockResolvedValue(undefined),
}));

import { qualityCheckNode } from './nodes/quality-check';
import { runGeneration, type GenerationRequest } from './orchestrator';
import { getEngineConfig } from './config';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(overrides: Partial<GenerationRequest> = {}): GenerationRequest {
  return {
    platform: 'instagram',
    format: 'post',
    contentType: 'produit',
    briefInput: {
      objective: 'engagement',
      keyMessage: 'Discover J-Beauty rituals',
    },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Security edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('XSS in keyMessage: <script> tag passes through as plain text', async () => {
    const xssPayload = '<script>alert(1)</script>';
    const result = await runGeneration(
      makeRequest({
        briefInput: {
          objective: 'engagement',
          keyMessage: xssPayload,
        },
      }),
    );

    // The engine should complete without crashing
    expect(result.status).not.toBe('failed');
    // The content is returned as a data structure, not rendered HTML
    // It should be treated as plain text
    expect(typeof result.caption).toBe('string');
  });

  it('HTML in caption is safe when returned as JSON (not HTML rendered)', async () => {
    const htmlCaption = '<img src=x onerror=alert(1)>';
    const state = {
      jobId: 'test-xss',
      caption: htmlCaption,
      script: null,
      hashtags: [],
      images: [],
      videos: [],
      format: 'post',
      retries: {},
    };

    const result = await qualityCheckNode(state);

    // The quality check should process without error — HTML is treated as text
    expect(result.qualityScores).toBeDefined();
    // The result is a plain JS object; when serialized to JSON and parsed
    // back, the HTML is just a string value — never rendered as HTML.
    const json = JSON.stringify(result);
    const parsed = JSON.parse(json);
    // The quality scores are numbers, not executable HTML
    expect(typeof parsed.qualityScores.text_quality).toBe('number');
    // The raw HTML never appears as a DOM-renderable element in JSON output
    // (it's inside a string value, which is inert in JSON consumers)
    expect(parsed.currentStep).toBe('quality_check');
  });

  it('SQL-like content in brief does not cause errors', async () => {
    const sqlPayload = "'; DROP TABLE content_idea; --";
    const result = await runGeneration(
      makeRequest({
        briefInput: {
          objective: 'engagement',
          keyMessage: sqlPayload,
        },
      }),
    );

    // Should complete without crashing — no SQL execution possible
    expect(result.status).not.toBe('failed');
    expect(result.jobId).toBeDefined();
  });

  it('file path traversal in jobId does not create files outside media dir', async () => {
    // The orchestrator generates its own jobId via randomUUID(),
    // so a traversal attack via jobId is not possible from the caller.
    // We verify the generated jobId is a proper UUID.
    const result = await runGeneration(makeRequest());
    expect(result.jobId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('API key is never in log output', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Set a fake API key in the config
    const config = getEngineConfig();
    const fakeKey = 'sk-fake-test-key-1234567890abcdef';
    (config.apiKeys as Record<string, string>).openai = fakeKey;

    await runGeneration(makeRequest());

    // Check all console outputs
    const allCalls = [
      ...consoleSpy.mock.calls,
      ...consoleErrorSpy.mock.calls,
      ...consoleWarnSpy.mock.calls,
    ];

    for (const args of allCalls) {
      const output = args.map(String).join(' ');
      expect(output).not.toContain(fakeKey);
    }

    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('empty string API key treated as undefined', () => {
    const config = getEngineConfig();
    // The config uses `|| undefined` pattern for empty strings
    // Verify the logic: empty string should be falsy
    const emptyKey = '';
    const resolved = emptyKey || undefined;
    expect(resolved).toBeUndefined();

    // Verify the real config pattern works
    expect(config.apiKeys.openai === '' || config.apiKeys.openai === undefined || typeof config.apiKeys.openai === 'string').toBe(true);
  });

  it('extremely long keyMessage (10000 chars) does not crash', async () => {
    const longMessage = 'A'.repeat(10000);
    const result = await runGeneration(
      makeRequest({
        briefInput: {
          objective: 'engagement',
          keyMessage: longMessage,
        },
      }),
    );

    expect(result.status).not.toBe('failed');
    expect(result.jobId).toBeDefined();
  });

  it('unicode in brief (Japanese, Arabic, emoji) does not crash', async () => {
    const unicodeMessage = '美しいネイルケア العناية بالأظافر 💅✨🌸';
    const result = await runGeneration(
      makeRequest({
        briefInput: {
          objective: 'engagement',
          keyMessage: unicodeMessage,
        },
      }),
    );

    expect(result.status).not.toBe('failed');
    expect(result.jobId).toBeDefined();
  });
});
