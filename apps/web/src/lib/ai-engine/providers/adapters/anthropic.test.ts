import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type { ProviderConfig, TextGenParams, ImageGenParams } from '../types';
import { NotImplementedError } from '../types';

// ---------------------------------------------------------------------------
// Mock @langchain/anthropic
// ---------------------------------------------------------------------------

let llmInvokeFn: ReturnType<typeof vi.fn>;

vi.mock('@langchain/anthropic', () => ({
  ChatAnthropic: vi.fn().mockImplementation(() => ({
    invoke: (...args: unknown[]) => llmInvokeFn(...args),
    withStructuredOutput: vi.fn().mockReturnValue({
      invoke: vi.fn().mockResolvedValue({ key: 'structured_value' }),
    }),
  })),
}));

import { AnthropicAdapter } from './anthropic';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: 'anthropic-test',
    type: 'anthropic',
    name: 'anthropic',
    apiKeyEnvVar: 'TEST_ANTHROPIC_API_KEY',
    capabilities: ['text', 'vision'],
    models: [
      {
        name: 'claude-sonnet-4-20250514',
        capability: 'text',
        costPer1MInput: 300,
        costPer1MOutput: 1500,
        supportsVision: true,
      },
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
    model: 'claude-sonnet-4-20250514',
    messages: [{ role: 'user', content: 'Generate a social media caption.' }],
    temperature: 0.7,
    maxTokens: 500,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AnthropicAdapter', () => {
  let adapter: AnthropicAdapter;
  const originalEnv = process.env.TEST_ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.TEST_ANTHROPIC_API_KEY = 'sk-ant-test-key-12345';
    adapter = new AnthropicAdapter(makeConfig());

    llmInvokeFn = vi.fn().mockResolvedValue({
      content: 'Generated text content from Anthropic',
      usage_metadata: { input_tokens: 100, output_tokens: 50 },
    });
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.TEST_ANTHROPIC_API_KEY = originalEnv;
    } else {
      delete process.env.TEST_ANTHROPIC_API_KEY;
    }
  });

  it('generateText returns content string', async () => {
    const result = await adapter.generateText(makeTextParams());
    expect(result.data.text).toBe('Generated text content from Anthropic');
    expect(result.data.finishReason).toBe('stop');
    expect(result.provider).toBe('anthropic');
    expect(result.model).toBe('claude-sonnet-4-20250514');
  });

  it('generateText tracks tokens and cost', async () => {
    const result = await adapter.generateText(makeTextParams());
    // 100 input tokens * 300/1M = 0.03 cents
    // 50 output tokens * 1500/1M = 0.075 cents
    // Total = 0.105 cents
    expect(result.costCents).toBeCloseTo(0.105, 4);
    expect(result.tokensUsed.input).toBe(100);
    expect(result.tokensUsed.output).toBe(50);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('capabilities includes text and vision', () => {
    expect(adapter.capabilities).toContain('text');
    expect(adapter.capabilities).toContain('vision');
  });

  it('name is anthropic', () => {
    expect(adapter.name).toBe('anthropic');
  });

  it('throws when API key is missing', async () => {
    delete process.env.TEST_ANTHROPIC_API_KEY;
    const noKeyAdapter = new AnthropicAdapter(makeConfig());

    await expect(noKeyAdapter.generateText(makeTextParams())).rejects.toThrow(
      /Missing API key/,
    );
  }, 10_000);

  it('computeCostCents correct for Claude Sonnet pricing', () => {
    const computeCost = (
      adapter as unknown as {
        computeCostCents: (m: string, i: number, o: number) => number;
      }
    ).computeCostCents.bind(adapter);

    // 1M input * 300/1M = 300 cents, 1M output * 1500/1M = 1500 cents => 1800 total
    const cost = computeCost('claude-sonnet-4-20250514', 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(1800, 2);
  });

  it('generateTextWithVision handles image URLs', async () => {
    const params = {
      ...makeTextParams(),
      imageUrls: ['https://example.com/image.jpg'],
    };

    const result = await adapter.generateTextWithVision(params);
    expect(result.data.text).toBe('Generated text content from Anthropic');
    expect(result.data.finishReason).toBe('stop');
    expect(result.provider).toBe('anthropic');
    expect(llmInvokeFn).toHaveBeenCalledTimes(1);
  });

  it('does not support image generation (throws NotImplementedError)', async () => {
    const params: ImageGenParams = {
      model: 'dall-e-3',
      prompt: 'A beautiful image',
    };

    await expect(adapter.generateImage(params)).rejects.toThrow(NotImplementedError);
    await expect(adapter.generateImage(params)).rejects.toThrow(
      /generateImage is not implemented/,
    );
  });
});
