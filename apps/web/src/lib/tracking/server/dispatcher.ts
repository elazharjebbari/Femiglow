import { listEnabledTrackingProviders } from '@/lib/db/queries/tracking/providers';
import type { TrackingProvider, TrackingProviderResult } from '@/lib/db/types';
import { getAdapter } from '@/lib/tracking/providers/registry';
import type { DispatchContext } from '@/lib/tracking/providers/types';
import { logger } from '@/lib/logging/logger';

export interface DispatchOutcome {
  dispatched: string[];
  results: Record<string, TrackingProviderResult>;
}

function consentAllowsProvider(
  provider: TrackingProvider,
  consent: DispatchContext['consent'],
): boolean {
  switch (provider.kind) {
    case 'google_ga4':
      return consent.analytics_storage === 'granted';
    case 'meta':
    case 'tiktok':
    case 'snap':
    case 'pinterest':
    case 'google_ads':
      return consent.ad_storage === 'granted';
    case 'gtm':
      return consent.functional_storage === 'granted';
    case 'custom':
      return consent.functional_storage === 'granted';
    default:
      return false;
  }
}

export async function dispatchToProviders(ctx: DispatchContext): Promise<DispatchOutcome> {
  const providers = await listEnabledTrackingProviders();
  const tasks = providers.map(async (provider): Promise<[string, TrackingProviderResult] | null> => {
    const adapter = getAdapter(provider.kind);
    if (!adapter || !adapter.supports(ctx.eventName)) return null;
    if (!consentAllowsProvider(provider, ctx.consent)) {
      return [provider.kind, { status: 'skipped', latencyMs: 0, attempts: 0, error: 'consent_denied' }];
    }
    if (provider.enabledEvents.length > 0 && !provider.enabledEvents.includes(ctx.eventName)) {
      return [provider.kind, { status: 'skipped', latencyMs: 0, attempts: 0, error: 'event_disabled' }];
    }
    try {
      const result = await adapter.dispatch(provider, ctx);
      return [provider.kind, result];
    } catch (err) {
      logger.error('tracking.dispatch.adapter_threw', {
        kind: provider.kind,
        event_name: ctx.eventName,
        error: err instanceof Error ? err.message : String(err),
      });
      return [
        provider.kind,
        {
          status: 'failed',
          latencyMs: 0,
          attempts: 0,
          error: err instanceof Error ? err.message : 'unknown',
        },
      ];
    }
  });
  const settled = await Promise.allSettled(tasks);
  const results: Record<string, TrackingProviderResult> = {};
  const dispatched: string[] = [];
  for (const item of settled) {
    if (item.status === 'fulfilled' && item.value) {
      const [kind, result] = item.value;
      results[kind] = result;
      if (result.status === 'sent') dispatched.push(kind);
    }
  }
  return { dispatched, results };
}
