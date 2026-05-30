import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ProviderConfig } from './types';
import { NoProviderAvailableError } from './types';
import { ProviderSelector } from './selector';
import { HiggsFieldAdapter } from './adapters/higgsfield';
import { globalCostTracker } from './cost-tracker';

// ---------------------------------------------------------------------------
// Mock cost tracker
// ---------------------------------------------------------------------------

vi.mock('./cost-tracker', () => {
  const tracker = {
    getDailySpend: vi.fn().mockReturnValue(0),
    getRemainingBudget: vi.fn().mockReturnValue(1000),
    recordCost: vi.fn(),
  };
  return { globalCostTracker: tracker };
});

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

function makeHiggsFieldConfig(
  overrides: Partial<ProviderConfig> = {},
): ProviderConfig {
  return {
    id: 'higgsfield-1',
    type: 'higgsfield',
    name: 'Higgsfield',
    apiKeyEnvVar: 'TEST_HIGGSFIELD_API_KEY',
    capabilities: ['image', 'video'],
    models: [
      { name: 'hf-image-v1', capability: 'image', costPerUnit: 3 },
      { name: 'hf-video-v1', capability: 'video', costPerUnit: 25 },
    ],
    rateLimitRpm: 30,
    dailyBudgetCents: 500,
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeoutMs: 60_000,
      halfOpenMaxCalls: 1,
    },
    priority: 1,
    isFallback: false,
    isEnabled: true,
    healthStatus: 'healthy',
    ...overrides,
  } as ProviderConfig;
}

function makeOpenAIConfig(
  overrides: Partial<ProviderConfig> = {},
): ProviderConfig {
  return {
    id: 'openai-1',
    type: 'openai',
    name: 'OpenAI',
    apiKeyEnvVar: 'TEST_OPENAI_API_KEY',
    capabilities: ['text', 'image', 'embedding'],
    models: [
      {
        name: 'gpt-4',
        capability: 'text',
        costPer1MInput: 300,
        costPer1MOutput: 600,
      },
      { name: 'dall-e-3', capability: 'image', costPerUnit: 4 },
    ],
    rateLimitRpm: 60,
    dailyBudgetCents: 1000,
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeoutMs: 60_000,
      halfOpenMaxCalls: 1,
    },
    priority: 2,
    isFallback: false,
    isEnabled: true,
    healthStatus: 'healthy',
    ...overrides,
  } as ProviderConfig;
}

function makeAnthropicConfig(
  overrides: Partial<ProviderConfig> = {},
): ProviderConfig {
  return {
    id: 'anthropic-1',
    type: 'anthropic',
    name: 'Anthropic',
    apiKeyEnvVar: 'TEST_ANTHROPIC_API_KEY',
    capabilities: ['text'],
    models: [
      {
        name: 'claude-sonnet-4-20250514',
        capability: 'text',
        costPer1MInput: 300,
        costPer1MOutput: 1500,
      },
    ],
    rateLimitRpm: 60,
    dailyBudgetCents: 1000,
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeoutMs: 60_000,
      halfOpenMaxCalls: 1,
    },
    priority: 3,
    isFallback: false,
    isEnabled: true,
    healthStatus: 'healthy',
    ...overrides,
  } as ProviderConfig;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProviderSelector — Higgsfield integration', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (
      globalCostTracker.getDailySpend as ReturnType<typeof vi.fn>
    ).mockReturnValue(0);
  });

  it('createAdapter("higgsfield") returns HiggsFieldAdapter instance', () => {
    const configs = [makeHiggsFieldConfig()];
    const selector = new ProviderSelector(configs, 'tenant-1');

    const adapter = selector.selectProvider('test', 'image');

    expect(adapter).toBeInstanceOf(HiggsFieldAdapter);
  });

  it('selectProvider with "image" capability returns Higgsfield when highest priority', () => {
    const configs = [
      makeHiggsFieldConfig({ priority: 1 }),
      makeOpenAIConfig({ priority: 2 }),
    ];
    const selector = new ProviderSelector(configs, 'tenant-1');

    const provider = selector.selectProvider('generateImages', 'image');

    expect(provider.name).toBe('Higgsfield');
    expect(provider).toBeInstanceOf(HiggsFieldAdapter);
  });

  it('selectProvider with "video" capability returns Higgsfield', () => {
    const configs = [
      makeHiggsFieldConfig(),
      makeOpenAIConfig(),
      makeAnthropicConfig(),
    ];
    const selector = new ProviderSelector(configs, 'tenant-1');

    const provider = selector.selectProvider('generateVideo', 'video');

    expect(provider.name).toBe('Higgsfield');
  });

  it('selectProvider skips Higgsfield when disabled', () => {
    const configs = [
      makeHiggsFieldConfig({ isEnabled: false, priority: 1 }),
      makeOpenAIConfig({ priority: 2, capabilities: ['image'] }),
    ];
    const selector = new ProviderSelector(configs, 'tenant-1');

    const provider = selector.selectProvider('generateImages', 'image');

    expect(provider.name).toBe('OpenAI');
  });

  it('selectProvider skips Higgsfield when unhealthy', () => {
    const configs = [
      makeHiggsFieldConfig({ healthStatus: 'unhealthy', priority: 1 }),
      makeOpenAIConfig({ priority: 2, capabilities: ['image'] }),
    ];
    const selector = new ProviderSelector(configs, 'tenant-1');

    const provider = selector.selectProvider('generateImages', 'image');

    expect(provider.name).toBe('OpenAI');
  });

  it('selectProvider skips Higgsfield when budget exceeded', () => {
    (
      globalCostTracker.getDailySpend as ReturnType<typeof vi.fn>
    ).mockReturnValue(600);

    const configs = [
      makeHiggsFieldConfig({ dailyBudgetCents: 500, priority: 1 }),
      makeOpenAIConfig({
        priority: 2,
        dailyBudgetCents: 1000,
        capabilities: ['image'],
      }),
    ];
    const selector = new ProviderSelector(configs, 'tenant-1');

    const provider = selector.selectProvider('generateImages', 'image');

    expect(provider.name).toBe('OpenAI');
  });

  it('Higgsfield as fallback when primary fails', () => {
    const configs = [
      makeOpenAIConfig({
        id: 'openai-primary',
        priority: 1,
        capabilities: ['image'],
      }),
      makeHiggsFieldConfig({
        id: 'higgsfield-fallback',
        priority: 2,
        isFallback: true,
      }),
    ];
    const selector = new ProviderSelector(configs, 'tenant-1');

    const fallback = selector.selectFallback(
      'generateImages',
      'image',
      'openai-primary',
    );

    expect(fallback.name).toBe('Higgsfield');
    expect(fallback).toBeInstanceOf(HiggsFieldAdapter);
  });

  it('multiple providers with image capability — priority ordering', () => {
    const configs = [
      makeOpenAIConfig({
        id: 'openai-img',
        priority: 5,
        capabilities: ['image'],
        name: 'OpenAI Images',
      }),
      makeHiggsFieldConfig({ id: 'hf-img', priority: 1, name: 'HF Images' }),
      makeOpenAIConfig({
        id: 'stability-img',
        priority: 3,
        capabilities: ['image'],
        name: 'Stability',
        type: 'openai',
      }),
    ];
    const selector = new ProviderSelector(configs, 'tenant-1');

    const provider = selector.selectProvider('generateImages', 'image');

    // HF has priority 1 (lowest = highest priority)
    expect(provider.name).toBe('HF Images');
  });

  it('createAdapter throws for unknown type', () => {
    const badConfig = {
      ...makeOpenAIConfig(),
      type: 'nonexistent' as ProviderConfig['type'],
    };

    const selector = new ProviderSelector(
      [badConfig as ProviderConfig],
      'tenant-1',
    );

    expect(() =>
      selector.selectProvider('test', 'text'),
    ).toThrow(/Unsupported provider type/);
  });

  it('selectProvider for "text" does NOT return Higgsfield', () => {
    const configs = [
      makeHiggsFieldConfig({ priority: 1 }),
      makeAnthropicConfig({ priority: 2 }),
    ];
    const selector = new ProviderSelector(configs, 'tenant-1');

    const provider = selector.selectProvider('generateScript', 'text');

    // Higgsfield does not have 'text' capability, so Anthropic should be selected
    expect(provider.name).toBe('Anthropic');
  });

  it('listAvailable for "video" includes Higgsfield', () => {
    const configs = [
      makeHiggsFieldConfig(),
      makeOpenAIConfig(),
      makeAnthropicConfig(),
    ];
    const selector = new ProviderSelector(configs, 'tenant-1');

    const available = selector.listAvailable('video');

    expect(available).toHaveLength(1);
    expect(available[0]!.name).toBe('Higgsfield');
  });

  it('getAdapter returns Higgsfield adapter by ID', () => {
    const configs = [makeHiggsFieldConfig({ id: 'hf-specific' })];
    const selector = new ProviderSelector(configs, 'tenant-1');

    const adapter = selector.getAdapter('hf-specific');

    expect(adapter).toBeDefined();
    expect(adapter).toBeInstanceOf(HiggsFieldAdapter);
  });

  it('throws NoProviderAvailableError when only Higgsfield available but capability is text', () => {
    const configs = [makeHiggsFieldConfig()];
    const selector = new ProviderSelector(configs, 'tenant-1');

    expect(() =>
      selector.selectProvider('generateScript', 'text'),
    ).toThrow(NoProviderAvailableError);
  });
});
