import type { ProviderCapability, ProviderConfig } from './types';
import { NoProviderAvailableError } from './types';
import { ProviderAdapter } from './adapters/base';
import { OpenAIAdapter } from './adapters/openai';
import { AnthropicAdapter } from './adapters/anthropic';
import { GoogleAdapter } from './adapters/google';
import { globalCostTracker } from './cost-tracker';

function createAdapter(config: ProviderConfig): ProviderAdapter {
  switch (config.type) {
    case 'openai':
      return new OpenAIAdapter(config);
    case 'anthropic':
      return new AnthropicAdapter(config);
    case 'google':
      return new GoogleAdapter(config);
    default:
      throw new Error(`Unsupported provider type: ${config.type}`);
  }
}

export class ProviderSelector {
  private readonly configs: ProviderConfig[];
  private readonly adapters = new Map<string, ProviderAdapter>();
  private readonly tenantId: string;

  constructor(configs: ProviderConfig[], tenantId = 'default') {
    this.configs = configs;
    this.tenantId = tenantId;
  }

  selectProvider(
    node: string,
    capability: ProviderCapability,
    budgetRemainingCents?: number,
  ): ProviderAdapter {
    const candidates = this.configs
      .filter((c) => c.isEnabled)
      .filter((c) => c.capabilities.includes(capability))
      .filter((c) => c.healthStatus !== 'unhealthy')
      .filter((c) => {
        const adapter = this.getOrCreateAdapter(c);
        return adapter['circuitBreaker'].getState() !== 'OPEN';
      })
      .filter((c) => {
        if (budgetRemainingCents === undefined) return true;
        return budgetRemainingCents > 0;
      })
      .filter((c) => {
        const spent = globalCostTracker.getDailySpend(this.tenantId);
        return spent < c.dailyBudgetCents;
      })
      .sort((a, b) => a.priority - b.priority);

    if (candidates.length === 0) {
      throw new NoProviderAvailableError(capability, node);
    }

    return this.getOrCreateAdapter(candidates[0]!);
  }

  selectFallback(
    node: string,
    capability: ProviderCapability,
    excludeProvider: string,
  ): ProviderAdapter {
    const candidates = this.configs
      .filter((c) => c.isEnabled)
      .filter((c) => c.id !== excludeProvider)
      .filter((c) => c.capabilities.includes(capability))
      .filter((c) => c.healthStatus !== 'unhealthy')
      .filter((c) => {
        const adapter = this.getOrCreateAdapter(c);
        return adapter['circuitBreaker'].getState() !== 'OPEN';
      })
      .sort((a, b) => {
        if (a.isFallback !== b.isFallback) return a.isFallback ? -1 : 1;
        return a.priority - b.priority;
      });

    if (candidates.length === 0) {
      throw new NoProviderAvailableError(capability, node);
    }

    return this.getOrCreateAdapter(candidates[0]!);
  }

  getAdapter(providerId: string): ProviderAdapter | undefined {
    const config = this.configs.find((c) => c.id === providerId);
    if (!config) return undefined;
    return this.getOrCreateAdapter(config);
  }

  listAvailable(capability: ProviderCapability): ProviderAdapter[] {
    return this.configs
      .filter((c) => c.isEnabled)
      .filter((c) => c.capabilities.includes(capability))
      .filter((c) => c.healthStatus !== 'unhealthy')
      .sort((a, b) => a.priority - b.priority)
      .map((c) => this.getOrCreateAdapter(c));
  }

  private getOrCreateAdapter(config: ProviderConfig): ProviderAdapter {
    const existing = this.adapters.get(config.id);
    if (existing) return existing;

    const adapter = createAdapter(config);
    this.adapters.set(config.id, adapter);
    return adapter;
  }
}
