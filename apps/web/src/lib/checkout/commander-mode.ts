/**
 * Kit CRO v2 §2 — Mode d'ouverture du formulaire « Commander » sur /kit.
 *
 * Deux expériences possibles derrière tous les boutons « Commander » :
 *  - `scroll` : défilement jusqu'à `#commander-femiglow` (comportement
 *    historique, `arriveAtCommander`) ;
 *  - `sheet`  : le formulaire s'ouvre dans un panneau en bas d'écran.
 *
 * Réglage piloté depuis l'admin (composant CMS `kit-checkout`) :
 *  - `ctaMode` = `scroll` | `sheet` | `ab` ;
 *  - `sheetSharePct` (0–100) = part des visiteurs en `sheet` quand `ab`.
 *
 * En `ab`, l'attribution est faite CÔTÉ CLIENT et reste stable par visiteur :
 * hash FNV-1a de l'identifiant anonyme `fg_aid` (`assignVariant`). Le
 * paramètre d'URL `?cta=sheet|scroll` force la variante (recette, e2e).
 *
 * Module pur (aucune dépendance React/DOM) : importable côté serveur
 * (`kit-checkout-config`). Le hook client `useCommanderMode`
 * (`use-commander-mode.ts`) ne fait que lui fournir l'URL et le `fg_aid`.
 */

import { assignVariant } from '@/lib/chat/services/ab-engine';

/** Expérience réellement vécue par le visiteur. */
export type CommanderMode = 'scroll' | 'sheet';
/** Réglage admin (`kit-checkout.ctaMode`). */
export type CommanderCmsMode = CommanderMode | 'ab';

/** Clé d'expérience : ne JAMAIS la changer après lancement (re-mélange). */
export const KIT_CTA_SHEET_EXPERIMENT_KEY = 'kit_cta_sheet_v1';
/** Paramètre d'URL qui force la variante (`?cta=sheet`). */
export const COMMANDER_MODE_QUERY_PARAM = 'cta';
/** Valeurs par défaut du composant CMS `kit-checkout`. */
export const DEFAULT_COMMANDER_CMS_MODE: CommanderCmsMode = 'scroll';
export const DEFAULT_SHEET_SHARE_PCT = 50;

const CMS_MODES: ReadonlySet<string> = new Set(['scroll', 'sheet', 'ab']);

export function isCommanderCmsMode(value: unknown): value is CommanderCmsMode {
  return typeof value === 'string' && CMS_MODES.has(value);
}

/** `?cta=` → variante forcée, ou `null` si absente / inconnue. */
export function parseCommanderOverride(raw: unknown): CommanderMode | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim().toLowerCase();
  return v === 'sheet' || v === 'scroll' ? v : null;
}

/**
 * Part (0–100) bornée. Une valeur non numérique retombe sur le défaut :
 * mieux vaut le 50/50 documenté qu'un test silencieusement à 0 %.
 */
export function normalizeSharePct(raw: unknown): number {
  const n = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : raw;
  if (typeof n !== 'number' || !Number.isFinite(n)) return DEFAULT_SHEET_SHARE_PCT;
  return Math.min(100, Math.max(0, n));
}

export interface ResolveCommanderModeInput {
  /** Réglage admin ; inconnu → `scroll`. */
  cmsMode: unknown;
  /** Part `sheet` en mode `ab` (0–100). */
  sharePct?: unknown;
  /** Valeur brute de `?cta=` (prioritaire sur tout le reste). */
  override?: unknown;
  /** Identifiant anonyme stable (`fg_aid`). Absent → témoin `scroll`. */
  visitorId?: string | null;
}

export function resolveCommanderMode({
  cmsMode,
  sharePct,
  override,
  visitorId,
}: ResolveCommanderModeInput): CommanderMode {
  const forced = parseCommanderOverride(override);
  if (forced) return forced;

  const mode = isCommanderCmsMode(cmsMode) ? cmsMode : DEFAULT_COMMANDER_CMS_MODE;
  if (mode !== 'ab') return mode;

  const pct = normalizeSharePct(sharePct);
  if (pct <= 0) return 'scroll';
  if (pct >= 100) return 'sheet';
  // Sans identifiant (stockage bloqué, SSR) : on reste sur le témoin plutôt
  // que de tirer au hasard à chaque rendu (expérience instable).
  if (!visitorId) return 'scroll';

  const variant = assignVariant(KIT_CTA_SHEET_EXPERIMENT_KEY, visitorId, [
    { key: 'sheet', weight: pct / 100 },
  ]);
  return variant === 'sheet' ? 'sheet' : 'scroll';
}
