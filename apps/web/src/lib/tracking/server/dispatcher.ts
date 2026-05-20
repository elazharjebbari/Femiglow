import { listEnabledTrackingProviders } from '@/lib/db/queries/tracking/providers';
import type { TrackingProvider, TrackingProviderKind, TrackingProviderResult } from '@/lib/db/types';
import { getAdapter } from '@/lib/tracking/providers/registry';
import type { DispatchContext } from '@/lib/tracking/providers/types';
import { logger } from '@/lib/logging/logger';
import { resolveEventMapping } from '@/lib/tracking/mappings/resolver';
import { PROVIDER_KINDS_FOR_MAPPING } from '@/lib/tracking/mappings/types';
import { shouldDispatchByAttribution } from '@/lib/tracking/attribution/dispatch-gate';

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

  // Phase 4 — Pré-résoudre les mappings depuis event_mapping_versions (version active DB).
  // Les adapters peuvent lire ctx.resolvedMappings[kind].mappedName en priorité, et
  // fallback `mapEventName` du code legacy si absent. Best-effort : si le resolver
  // plante, ctx.resolvedMappings reste undefined → behaviour pré-migration intact.
  const resolved: NonNullable<DispatchContext['resolvedMappings']> = {};
  await Promise.all(
    PROVIDER_KINDS_FOR_MAPPING.map(async (kind) => {
      try {
        const r = await resolveEventMapping(ctx.eventName, kind);
        if (r) resolved[kind as TrackingProviderKind] = r;
      } catch (err) {
        logger.warn('tracking.dispatch.resolver_degraded', {
          kind,
          event_name: ctx.eventName,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }),
  );
  const ctxWithMappings: DispatchContext = { ...ctx, resolvedMappings: resolved };

  const tasks = providers.map(async (provider): Promise<[string, TrackingProviderResult] | null> => {
    const adapter = getAdapter(provider.kind);
    if (!adapter || !adapter.supports(ctx.eventName)) return null;
    if (!consentAllowsProvider(provider, ctx.consent)) {
      return [provider.kind, { status: 'skipped', latencyMs: 0, attempts: 0, error: 'consent_denied' }];
    }
    if (provider.enabledEvents.length > 0 && !provider.enabledEvents.includes(ctx.eventName)) {
      return [provider.kind, { status: 'skipped', latencyMs: 0, attempts: 0, error: 'event_disabled' }];
    }
    // Phase 2 — Gate attribution multi-canal. Skip si la stratégie
    // active n'attribue pas l'event à ce provider. Audience events et
    // providers neutres (GA4, GTM) sont toujours autorisés. Cf.
    // docs/tracking-attribution/.
    const gate = await shouldDispatchByAttribution({
      visitorId: ctx.anonymousId,
      providerKind: provider.kind,
      eventName: ctx.eventName,
    }).catch((err) => {
      logger.warn('tracking.dispatch.attribution_gate_degraded', {
        kind: provider.kind,
        event_name: ctx.eventName,
        error: err instanceof Error ? err.message : String(err),
      });
      // Fallback safe : on autorise si la gate est down (best-effort)
      return null;
    });
    if (gate && !gate.allowed) {
      logger.debug('tracking.dispatch.attribution_skip', {
        kind: provider.kind,
        event_name: ctx.eventName,
        reason: gate.reason,
        attributed_channel: gate.attributedChannel,
        strategy: gate.strategy,
      });
      return [
        provider.kind,
        {
          status: 'skipped',
          latencyMs: 0,
          attempts: 0,
          error: `attribution_skip:${gate.attributedChannel}`,
        },
      ];
    }
    try {
      const result = await adapter.dispatch(provider, ctxWithMappings);
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
