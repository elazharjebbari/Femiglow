import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { server, http, HttpResponse } from '@/test/msw/server';
import type { ProviderConfig, TextGenParams, ImageGenParams, EmbeddingParams } from '../types';

// ---------------------------------------------------------------------------
// Mock @langchain/openai (module mock — NOT fetch). Le SDK est mocké pour le
// texte/embedding ; les appels HTTP (image, TTS) passent par MSW (ARC-004).
// ---------------------------------------------------------------------------

let llmInvokeFn: ReturnType<typeof vi.fn>;
let embedQueryFn: ReturnType<typeof vi.fn>;

vi.mock('@langchain/openai', () => ({
  ChatOpenAI: vi.fn().mockImplementation(() => ({
    invoke: (...args: unknown[]) => llmInvokeFn(...args),
    withStructuredOutput: vi.fn().mockReturnValue({
      invoke: vi.fn().mockResolvedValue({ key: 'structured_value' }),
    }),
  })),
  OpenAIEmbeddings: vi.fn().mockImplementation(() => ({
    embedQuery: (...args: unknown[]) => embedQueryFn(...args),
  })),
}));

import { OpenAIAdapter } from './openai';

const IMAGES_URL = 'https://api.openai.com/v1/images/generations';
const SPEECH_URL = 'https://api.openai.com/v1/audio/speech';

// ARC-004 — interception réseau MSW (fidèle au contrat OpenAI), au lieu de
// remplacer globalThis.fetch. server.listen idempotent (cf. test/msw/server.ts).
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ---------------------------------------------------------------------------
// Test config
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: 'openai-test',
    type: 'openai',
    name: 'OpenAI Test',
    apiKeyEnvVar: 'TEST_OPENAI_API_KEY',
    capabilities: ['text', 'image', 'tts', 'embedding'],
    models: [
      { name: 'gpt-4', capability: 'text', costPer1MInput: 300, costPer1MOutput: 600 },
      { name: 'dall-e-3', capability: 'image', costPerUnit: 4 },
      { name: 'tts-1', capability: 'tts', costPerUnit: 1500 },
      { name: 'text-embedding-3-small', capability: 'embedding', costPer1MInput: 2 },
    ],
    rateLimitRpm: 60,
    dailyBudgetCents: 1000,
    circuitBreaker: { failureThreshold: 5, resetTimeoutMs: 60000, halfOpenMaxCalls: 1 },
    priority: 1,
    isFallback: false,
    isEnabled: true,
    healthStatus: 'healthy',
    ...overrides,
  } as ProviderConfig;
}

function makeTextParams(overrides: Partial<TextGenParams> = {}): TextGenParams {
  return {
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Generate a social media caption.' }],
    temperature: 0.7,
    maxTokens: 500,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('OpenAIAdapter', () => {
  let adapter: OpenAIAdapter;
  const originalEnv = process.env.TEST_OPENAI_API_KEY;

  beforeEach(() => {
    process.env.TEST_OPENAI_API_KEY = 'sk-test-key-12345';
    adapter = new OpenAIAdapter(makeConfig());

    llmInvokeFn = vi.fn().mockResolvedValue({
      content: 'Generated text content from OpenAI',
      usage_metadata: { input_tokens: 150, output_tokens: 75 },
    });
    embedQueryFn = vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4, 0.5]);

    // Handlers réseau par défaut (image + TTS), fidèles à la forme OpenAI.
    server.use(
      http.post(IMAGES_URL, () =>
        HttpResponse.json({ data: [{ url: 'https://cdn.openai.com/generated-image.png' }] }),
      ),
      http.post(SPEECH_URL, () =>
        new HttpResponse(new ArrayBuffer(8), { headers: { 'content-type': 'audio/mpeg' } }),
      ),
    );
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.TEST_OPENAI_API_KEY = originalEnv;
    } else {
      delete process.env.TEST_OPENAI_API_KEY;
    }
  });

  it('generateText returns TextResult with content', async () => {
    const result = await adapter.generateText(makeTextParams());
    expect(result.data.text).toBe('Generated text content from OpenAI');
    expect(result.data.finishReason).toBe('stop');
    expect(result.provider).toBe('OpenAI Test');
    expect(result.model).toBe('gpt-4');
  });

  it('generateText tracks cost from usage_metadata', async () => {
    const result = await adapter.generateText(makeTextParams());
    expect(result.costCents).toBeCloseTo(0.09, 4);
    expect(result.tokensUsed.input).toBe(150);
    expect(result.tokensUsed.output).toBe(75);
  });

  it('generateImage calls OpenAI images API', async () => {
    const params: ImageGenParams = {
      model: 'dall-e-3',
      prompt: 'A beautiful skincare product photograph',
      count: 1,
      width: 1024,
      height: 1024,
    };

    // Si l'adapter appelait une AUTRE URL, MSW lèverait (onUnhandledRequest:error).
    const result = await adapter.generateImage(params);
    expect(result.data.images).toHaveLength(1);
    expect(result.data.images[0]!.url).toBe('https://cdn.openai.com/generated-image.png');
  });

  it('capabilities includes text, image, tts, embedding', () => {
    expect(adapter.capabilities).toContain('text');
    expect(adapter.capabilities).toContain('image');
    expect(adapter.capabilities).toContain('tts');
    expect(adapter.capabilities).toContain('embedding');
  });

  it('throws when API key is missing', async () => {
    delete process.env.TEST_OPENAI_API_KEY;
    const noKeyAdapter = new OpenAIAdapter(makeConfig());
    await expect(noKeyAdapter.generateText(makeTextParams())).rejects.toThrow(/Missing API key/);
  }, 10_000);

  it('computeCostCents calculates correctly', () => {
    const computeCost = (adapter as unknown as { computeCostCents: (m: string, i: number, o: number) => number }).computeCostCents.bind(adapter);
    const cost = computeCost('gpt-4', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(900, 2);
  });

  it('generateEmbedding returns float array', async () => {
    const params: EmbeddingParams = {
      model: 'text-embedding-3-small',
      input: 'Skincare product for daily ritual',
    };
    const result = await adapter.generateEmbedding(params);
    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data).toEqual([0.1, 0.2, 0.3, 0.4, 0.5]);
    expect(result.provider).toBe('OpenAI Test');
  });

  it('textToSpeech capability exists and calls TTS API', async () => {
    const result = await adapter.textToSpeech({
      model: 'tts-1',
      text: 'Welcome to the world of Japanese skincare.',
      voice: 'alloy',
    });
    expect(result.data.format).toBe('mp3');
    expect(typeof result.data.audioBase64).toBe('string');
  });
});
