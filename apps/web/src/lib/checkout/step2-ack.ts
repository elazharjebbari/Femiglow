/**
 * Étape 2 du wizard — accusé de réception (« C'est noté, on vous appelle »).
 *
 * Le numéro saisi à l'étape 1 part au CRM même si la cliente ne termine pas :
 * l'accusé le lui dit, pour que l'appel ne la surprenne pas. Conception :
 * docs/kit-etape2-accuse/.
 *
 * Module pur. Même mécanique que `step2-variant` : tirage stable par visiteur
 * (hash de `fg_aid`), côté client, l'étape 2 n'étant jamais rendue côté
 * serveur. Affiché pour toutes par défaut ; part CMS à 0 : coupe-circuit.
 */

import { assignVariant } from '@/lib/chat/services/ab-engine';
import { normalizeStep2SharePct } from '@/lib/checkout/step2-variant';

/** Clé d'expérience : ne JAMAIS la changer après lancement (re-mélange). */
export const STEP2_ACK_EXPERIMENT_KEY = 'kit-step2-ack';
/** Paramètre d'URL qui force l'affichage (`?ack=on`, `?ack=off`), pour la recette. */
export const STEP2_ACK_QUERY_PARAM = 'ack';
export const DEFAULT_STEP2_ACK_SHARE_PCT = 100;

export function parseStep2AckOverride(raw: unknown): boolean | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  if (v === 'on') return true;
  if (v === 'off') return false;
  return null;
}

/** Champ absent : affiché pour toutes. Valeur illisible : rien (version connue). */
export const normalizeStep2AckSharePct = normalizeStep2SharePct;

/** `fg_aid` utile seulement si un vrai tirage a lieu. */
export function step2AckNeedsVisitor(sharePct: number, override: unknown): boolean {
  return parseStep2AckOverride(override) === null && sharePct > 0 && sharePct < 100;
}

export interface ResolveStep2AckInput {
  sharePct: number;
  override?: unknown;
  visitorId?: string | null;
}

export function resolveStep2Ack({ sharePct, override, visitorId }: ResolveStep2AckInput): boolean {
  const forced = parseStep2AckOverride(override);
  if (forced !== null) return forced;
  const pct = normalizeStep2AckSharePct(sharePct);
  if (pct <= 0) return false;
  if (pct >= 100) return true;
  if (!visitorId) return false;
  return (
    assignVariant(STEP2_ACK_EXPERIMENT_KEY, visitorId, [{ key: 'ack', weight: pct / 100 }]) === 'ack'
  );
}
