import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import type {
  ProviderCallResult,
  ProviderConfig,
  TextGenParams,
  TextGenResult,
  ImageGenParams,
  ImageGenResult,
  EmbeddingParams,
} from '../types';
import { NotImplementedError } from '../types';
import { ProviderAdapter } from './base';

// ---------------------------------------------------------------------------
// Concrete test subclass — only text generation is implemented
// ---------------------------------------------------------------------------

class TestAdapter extends ProviderAdapter {
  public generateTextFn = vi.fn<(params: TextGenParams) => Promise<ProviderCallResult<TextGenResult>>>();

  async generateText(params: TextGenParams): Promise<ProviderCallResult<TextGenResult>> {
    return this.circuitBreaker.execute(() =>
      this.retryPolicy.execute(async () => {
        this.getApiKey(); // will throw if key is missing
        return this.generateTextFn(params);
      }),
    );
  }

  async generateImage(_params: ImageGenParams): Promise<ProviderCallResult<ImageGenResult>> {
    throw new NotImplementedError('generateImage', this.name);
  }

  async generateEmbedding(_params: EmbeddingParams): Promise<ProviderCallResult<number[]>> {
    throw new NotImplementedError('generateEmbedding', this.name);
  }

  // Expose protected methods for testing
  public testComputeCostCents(model: string, inputTokens: number, outputTokens: number): number {
    return this.computeCostCents(model, inputTokens, outputTokens);
  }

  public testGetApiKey(): string {
    return this.getApiKey();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: 'test-adapter',
    type: 'openai',
    name: 'TestProvider',
    apiKeyEnvVar: 'TEST_BASE_ADAPTER_KEY',
    capabilities: ['text', 'vision'],
    models: [
      {
        name: 'test-model',
        capability: 'text',
        costPer1MInput: 100,
        costPer1MOutput: 200,
      },
    ],
    rateLimitRpm: 60,
    dailyBudgetCents: 500,
    circuitBreaker: { failureThreshold: 3, resetTimeoutMs: 100, halfOpenMaxCalls: 1 },
    priority: 1,
    isFallback: false,
    isEnabled: true,
    healthStatus: 'healthy',
    ...overrides,
  } as ProviderConfig;
}

function makeSuccessResult(): ProviderCallResult<TextGenResult> {
  return {
    data: { text: 'Hello', finishReason: 'stop' },
    costCents: 0.05,
    tokensUsed: { input: 100, output: 50 },
    latencyMs: 123,
    provider: 'TestProvider',
    model: 'test-model',
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProviderAdapter (base)', () => {
  let adapter: TestAdapter;
  const originalEnv = process.env.TEST_BASE_ADAPTER_KEY;

  beforeEach(() => {
    process.env.TEST_BASE_ADAPTER_KEY = 'test-key-base';
    adapter = new TestAdapter(makeConfig());
    adapter.generateTextFn.mockResolvedValue(makeSuccessResult());
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.TEST_BASE_ADAPTER_KEY = originalEnv;
    } else {
      delete process.env.TEST_BASE_ADAPTER_KEY;
    }
  });

  it('abstract methods throw NotImplementedError when not implemented', async () => {
    await expect(
      adapter.generateImage({ model: 'img-model', prompt: 'test' }),
    ).rejects.toThrow(NotImplementedError);

    await expect(
      adapter.generateEmbedding({ model: 'emb-model', input: 'test' }),
    ).rejects.toThrow(NotImplementedError);

    // Default base methods also throw NotImplementedError (synchronously)
    expect(() =>
      adapter.generateVideo({ model: 'vid-model', prompt: 'test' }),
    ).toThrow(NotImplementedError);

    expect(() =>
      adapter.textToSpeech({ model: 'tts-model', text: 'test' }),
    ).toThrow(NotImplementedError);

    expect(() =>
      adapter.generateMusic({ model: 'music-model', prompt: 'test' }),
    ).toThrow(NotImplementedError);
  });

  it('circuit breaker wraps calls and blocks after threshold failures', async () => {
    // Use a config with a low failure threshold
    const cbAdapter = new TestAdapter(
      makeConfig({ circuitBreaker: { failureThreshold: 2, resetTimeoutMs: 60000, halfOpenMaxCalls: 1 } }),
    );
    cbAdapter.generateTextFn.mockRejectedValue(new Error('API down'));

    const params: TextGenParams = {
      model: 'test-model',
      messages: [{ role: 'user', content: 'test' }],
    };

    // First two calls fail and increment the failure counter
    await expect(cbAdapter.generateText(params)).rejects.toThrow('API down');
    await expect(cbAdapter.generateText(params)).rejects.toThrow('API down');

    // Third call should be blocked by the circuit breaker (OPEN state)
    await expect(cbAdapter.generateText(params)).rejects.toThrow(/Circuit breaker is open/);
  }, 30_000);

  it('retry policy applies on failure', async () => {
    let callCount = 0;
    adapter.generateTextFn.mockImplementation(async () => {
      callCount++;
      if (callCount < 3) throw new Error('Transient error');
      return makeSuccessResult();
    });

    const params: TextGenParams = {
      model: 'test-model',
      messages: [{ role: 'user', content: 'test' }],
    };

    const result = await adapter.generateText(params);
    expect(result.data.text).toBe('Hello');
    expect(callCount).toBe(3);
  }, 30_000);

  it('getApiKey reads from config env var', () => {
    expect(adapter.testGetApiKey()).toBe('test-key-base');
  });

  it('getApiKey throws when env var is missing', () => {
    delete process.env.TEST_BASE_ADAPTER_KEY;
    expect(() => adapter.testGetApiKey()).toThrow(/Missing API key/);
    expect(() => adapter.testGetApiKey()).toThrow(/TEST_BASE_ADAPTER_KEY/);
  });

  it('computeCostCents formula is correct', () => {
    // costPer1MInput=100, costPer1MOutput=200
    // 500 input => 100/1_000_000 * 500 = 0.05
    // 250 output => 200/1_000_000 * 250 = 0.05
    // Total = 0.10
    const cost = adapter.testComputeCostCents('test-model', 500, 250);
    expect(cost).toBeCloseTo(0.1, 6);

    // Unknown model returns 0
    const unknownCost = adapter.testComputeCostCents('unknown-model', 500, 250);
    expect(unknownCost).toBe(0);
  });

  it('capabilities property returns configured array', () => {
    expect(adapter.capabilities).toEqual(['text', 'vision']);
    expect(adapter.name).toBe('TestProvider');
  });
});
