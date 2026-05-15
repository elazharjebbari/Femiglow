/**
 * Gate d'attribution serveur — décide si un dispatcher CAPI/server-side
 * doit fire pour un (visitor × provider × event) donné.
 *
 * Phase 2 du système d'attribution multi-canal. Cf.
 * docs/tracking-attribution/.
 *
 * Symétrique du filtrage GTM côté client (phase 1.4) :
 *  - audience events (page_view, view_item, …) → always allowed
 *  - conversion events → vérifie attribution.channel via la stratégie
 *    active
 *  - direct/organic/broadcast → broadcast partiel (allow tous pixels)
 *  - sinon → skip avec reason structuré (pour audit log)
 *
 * Le gate est pure-ish : il fait 2 lectures (settings + visitor_attr)
 * mais aucun side-effect. Idempotent.
 */
import 'server-only';
import { EVENT_CATALOG } from '@/lib/tracking/event-catalog';
import type { TrackingProviderKind } from '@/lib/db/types';
import { findAttributionByVisitor } from './repository';
import { getAttributionStrategy } from './server';
import { applyStrategy } from './strategy';
import type { AttributionChannel } from './types';

/**
 * Map provider kind → canal d'attribution attendu. Les providers
 * « neutres » (GA4 = analytics, GTM = orchestrateur) ne sont jamais
 * gatés — ils reçoivent toutes les conversions sans filtre.
 */
const PROVIDER_TO_CHANNEL: Record<TrackingProviderKind, AttributionChannel | null> = {
  meta: 'meta',
  google_ads: 'google_ads',
  google_ga4: null, // analytics neutre
  tiktok: 'tiktok',
  snap: 'snap',
  pinterest: 'pinterest',
  gtm: null, // orchestrateur, pas de dispatch propre
  custom: null, // webhooks customs : pas d'attribution gate par défaut
};

/**
 * Canaux où on broadcast à tous les pixels payants (politique défaut).
 * Visiteur sans canal identifiable OU stratégie broadcast OU pas de
 * snapshot serveur → on autorise tout le monde.
 */
const BROADCAST_CHANNELS = new Set<string>([
  'direct',
  'organic',
  'social_organic',
  'broadcast',
  'unknown',
]);

/** Set des events catalogués comme conversion (= isConversion: true). */
const CONVERSION_EVENT_NAMES = new Set(
  EVENT_CATALOG.filter((e) => e.isConversion).map((e) => e.name),
);

export interface AttributionGateResult {
  allowed: boolean;
  /** Pour debug / audit. Format `<reason>:<details>`. */
  reason: string;
  /** Canal résolu (utile pour les logs même quand allowed=true). */
  attributedChannel: string;
  /** Stratégie qui a tranché. */
  strategy: string;
}

export interface AttributionGateInput {
  visitorId: string;
  providerKind: TrackingProviderKind;
  eventName: string;
}

export async function shouldDispatchByAttribution(
  input: AttributionGateInput,
): Promise<AttributionGateResult> {
  const expectedChannel = PROVIDER_TO_CHANNEL[input.providerKind];
  const strategy = await getAttributionStrategy().catch(() => 'last_paid_touch' as const);

  // 1) Provider neutre (GA4, GTM) → always allowed
  if (expectedChannel === null) {
    return {
      allowed: true,
      reason: 'provider_neutral',
      attributedChannel: 'n/a',
      strategy,
    };
  }

  // 2) Audience event (isConversion=false) → always allowed
  // (alimente Lookalike + Custom Audiences sur tous les pixels)
  if (!CONVERSION_EVENT_NAMES.has(input.eventName)) {
    return {
      allowed: true,
      reason: 'audience_event',
      attributedChannel: 'n/a',
      strategy,
    };
  }

  // 3) Stratégie broadcast → tout le monde fire (déconseillé mais
  // possible). On lit la stratégie configurée par l'admin.
  if (strategy === 'broadcast') {
    return {
      allowed: true,
      reason: 'broadcast_strategy',
      attributedChannel: 'broadcast',
      strategy,
    };
  }

  // 4) Pas de snapshot serveur → broadcast partiel (visiteur très
  // récent, pas encore POSTé au /api/track/attribution). Best-effort :
  // on autorise plutôt que de risquer de manquer une conversion.
  const snapshot = await findAttributionByVisitor(input.visitorId);
  if (!snapshot) {
    return {
      allowed: true,
      reason: 'no_snapshot_broadcast',
      attributedChannel: 'unknown',
      strategy,
    };
  }

  // 5) Résolution de la stratégie sur le snapshot.
  const resolved = applyStrategy(snapshot, strategy);

  // 5a) Canal résolu = celui attendu par le provider → allow
  if (resolved.channel === expectedChannel) {
    return {
      allowed: true,
      reason: `match:${strategy}`,
      attributedChannel: resolved.channel,
      strategy,
    };
  }

  // 5b) Canal résolu = direct/organic/broadcast → fallback (allow)
  if (BROADCAST_CHANNELS.has(resolved.channel)) {
    return {
      allowed: true,
      reason: `fallback:${resolved.channel}`,
      attributedChannel: resolved.channel,
      strategy,
    };
  }

  // 5c) Canal résolu différent + payant identifié → skip
  return {
    allowed: false,
    reason: `attribution_skip:${resolved.channel}_vs_${expectedChannel}`,
    attributedChannel: resolved.channel,
    strategy,
  };
}

/**
 * Helper pur (sans I/O) — utile pour les tests + la simulation.
 * Réutilise la même logique que `shouldDispatchByAttribution` mais
 * accepte les inputs déjà résolus (pas de fetch DB / settings).
 */
export function decideAttribution(input: {
  resolvedChannel: AttributionChannel | 'broadcast' | 'unknown';
  providerKind: TrackingProviderKind;
  isConversionEvent: boolean;
  strategy: string;
}): AttributionGateResult {
  const expectedChannel = PROVIDER_TO_CHANNEL[input.providerKind];
  if (expectedChannel === null) {
    return {
      allowed: true,
      reason: 'provider_neutral',
      attributedChannel: 'n/a',
      strategy: input.strategy,
    };
  }
  if (!input.isConversionEvent) {
    return {
      allowed: true,
      reason: 'audience_event',
      attributedChannel: 'n/a',
      strategy: input.strategy,
    };
  }
  if (input.strategy === 'broadcast') {
    return {
      allowed: true,
      reason: 'broadcast_strategy',
      attributedChannel: 'broadcast',
      strategy: input.strategy,
    };
  }
  if (input.resolvedChannel === expectedChannel) {
    return {
      allowed: true,
      reason: `match:${input.strategy}`,
      attributedChannel: input.resolvedChannel,
      strategy: input.strategy,
    };
  }
  if (BROADCAST_CHANNELS.has(input.resolvedChannel)) {
    return {
      allowed: true,
      reason: `fallback:${input.resolvedChannel}`,
      attributedChannel: input.resolvedChannel,
      strategy: input.strategy,
    };
  }
  return {
    allowed: false,
    reason: `attribution_skip:${input.resolvedChannel}_vs_${expectedChannel}`,
    attributedChannel: input.resolvedChannel,
    strategy: input.strategy,
  };
}
