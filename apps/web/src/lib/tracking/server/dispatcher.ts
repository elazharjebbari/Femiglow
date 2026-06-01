import { listEnabledTrackingProviders } from '@/lib/db/queries/tracking/providers';
import type { TrackingProvider, TrackingProviderKind, TrackingProviderResult } from '@/lib/db/types';
import { getAdapter } from '@/lib/tracking/providers/registry';
import type { DispatchContext } from '@/lib/tracking/providers/types';
import { logger } from '@/lib/logging/logger';
import { resolveEventMapping } from '@/lib/tracking/mappings/resolver';
import { PROVIDER_KINDS_FOR_MAPPING } from '@/lib/tracking/mappings/types';
import { shouldDispatchByAttribution } from '@/lib/tracking/attribution/dispatch-gate';
import { decideMetaForEvent } from './lead-as-purchase';

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
    // ── Meta lead-as-purchase (audit meta-lead-as-purchase-2026-06-01) ──
    // Confusion VOLONTAIRE lead→Purchase côté Meta uniquement, sans doublon.
    // Décidé AVANT le gate attribution : un lead-as-Purchase est un signal
    // Purchase BROADCAST (comme `purchase`, cf. C3) donc non gaté. Flag OFF
    // par défaut → `passthrough` → comportement inchangé.
    let dispatchCtx: DispatchContext = ctxWithMappings;
    let skipAttributionGate = false;
    if (provider.kind === 'meta') {
      const decision = decideMetaForEvent({
        eventName: ctx.eventName,
        method: ctx.params.method,
        visitorId: ctx.anonymousId,
      });
      if (decision.action === 'suppress') {
        logger.debug('tracking.dispatch.lead_as_purchase_suppress', {
          event_name: ctx.eventName,
          visitor: ctx.anonymousId,
          reason: decision.reason,
        });
        return [
          provider.kind,
          { status: 'skipped', latencyMs: 0, attempts: 0, error: `lead_as_purchase_suppress:${decision.reason}` },
        ];
      }
      if (decision.action === 'as_purchase') {
        // On traite ce lead comme un Purchase Meta : nom overridé + event_id de
        // PARCOURS (dédup Pixel↔CAPI). On privilégie le `meta_purchase_eid` (jpid)
        // posé par le client (cookie de parcours) → MÊME eventID que le pixel
        // Purchase du lead ET que les autres signaux du parcours → Meta n'en
        // compte qu'UN. Fallback `journeyId` serveur si le client ne l'a pas porté.
        // La valeur (prix kit / panier) reste portée par `ctx.params`.
        const jpid =
          typeof ctx.params.meta_purchase_eid === 'string' && ctx.params.meta_purchase_eid.length > 0
            ? ctx.params.meta_purchase_eid
            : decision.journeyId;
        dispatchCtx = {
          ...ctxWithMappings,
          eventId: jpid,
          resolvedMappings: {
            ...ctxWithMappings.resolvedMappings,
            meta: { mappedName: 'Purchase', isCustom: false, notes: 'lead_as_purchase' },
          },
        };
        skipAttributionGate = true; // signal Purchase broadcast
      }
      // Achat NORMAL (passthrough) :
      //  - si un lead a précédé, le client porte le jpid de parcours
      //    (`meta_purchase_eid`) sur l'achat → on l'utilise comme `event_id` →
      //    la CAPI de l'achat réel déduplique avec le lead MÊME si le ledger
      //    serveur a été perdu (restart). Robustesse anti-doublon CAPI.
      //  - sinon (achat direct), on NE TOUCHE PAS à `event_id` : il reste
      //    l'`event_id` client (uuidv7), partagé avec le pixel `{{DLV - event_id}}`
      //    → dédup native Pixel↔CAPI standard (Fix A). Écraser par un journeyId
      //    cassait cette dédup (le client emit ne l'appliquait pas).
      else if (
        ctx.eventName === 'purchase' &&
        typeof ctx.params.meta_purchase_eid === 'string' &&
        ctx.params.meta_purchase_eid.length > 0
      ) {
        dispatchCtx = { ...ctxWithMappings, eventId: ctx.params.meta_purchase_eid };
      }
    }

    // Phase 2 — Gate attribution multi-canal. Skip si la stratégie
    // active n'attribue pas l'event à ce provider. Audience events et
    // providers neutres (GA4, GTM) sont toujours autorisés. Cf.
    // docs/tracking-attribution/.
    if (!skipAttributionGate) {
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
    }
    try {
      const result = await adapter.dispatch(provider, dispatchCtx);
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
