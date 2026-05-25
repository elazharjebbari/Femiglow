import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ProviderConfig } from './types';
import { NoProviderAvailableError } from './types';
import { ProviderSelector } from './selector';
import { globalCostTracker } from './cost-tracker';

// ---------------------------------------------------------------------------
// Mock the adapter modules to avoid real API connections.
// We need to mock the adapters but keep the selector logic real.
// ---------------------------------------------------------------------------

// The circuit breaker default returns CLOSED, which is what we want.
// We need to mock globalCostTracker so we can control daily spend.
vi.mock('./cost-tracker', () => {
  const tracker = {
    getDailySpend: vi.fn().mockReturnValue(0),
    getRemainingBudget: vi.fn().mockReturnValue(1000),
    recordCost: vi.fn(),
  };
  return { globalCostTracker: tracker };
});

// ---------------------------------------------------------------------------
// Test provider configs
// ---------------------------------------------------------------------------

function makeProviderConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: 'openai-1',
    type: 'openai',
    name: 'OpenAI Primary',
    apiKeyEnvVar: 'OPENAI_API_KEY',
    capabilities: ['text', 'image', 'embedding'],
    models: [
      { name: 'gpt-4', capability: 'text', costPer1MInput: 300, costPer1MOutput: 600 },
      { name: 'dall-e-3', capability: 'image', costPerUnit: 4 },
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ProviderSelector', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    (globalCostTracker.getDailySpend as ReturnType<typeof vi.fn>).mockReturnValue(0);
  });

  it('selectProvider returns a provider for text capability', () => {
    const configs = [makeProviderConfig()];
    const selector = new ProviderSelector(configs, 'tenant-1');

    const provider = selector.selectProvider('generateScript', 'text');
    expect(provider).toBeDefined();
    expect(provider.name).toBe('OpenAI Primary');
  });

  it('selectProvider returns mock for image when configured as mock', () => {
    const configs = [
      makeProviderConfig({
        id: 'openai-img',
        capabilities: ['image'],
        name: 'OpenAI Images',
      }),
    ];
    const selector = new ProviderSelector(configs, 'tenant-1');

    const provider = selector.selectProvider('generateImages', 'image');
    expect(provider).toBeDefined();
    expect(provider.capabilities).toContain('image');
  });

  it('selectProvider filters out circuit-broken providers', async () => {
    const configs = [
      makeProviderConfig({ id: 'openai-broken', priority: 1, name: 'Broken', circuitBreaker: { failureThreshold: 2, resetTimeoutMs: 60000, halfOpenMaxCalls: 1 } }),
      makeProviderConfig({ id: 'anthropic-ok', priority: 2, type: 'anthropic', name: 'Anthropic OK', capabilities: ['text'] }),
    ];
    const selector = new ProviderSelector(configs, 'tenant-1');

    // Trip the circuit breaker on the first provider by getting the adapter
    // and directly manipulating its circuit breaker
    const brokenAdapter = selector.selectProvider('test', 'text');
    const cb = (brokenAdapter as unknown as Record<string, unknown>)['circuitBreaker'] as {
      execute: <T>(fn: () => Promise<T>) => Promise<T>;
    };
    // Trigger failures sequentially to open the circuit (threshold=2)
    for (let i = 0; i < 2; i++) {
      try {
        await cb.execute(async () => { throw new Error('fail'); });
      } catch {
        // expected
      }
    }

    // Now the second provider should be selected since the first is circuit-broken
    const provider = selector.selectProvider('test', 'text');
    expect(provider.name).toBe('Anthropic OK');
  });

  it('selectProvider filters out unhealthy providers', () => {
    const configs = [
      makeProviderConfig({ id: 'unhealthy-1', healthStatus: 'unhealthy', priority: 1, name: 'Unhealthy' }),
      makeProviderConfig({ id: 'healthy-1', healthStatus: 'healthy', priority: 2, name: 'Healthy' }),
    ];
    const selector = new ProviderSelector(configs, 'tenant-1');

    const provider = selector.selectProvider('test', 'text');
    expect(provider.name).toBe('Healthy');
  });

  it('selectProvider sorts by priority (lower number = higher priority)', () => {
    const configs = [
      makeProviderConfig({ id: 'low-prio', priority: 10, name: 'Low Priority' }),
      makeProviderConfig({ id: 'high-prio', priority: 1, name: 'High Priority' }),
    ];
    const selector = new ProviderSelector(configs, 'tenant-1');

    const provider = selector.selectProvider('test', 'text');
    expect(provider.name).toBe('High Priority');
  });

  it('selectProvider falls back when primary is unavailable', () => {
    const configs = [
      makeProviderConfig({ id: 'primary', priority: 1, name: 'Primary', isEnabled: false }),
      makeProviderConfig({ id: 'secondary', priority: 2, name: 'Secondary' }),
    ];
    const selector = new ProviderSelector(configs, 'tenant-1');

    const provider = selector.selectProvider('test', 'text');
    expect(provider.name).toBe('Secondary');
  });

  it('selectProvider throws NoProviderAvailableError when none available', () => {
    const configs = [
      makeProviderConfig({ id: 'disabled', isEnabled: false }),
    ];
    const selector = new ProviderSelector(configs, 'tenant-1');

    expect(() => selector.selectProvider('test', 'text')).toThrow(NoProviderAvailableError);
  });

  it('selectFallback excludes specified provider', () => {
    const configs = [
      makeProviderConfig({ id: 'provider-a', priority: 1, name: 'Provider A' }),
      makeProviderConfig({ id: 'provider-b', priority: 2, name: 'Provider B', type: 'anthropic' }),
    ];
    const selector = new ProviderSelector(configs, 'tenant-1');

    const fallback = selector.selectFallback('test', 'text', 'provider-a');
    expect(fallback.name).toBe('Provider B');
  });

  it('selectFallback prefers isFallback providers', () => {
    const configs = [
      makeProviderConfig({ id: 'primary', priority: 1, name: 'Primary' }),
      makeProviderConfig({ id: 'normal', priority: 2, name: 'Normal', type: 'anthropic' }),
      makeProviderConfig({ id: 'fallback-provider', priority: 3, name: 'Fallback', isFallback: true, type: 'google' }),
    ];
    const selector = new ProviderSelector(configs, 'tenant-1');

    const fallback = selector.selectFallback('test', 'text', 'primary');
    expect(fallback.name).toBe('Fallback');
  });

  it('selectProvider respects budget filtering', () => {
    // Provider with a 100 cent daily budget, but we've already spent 200
    (globalCostTracker.getDailySpend as ReturnType<typeof vi.fn>).mockReturnValue(200);

    const configs = [
      makeProviderConfig({ id: 'over-budget', dailyBudgetCents: 100, priority: 1, name: 'Over Budget' }),
      makeProviderConfig({ id: 'has-budget', dailyBudgetCents: 500, priority: 2, name: 'Has Budget', type: 'anthropic' }),
    ];
    const selector = new ProviderSelector(configs, 'tenant-1');

    const provider = selector.selectProvider('test', 'text');
    expect(provider.name).toBe('Has Budget');
  });
});
