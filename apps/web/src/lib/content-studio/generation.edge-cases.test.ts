import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildContentIdea } from '@/test/factories/content-studio';

/**
 * Tests for generateForIdea() with mocked fetch and env.
 *
 * We use vi.resetModules() + dynamic import so the module re-evaluates
 * env on each test, picking up the mocked values.
 */

function openAiJsonResponse(content: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(content) } }],
    }),
    text: async () => JSON.stringify(content),
  };
}

function openAiErrorResponse(status: number, body = '') {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => body || `Error ${status}`,
  };
}

function validGenerationPayload(draftCount = 3) {
  const brief = {
    angle: 'Angle test',
    proof: 'Proof test',
    cta: 'CTA test',
    mediaDirection: 'Media direction test',
  };
  const drafts = Array.from({ length: draftCount }, (_, i) => ({
    variantLabel: `variant-${i}`,
    hook: `Hook ${i}`,
    caption: `Caption ${i}`,
    cta: `CTA ${i}`,
    altText: `Alt ${i}`,
    hashtags: [`tag${i}`],
  }));
  return { brief, drafts };
}

describe('generateForIdea edge cases', () => {
  beforeEach(() => {
    vi.resetModules();
    // Ensure env parses without error — provide required secrets.
    vi.stubEnv('ADMIN_SESSION_PASSWORD', 'a'.repeat(32));
    vi.stubEnv('WEBHOOK_SECRET_KEY', 'b'.repeat(32));
    vi.stubEnv('CRON_SECRET', 'c'.repeat(32));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns fallback when no API key is configured', async () => {
    vi.stubEnv('CONTENT_STUDIO_OPENAI_API_KEY', '');
    vi.stubEnv('CHAT_OPENAI_API_KEY', '');
    const { generateForIdea } = await import('./generation');
    const idea = buildContentIdea();
    const result = await generateForIdea(idea);

    expect(result.provider).toBe('fallback');
    expect(result.model).toBe('deterministic-template');
    expect(result.drafts.length).toBeGreaterThanOrEqual(1);
    expect(result.brief.angle).toBeTruthy();
  });

  it('returns fallback with providerError on 429', async () => {
    vi.stubEnv('CONTENT_STUDIO_OPENAI_API_KEY', 'sk-test-key-for-429');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(openAiErrorResponse(429, 'Rate limited')),
    );
    const { generateForIdea } = await import('./generation');
    const result = await generateForIdea(buildContentIdea());

    expect(result.provider).toBe('fallback');
    expect(result.raw).toHaveProperty('providerError');
    expect(String(result.raw.providerError)).toContain('Rate limited');
  });

  it('returns fallback with providerError on 503', async () => {
    vi.stubEnv('CONTENT_STUDIO_OPENAI_API_KEY', 'sk-test-key-for-503');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(openAiErrorResponse(503, 'Service Unavailable')),
    );
    const { generateForIdea } = await import('./generation');
    const result = await generateForIdea(buildContentIdea());

    expect(result.provider).toBe('fallback');
    expect(result.raw).toHaveProperty('providerError');
    expect(String(result.raw.providerError)).toContain('Service Unavailable');
  });

  it('returns provider=openai with parsed brief+drafts on valid JSON', async () => {
    vi.stubEnv('CONTENT_STUDIO_OPENAI_API_KEY', 'sk-test-key-valid');
    const payload = validGenerationPayload(3);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(openAiJsonResponse(payload)),
    );
    const { generateForIdea } = await import('./generation');
    const result = await generateForIdea(buildContentIdea());

    expect(result.provider).toBe('openai');
    expect(result.brief.angle).toBe('Angle test');
    expect(result.drafts).toHaveLength(3);
    expect(result.drafts[0].variantLabel).toBe('variant-0');
  });

  it('returns fallback when OpenAI returns truncated/invalid JSON', async () => {
    vi.stubEnv('CONTENT_STUDIO_OPENAI_API_KEY', 'sk-test-key-truncated');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{ message: { content: '{"brief": {"angle": "trunc' } }],
        }),
        text: async () => '',
      }),
    );
    const { generateForIdea } = await import('./generation');
    const result = await generateForIdea(buildContentIdea());

    expect(result.provider).toBe('fallback');
    expect(result.raw).toHaveProperty('providerError');
  });

  it('returns fallback when OpenAI returns JSON where drafts is empty string', async () => {
    vi.stubEnv('CONTENT_STUDIO_OPENAI_API_KEY', 'sk-test-key-bad-drafts');
    const badPayload = {
      brief: {
        angle: 'Valid angle',
        proof: 'Proof',
        cta: 'CTA',
        mediaDirection: 'Direction',
      },
      drafts: '',
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(openAiJsonResponse(badPayload)),
    );
    const { generateForIdea } = await import('./generation');
    const result = await generateForIdea(buildContentIdea());

    expect(result.provider).toBe('fallback');
    expect(result.raw).toHaveProperty('providerError');
  });

  it('returns fallback when finish_reason is content_filter', async () => {
    vi.stubEnv('CONTENT_STUDIO_OPENAI_API_KEY', 'sk-test-key-filter');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              finish_reason: 'content_filter',
              message: { content: '' },
            },
          ],
        }),
        text: async () => '',
      }),
    );
    const { generateForIdea } = await import('./generation');
    const result = await generateForIdea(buildContentIdea());

    // Empty content string causes JSON.parse to throw, leading to fallback
    expect(result.provider).toBe('fallback');
  });

  it('returns at most 3 drafts even if OpenAI returns 5', async () => {
    vi.stubEnv('CONTENT_STUDIO_OPENAI_API_KEY', 'sk-test-key-5-drafts');
    const payload = validGenerationPayload(5);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(openAiJsonResponse(payload)),
    );
    const { generateForIdea } = await import('./generation');
    const result = await generateForIdea(buildContentIdea());

    expect(result.provider).toBe('openai');
    expect(result.drafts).toHaveLength(3);
    // Confirm it's the first 3
    expect(result.drafts[0].variantLabel).toBe('variant-0');
    expect(result.drafts[2].variantLabel).toBe('variant-2');
  });
});
