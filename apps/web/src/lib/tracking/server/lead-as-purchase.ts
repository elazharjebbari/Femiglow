/**
 * Lead → Meta Purchase (sans doublon) — cœur logique serveur.
 *
 * Audit : docs/meta-lead-as-purchase-2026-06-01/.
 *
 * Objectif : compter les leads chat + panier abandonné comme `Purchase` dans
 * les campagnes Meta optimisées Purchase, SANS doublon quand un vrai `purchase`
 * suit. Confusion VOLONTAIRE côté Meta uniquement (GA4/Ads inchangés).
 *
 * Mécanique :
 *  1. Lead éligible (`generate_lead` avec method ∈ SOURCES) → on traite l'event
 *     Meta comme `Purchase` (valeur = prix kit, déjà portée par l'event) et on
 *     marque le visiteur dans un ledger (TTL = fenêtre paramétrable).
 *  2. `purchase` suivant le même visiteur dans la fenêtre → on SKIP le provider
 *     Meta (le lead a déjà compté) → exactement 1 Purchase Meta.
 *  3. event_id de PARCOURS partagé (`deriveMetaPurchaseJourneyId`) → dédup
 *     native Meta en renfort (Pixel ↔ CAPI), même sans eventName commun.
 *
 * Tout est gardé par `META_LEAD_AS_PURCHASE_ENABLED` (défaut OFF).
 *
 * NB ledger : Map en mémoire (cohérent single-instance + tests). En prod
 * multi-lambda, brancher Redis derrière `LIVE_REDIS_STATE=v2` comme
 * `server/dedup.ts` (hook `markVisitorAsync`/`hasVisitorAsync`). Le flag étant
 * OFF par défaut, aucun impact prod tant que non activé + Redis branché.
 */
import { createHash } from 'node:crypto';
import { env } from '@/lib/env';

/** Sources de lead éligibles à la confusion Meta Purchase. */
export const META_LEAD_AS_PURCHASE_SOURCES: ReadonlySet<string> = new Set([
  'chat',
  'abandoned_cart',
]);

export function isMetaLeadAsPurchaseEnabled(): boolean {
  return env.META_LEAD_AS_PURCHASE_ENABLED === 'true';
}

export function dedupWindowMs(): number {
  return env.META_LEAD_PURCHASE_DEDUP_WINDOW_HOURS * 60 * 60 * 1000;
}

/**
 * Un event `generate_lead` est-il éligible (vient du chat ou du panier
 * abandonné) ? On lit le param `method` posé à l'émission.
 */
export function isEligibleLeadSource(method: unknown): boolean {
  return typeof method === 'string' && META_LEAD_AS_PURCHASE_SOURCES.has(method);
}

/**
 * event_id de PARCOURS — déterministe, basé sur `(visitorId, bucket fenêtre)`,
 * SANS `eventName`. Le lead-as-Purchase et le vrai purchase du même visiteur
 * dans la même fenêtre obtiennent le MÊME event_id → Meta déduplique
 * (Pixel ↔ CAPI ↔ lead/purchase). 32 chars hex (compatible Meta event_id).
 */
export function deriveMetaPurchaseJourneyId(
  visitorId: string,
  now: number = Date.now(),
): string {
  const bucket = Math.floor(now / dedupWindowMs());
  const material = `meta_purchase_journey|${visitorId}|${bucket}`;
  return createHash('sha256').update(material).digest('hex').slice(0, 32);
}

// ── Ledger « un lead-as-Purchase a déjà compté pour ce visiteur » ──────────
interface LedgerEntry {
  expiresAt: number;
}
const ledger = new Map<string, LedgerEntry>();
const MAX_ENTRIES = 50_000;

function evictExpired(now: number): void {
  for (const [key, entry] of ledger) {
    if (entry.expiresAt <= now) ledger.delete(key);
    else break;
  }
}

/** Marque le visiteur : un lead a compté comme Purchase Meta. */
export function recordLeadAsPurchase(visitorId: string, now: number = Date.now()): void {
  if (ledger.size >= MAX_ENTRIES) {
    evictExpired(now);
    if (ledger.size >= MAX_ENTRIES) {
      const oldest = ledger.keys().next().value;
      if (oldest) ledger.delete(oldest);
    }
  }
  ledger.set(visitorId, { expiresAt: now + dedupWindowMs() });
}

/** Un lead-as-Purchase a-t-il compté pour ce visiteur dans la fenêtre ? */
export function hasRecentLeadAsPurchase(visitorId: string, now: number = Date.now()): boolean {
  const entry = ledger.get(visitorId);
  if (!entry) return false;
  if (entry.expiresAt <= now) {
    ledger.delete(visitorId);
    return false;
  }
  return true;
}

/** Réinitialise le ledger (tests). */
export function __clearLeadAsPurchaseLedger(): void {
  ledger.clear();
}

/**
 * Décision Meta pour un (event × visiteur), pure (sans I/O réseau, lit le
 * ledger en mémoire). Centralise toute la logique → 1 point testable.
 *
 * Retour :
 *  - `{ action: 'as_purchase', journeyId }`  → traiter ce lead comme Purchase Meta.
 *  - `{ action: 'suppress' }`                → ne PAS envoyer ce purchase à Meta.
 *  - `{ action: 'passthrough', journeyId? }` → comportement normal (journeyId
 *      fourni pour le purchase afin de dédupliquer Pixel↔CAPI quand pertinent).
 */
export type MetaLeadDecision =
  | { action: 'as_purchase'; journeyId: string }
  | { action: 'suppress'; reason: string }
  | { action: 'passthrough'; journeyId?: string };

export function decideMetaForEvent(input: {
  eventName: string;
  method?: unknown;
  visitorId: string;
  now?: number;
}): MetaLeadDecision {
  const now = input.now ?? Date.now();
  if (!isMetaLeadAsPurchaseEnabled()) return { action: 'passthrough' };

  if (input.eventName === 'generate_lead' && isEligibleLeadSource(input.method)) {
    recordLeadAsPurchase(input.visitorId, now);
    return { action: 'as_purchase', journeyId: deriveMetaPurchaseJourneyId(input.visitorId, now) };
  }

  if (input.eventName === 'purchase') {
    if (hasRecentLeadAsPurchase(input.visitorId, now)) {
      return { action: 'suppress', reason: 'lead_already_counted' };
    }
    // Pas de lead préalable → purchase normal, mais on partage l'event_id de
    // parcours pour dédupliquer Pixel↔CAPI du même purchase.
    return { action: 'passthrough', journeyId: deriveMetaPurchaseJourneyId(input.visitorId, now) };
  }

  return { action: 'passthrough' };
}
