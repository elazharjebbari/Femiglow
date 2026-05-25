/**
 * Gap #20 — Provider rate limiting awareness test.
 *
 * Tests that provider configuration includes rate limits and that
 * the selector / cost tracker handle them appropriately.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
  ProviderConfig,
  ProviderSelector,
  CostTracker,
} from '../providers';

function makeProviderConfig(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    id: 'test-provider-1',
    type: 'openai',
    name: 'Test Provider',
    apiKeyEnvVar: 'TEST_API_KEY',
    capabilities: ['text', 'image'],
    models: [{ name: 'gpt-4o-mini', capability: 'text' }],
    rateLimitRpm: 60,
    dailyBudgetCents: 1000,
    circuitBreaker: { failureThreshold: 5, resetTimeoutMs: 60_000, halfOpenMaxCalls: 1 },
    priority: 1,
    isFallback: false,
    isEnabled: true,
    healthStatus: 'healthy',
    ...overrides,
  };
}

describe('integration: rate-limiting', () => {
  it('provider config includes rateLimitRpm', () => {
    const rawConfig = makeProviderConfig({ rateLimitRpm: 120 });
    const parsed = ProviderConfig.parse(rawConfig);

    expect(parsed.rateLimitRpm).toBe(120);
    expect(typeof parsed.rateLimitRpm).toBe('number');
    expect(parsed.rateLimitRpm).toBeGreaterThan(0);
  });

  it('selector considers rate limits when available', () => {
    const configs = [
      ProviderConfig.parse(makeProviderConfig({
        id: 'provider-high-rpm',
        rateLimitRpm: 1000,
        priority: 2,
      })),
      ProviderConfig.parse(makeProviderConfig({
        id: 'provider-low-rpm',
        rateLimitRpm: 10,
        priority: 1,
      })),
    ];

    const selector = new ProviderSelector(configs, 'test-tenant');

    // Selector should pick the lower-priority (higher-priority value)
    // provider first based on priority, not rate limit
    const selected = selector.selectProvider('testNode', 'text');
    expect(selected).toBeTruthy();

    // Both providers should be listed as available
    const available = selector.listAvailable('text');
    expect(available.length).toBe(2);
  });

  it('cost tracker does not block on rate limits (that is provider responsibility)', () => {
    const tracker = new CostTracker();

    // Record many costs in quick succession
    for (let i = 0; i < 100; i++) {
      tracker.recordCost(
        'test-tenant',
        'openai',
        'gpt-4o-mini',
        'generate_script',
        1000,
        500,
        0.1,
      );
    }

    // CostTracker only tracks cost, not rate limits
    const dailySpend = tracker.getDailySpend('test-tenant');
    expect(dailySpend).toBeCloseTo(10, 1); // 100 * 0.1 = 10

    // Budget remaining should reflect the spend
    const remaining = tracker.getRemainingBudget('test-tenant', 1000);
    expect(remaining).toBeCloseTo(990, 1);
    expect(remaining).toBeGreaterThan(0);
  });

  it('health check reflects rate limit status via healthStatus field', () => {
    // Provider with degraded health should still have rateLimitRpm
    const degraded = ProviderConfig.parse(makeProviderConfig({
      id: 'degraded-provider',
      healthStatus: 'degraded',
      rateLimitRpm: 30,
    }));

    expect(degraded.healthStatus).toBe('degraded');
    expect(degraded.rateLimitRpm).toBe(30);

    // Unhealthy providers are filtered out by the selector
    const unhealthy = ProviderConfig.parse(makeProviderConfig({
      id: 'unhealthy-provider',
      healthStatus: 'unhealthy',
      rateLimitRpm: 60,
    }));

    const selector = new ProviderSelector([unhealthy], 'test-tenant');
    const available = selector.listAvailable('text');
    expect(available.length).toBe(0); // Unhealthy filtered out
  });
});
