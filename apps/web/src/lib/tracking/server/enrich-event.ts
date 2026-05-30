/**
 * Résolution authoritative de l'attribution canal côté serveur.
 *
 * Pourquoi server-side authoritative ?
 * ──────────────────────────────────────
 * Aujourd'hui le client annote `entry.attribution` mais le serveur ne le
 * persiste pas (bug audit #1). Demain : le serveur résout LUI-MÊME en
 * lisant l'attribution DB du visiteur + les signaux de la requête (cookies
 * `_fg_*`, `_fbp`, `_fbc`, header `referer`), et persiste `trafficSource`
 * + `trafficMedium` atomiquement dans `tracking_events_log`.
 *
 * Cela permet :
 *  - Source de vérité unique (la donnée écrite en DB est la donnée affichée)
 *  - Élimination de la confiance dans le client (cookies bloqués, JS désactivé)
 *  - Couverture des events server-only (webhooks Stripe, server-fire, etc.)
 *  - Backfill futur facile (re-run enrichEvent sur events NULL)
 *
 * Priorité de résolution (du plus fiable au moins fiable) :
 *  1. Attribution DB persistée (`visitor_attribution`) + strategy
 *  2. Request signals (cookies UTM, click IDs, referrer)
 *  3. Client hint (`entry.attribution` annoté par le client)
 *  4. Fallback `direct`
 *
 * Référence : `docs/attribution-fix-2026-05/02-vision-architecture.md`.
 */
import 'server-only';

import {
  bucketFromAttributionChannel,
  classifyTraffic,
  type TrafficBucket,
  type TrafficClassification,
} from '../taxonomy';
import { findAttributionByVisitor } from '../attribution/repository';
import { applyStrategy } from '../attribution/strategy';
import {
  DEFAULT_ATTRIBUTION_STRATEGY,
  type AttributionStrategy,
} from '../attribution/types';

import type { RequestSignals } from './request-signals';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface EnrichEventInput {
  /** Visitor ID stable (cookie `fg_session_id` ou `_fbp` fallback). */
  anonymousId: string | null;
  /** Hint client (depuis `entry.attribution`). Optionnel — peut être absent. */
  clientHint?: {
    channel?: string;
    isPaid?: boolean;
    utm?: { source?: string; medium?: string; campaign?: string };
  } | null;
  /** Signaux extraits de la requête HTTP courante. */
  requestSignals: RequestSignals;
  /** Stratégie d'attribution. Défaut : last_paid_touch. */
  strategy?: AttributionStrategy;
}

export interface EnrichedEvent {
  /** Bucket canal final (autoritatif, persisté dans tracking_events_log). */
  trafficSource: TrafficBucket;
  /** Medium normalisé (cpc, organic, email, ...). */
  trafficMedium: string;
  /** UTM résolu (peut venir de DB attribution OU request). */
  utm: {
    source?: string;
    medium?: string;
    campaign?: string;
    content?: string;
    term?: string;
  };
  /** Referrer HTTP (transmis tel quel pour audit/backfill). */
  referrer: string | null;
  /** `_fbp` Meta (pour CAPI). */
  fbp: string | null;
  /** `_fbc` Meta enrichi (pour CAPI Phase 2). */
  fbc: string | null;
  /** Click ID Google (pour Enhanced Conversions). */
  gclid: string | null;
  /** Classification détaillée (pour debug/observabilité). */
  classification: TrafficClassification;
  /** Source utilisée pour la résolution (pour debug). */
  resolutionSource: 'db_attribution' | 'request_signals' | 'client_hint' | 'fallback';
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolver principal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Résout l'attribution canal authoritatively. Cette function est le
 * point d'entrée unique de la couche enrichissement — appelée par
 * `/api/track` et `server-fire`.
 *
 * Côtés performants :
 *  - 1 lecture DB max (`findAttributionByVisitor`) — utilise `unstable_cache`
 *    par tag visiteur si la couche existe
 *  - Tout le reste est calcul pur côté CPU
 *  - Latence cible P95 < 50 ms
 */
export async function enrichEvent(input: EnrichEventInput): Promise<EnrichedEvent> {
  const strategy = input.strategy ?? DEFAULT_ATTRIBUTION_STRATEGY;

  // ── Étape 1 : tente la résolution depuis l'attribution DB ───────────
  if (input.anonymousId) {
    const stored = await findAttributionByVisitor(input.anonymousId);
    if (stored) {
      const resolvedTouch = applyStrategy(stored, strategy);
      // Le touch retourné par applyStrategy contient channel + is_paid + utm
      if (resolvedTouch.channel !== 'direct' || resolvedTouch.utm) {
        const bucket = bucketFromAttributionChannel(
          resolvedTouch.channel,
          resolvedTouch.is_paid,
        );
        return buildEnriched({
          trafficSource: bucket,
          trafficMedium: resolvedTouch.utm?.medium ?? deriveMediumFromBucket(bucket),
          utm: {
            source: resolvedTouch.utm?.source,
            medium: resolvedTouch.utm?.medium,
            campaign: resolvedTouch.utm?.campaign,
            content: resolvedTouch.utm?.content,
            term: resolvedTouch.utm?.term,
          },
          requestSignals: input.requestSignals,
          resolutionSource: 'db_attribution',
          classification: {
            bucket,
            source: resolvedTouch.utm?.source ?? resolvedTouch.channel,
            medium: resolvedTouch.utm?.medium ?? deriveMediumFromBucket(bucket),
            campaign: resolvedTouch.utm?.campaign,
            isPaid: resolvedTouch.is_paid,
            confidence: 'high',
          },
        });
      }
    }
  }

  // ── Étape 2 : tente depuis les request signals (cookies + referrer) ──
  const signalClassification = classifyTraffic({
    utm: input.requestSignals.utm,
    clickIds: input.requestSignals.clickIds,
    referrer: input.requestSignals.referrer,
  });
  if (signalClassification.bucket !== 'direct') {
    return buildEnriched({
      trafficSource: signalClassification.bucket,
      trafficMedium: signalClassification.medium,
      utm: {
        source: signalClassification.source,
        medium: signalClassification.medium,
        campaign: signalClassification.campaign,
        content: input.requestSignals.utm.content,
        term: input.requestSignals.utm.term,
      },
      requestSignals: input.requestSignals,
      resolutionSource: 'request_signals',
      classification: signalClassification,
    });
  }

  // ── Étape 3 : tente depuis le client hint (dernier recours signalé) ──
  if (input.clientHint?.channel) {
    const bucket = bucketFromAttributionChannel(
      input.clientHint.channel,
      input.clientHint.isPaid ?? false,
    );
    if (bucket !== 'unknown' && bucket !== 'direct') {
      return buildEnriched({
        trafficSource: bucket,
        trafficMedium: input.clientHint.utm?.medium ?? deriveMediumFromBucket(bucket),
        utm: {
          source: input.clientHint.utm?.source,
          medium: input.clientHint.utm?.medium,
          campaign: input.clientHint.utm?.campaign,
        },
        requestSignals: input.requestSignals,
        resolutionSource: 'client_hint',
        classification: {
          bucket,
          source: input.clientHint.utm?.source ?? input.clientHint.channel,
          medium: input.clientHint.utm?.medium ?? deriveMediumFromBucket(bucket),
          campaign: input.clientHint.utm?.campaign,
          isPaid: input.clientHint.isPaid ?? false,
          confidence: 'medium',
        },
      });
    }
  }

  // ── Étape 4 : fallback direct ──────────────────────────────────────
  return buildEnriched({
    trafficSource: 'direct',
    trafficMedium: 'none',
    utm: {},
    requestSignals: input.requestSignals,
    resolutionSource: 'fallback',
    classification: signalClassification, // direct + low confidence
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internes
// ─────────────────────────────────────────────────────────────────────────────

interface BuildInput {
  trafficSource: TrafficBucket;
  trafficMedium: string;
  utm: EnrichedEvent['utm'];
  requestSignals: RequestSignals;
  resolutionSource: EnrichedEvent['resolutionSource'];
  classification: TrafficClassification;
}

function buildEnriched(input: BuildInput): EnrichedEvent {
  return {
    trafficSource: input.trafficSource,
    trafficMedium: input.trafficMedium,
    utm: clean(input.utm),
    referrer: input.requestSignals.referrer,
    fbp: input.requestSignals.fbp,
    fbc: input.requestSignals.fbc,
    gclid: input.requestSignals.clickIds.gclid ?? null,
    classification: input.classification,
    resolutionSource: input.resolutionSource,
  };
}

function clean(utm: EnrichedEvent['utm']): EnrichedEvent['utm'] {
  const out: EnrichedEvent['utm'] = {};
  for (const [k, v] of Object.entries(utm)) {
    if (v && v.length > 0) out[k as keyof EnrichedEvent['utm']] = v;
  }
  return out;
}

/**
 * Dérive un medium par défaut depuis un bucket (utilisé quand on a un
 * bucket mais pas d'utm.medium explicite — ex: attribution DB sans UTM).
 */
function deriveMediumFromBucket(bucket: TrafficBucket): string {
  switch (bucket) {
    case 'paid_search':
    case 'paid_social':
      return 'cpc';
    case 'organic_search':
    case 'organic_social':
      return 'organic';
    case 'email':
      return 'email';
    case 'referral':
      return 'referral';
    case 'affiliate':
      return 'affiliate';
    case 'display':
      return 'display';
    case 'video':
      return 'video';
    case 'sms':
      return 'sms';
    case 'qr':
      return 'qrcode';
    case 'internal':
      return 'internal';
    case 'direct':
      return 'none';
    default:
      return 'unknown';
  }
}
