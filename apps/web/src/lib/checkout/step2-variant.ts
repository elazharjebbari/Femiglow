/**
 * Étape 2 du wizard — variante vécue (`control` | `v2`).
 *
 * Module pur. L'attribution se fait côté client, comme `commander-mode` : elle
 * est stable par visiteur (hash de `fg_aid`). L'étape 2 n'est jamais dans le
 * rendu serveur, le choix ne provoque donc ni clignotement ni écart
 * d'hydratation. V2 pour toutes par défaut ; part CMS à 0 : retour à `control`.
 */

import { assignVariant } from '@/lib/chat/services/ab-engine';
import type { Step2Variant } from '@/lib/tracking/address-step-events';

/** Clé d'expérience : ne JAMAIS la changer après lancement (re-mélange). */
export const STEP2_EXPERIMENT_KEY = 'kit-step2-v2';
/** Paramètre d'URL qui force la variante (`?step2=v2`), pour la recette. */
export const STEP2_QUERY_PARAM = 'step2';
export const DEFAULT_STEP2_V2_SHARE_PCT = 100;

export function parseStep2Override(raw: unknown): Step2Variant | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  return v === 'v2' || v === 'control' ? v : null;
}

/**
 * Part bornée. Champ absent (composant pas encore synchronisé) : réglage par
 * défaut. Valeur illisible : retour à la version la mieux connue, `control`.
 */
export function normalizeStep2SharePct(raw: unknown): number {
  if (raw === null || raw === undefined) return DEFAULT_STEP2_V2_SHARE_PCT;
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  if (typeof n !== 'number' || !Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/** `fg_aid` utile seulement si un vrai tirage a lieu. */
export function step2NeedsVisitor(sharePct: number, override: unknown): boolean {
  return !parseStep2Override(override) && sharePct > 0 && sharePct < 100;
}

export interface ResolveStep2VariantInput {
  sharePct: number;
  override?: unknown;
  visitorId?: string | null;
}

export function resolveStep2Variant({
  sharePct,
  override,
  visitorId,
}: ResolveStep2VariantInput): Step2Variant {
  const forced = parseStep2Override(override);
  if (forced) return forced;
  const pct = normalizeStep2SharePct(sharePct);
  if (pct <= 0) return 'control';
  if (pct >= 100) return 'v2';
  if (!visitorId) return 'control';
  const variant = assignVariant(STEP2_EXPERIMENT_KEY, visitorId, [
    { key: 'v2', weight: pct / 100 },
  ]);
  return variant === 'v2' ? 'v2' : 'control';
}
