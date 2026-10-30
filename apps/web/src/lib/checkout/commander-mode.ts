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

/**
 * Origine de l'attribution, pour l'événement d'exposition A/B :
 *  - `override` : `?cta=` (recette, e2e) ;
 *  - `cms` : réglage fixe `scroll` | `sheet` (ou inconnu → `scroll`) ;
 *  - `ab` : tirage stable par visiteur (y compris les bornes 0 % / 100 %
 *    et le témoin `scroll` faute d'identifiant).
 */
export type CommanderModeSource = 'override' | 'cms' | 'ab';

export interface CommanderAssignment {
  mode: CommanderMode;
  source: CommanderModeSource;
}

/**
 * Le `fg_aid` n'est utile (et ne doit être lu, voire créé) que si
 * l'attribution en dépend : réglage `ab` sans override.
 */
export function commanderModeNeedsVisitor(cmsMode: unknown, override: unknown): boolean {
  return !parseCommanderOverride(override) && cmsMode === 'ab';
}

/** Variante + origine (cf. `CommanderModeSource`). */
export function resolveCommanderAssignment({
  cmsMode,
  sharePct,
  override,
  visitorId,
}: ResolveCommanderModeInput): CommanderAssignment {
  const forced = parseCommanderOverride(override);
  if (forced) return { mode: forced, source: 'override' };

  const mode = isCommanderCmsMode(cmsMode) ? cmsMode : DEFAULT_COMMANDER_CMS_MODE;
  if (mode !== 'ab') return { mode, source: 'cms' };

  const pct = normalizeSharePct(sharePct);
  if (pct <= 0) return { mode: 'scroll', source: 'ab' };
  if (pct >= 100) return { mode: 'sheet', source: 'ab' };
  // Sans identifiant (stockage bloqué, SSR) : on reste sur le témoin plutôt
  // que de tirer au hasard à chaque rendu (expérience instable).
  if (!visitorId) return { mode: 'scroll', source: 'ab' };

  const variant = assignVariant(KIT_CTA_SHEET_EXPERIMENT_KEY, visitorId, [
    { key: 'sheet', weight: pct / 100 },
  ]);
  return { mode: variant === 'sheet' ? 'sheet' : 'scroll', source: 'ab' };
}

export function resolveCommanderMode(input: ResolveCommanderModeInput): CommanderMode {
  return resolveCommanderAssignment(input).mode;
}
