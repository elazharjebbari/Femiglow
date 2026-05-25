import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { ProviderConfig, TextGenParams, EmbeddingParams } from '../types';
import { NotImplementedError } from '../types';

// ---------------------------------------------------------------------------
// Mock @langchain/google-genai
// ---------------------------------------------------------------------------

let llmInvokeFn: ReturnType<typeof vi.fn>;

vi.mock('@langchain/google-genai', () => ({
  ChatGoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    invoke: (...args: unknown[]) => llmInvokeFn(...args),
    withStructuredOutput: vi.fn().mockReturnValue({
      invoke: vi.fn().mockResolvedValue({ key: 'structured_value' }),
    }),
  })),
}));

// Mock fetch for image generation API
let fetchFn: ReturnType<typeof vi.fn>;
vi.stubGlobal('fetch', (...args: unknown[]) => fetchFn(...args));

import { GoogleAdapter } from './google';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: 'google-test',
    type: 'google',
    name: 'google',
    apiKeyEnvVar: 'TEST_GOOGLE_API_KEY',
    capabilities: ['text', 'image'],
    models: [
      {
        name: 'gemini-2.0-flash',
        capability: 'text',
        costPer1MInput: 7.5,
        costPer1MOutput: 30,
      },
      {
        name: 'imagen-3.0-generate-002',
        capability: 'image',
        costPerUnit: 4,
      },
    ],
    rateLimitRpm: 60,
    dailyBudgetCents: 1000,
    circuitBreaker: { failureThreshold: 5, resetTimeoutMs: 60000, halfOpenMaxCalls: 1 },
    priority: 2,
    isFallback: false,
    isEnabled: true,
    healthStatus: 'healthy',
    ...overrides,
  } as ProviderConfig;
}

function makeTextParams(overrides: Partial<TextGenParams> = {}): TextGenParams {
  return {
    model: 'gemini-2.0-flash',
    messages: [{ role: 'user', content: 'Generate a social media caption.' }],
    temperature: 0.7,
    maxTokens: 500,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GoogleAdapter', () => {
  let adapter: GoogleAdapter;
  const originalEnv = process.env.TEST_GOOGLE_API_KEY;

  beforeEach(() => {
    process.env.TEST_GOOGLE_API_KEY = 'google-test-key-12345';
    adapter = new GoogleAdapter(makeConfig());

    llmInvokeFn = vi.fn().mockResolvedValue({
      content: 'Generated text content from Google',
      usage_metadata: { input_tokens: 200, output_tokens: 80 },
    });

    fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        predictions: [{ bytesBase64Encoded: 'aW1hZ2VfZGF0YQ==' }],
      }),
      text: vi.fn().mockResolvedValue(''),
    });
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.TEST_GOOGLE_API_KEY = originalEnv;
    } else {
      delete process.env.TEST_GOOGLE_API_KEY;
    }
  });

  it('generateText returns content', async () => {
    const result = await adapter.generateText(makeTextParams());
    expect(result.data.text).toBe('Generated text content from Google');
    expect(result.data.finishReason).toBe('stop');
    expect(result.provider).toBe('google');
    expect(result.model).toBe('gemini-2.0-flash');
  });

  it('capabilities includes text and image', () => {
    expect(adapter.capabilities).toContain('text');
    expect(adapter.capabilities).toContain('image');
  });

  it('name is google', () => {
    expect(adapter.name).toBe('google');
  });

  it('throws when API key is missing', async () => {
    delete process.env.TEST_GOOGLE_API_KEY;
    const noKeyAdapter = new GoogleAdapter(makeConfig());

    await expect(noKeyAdapter.generateText(makeTextParams())).rejects.toThrow(
      /Missing API key/,
    );
  }, 10_000);

  it('generateImage calls Google API', async () => {
    const result = await adapter.generateImage({
      model: 'imagen-3.0-generate-002',
      prompt: 'A beautiful Japanese camellia flower',
      count: 1,
    });

    expect(fetchFn).toHaveBeenCalledWith(
      expect.stringContaining('generativelanguage.googleapis.com'),
      expect.objectContaining({ method: 'POST' }),
    );
    expect(result.data.images).toHaveLength(1);
    expect(result.data.images[0]!.base64).toBe('aW1hZ2VfZGF0YQ==');
  });

  it('cost calculation for Gemini models', async () => {
    const result = await adapter.generateText(makeTextParams());
    // 200 input tokens * 7.5/1M = 0.0015 cents
    // 80 output tokens * 30/1M = 0.0024 cents
    // Total = 0.0039 cents
    expect(result.costCents).toBeCloseTo(0.0039, 4);
    expect(result.tokensUsed.input).toBe(200);
    expect(result.tokensUsed.output).toBe(80);
  });

  it('does not support TTS (throws NotImplementedError)', () => {
    expect(() =>
      adapter.textToSpeech({ model: 'tts-1', text: 'Hello world' }),
    ).toThrow(NotImplementedError);
    expect(() =>
      adapter.textToSpeech({ model: 'tts-1', text: 'Hello world' }),
    ).toThrow(/textToSpeech is not implemented/);
  });

  it('does not support embedding (throws NotImplementedError)', async () => {
    const params: EmbeddingParams = {
      model: 'text-embedding-3-small',
      input: 'Some text to embed',
    };

    await expect(adapter.generateEmbedding(params)).rejects.toThrow(NotImplementedError);
    await expect(adapter.generateEmbedding(params)).rejects.toThrow(
      /generateEmbedding is not implemented/,
    );
  });
});
