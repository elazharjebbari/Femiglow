/**
 * Moteur de suggestion — types & valeurs par défaut sûres (lot L9).
 *
 * Tout est **données** (profils déclaratifs) → la politique
 * `evaluateSuggestionPolicy` est une fonction **pure** testable par table
 * de vérité, et les profils sont créables/éditables en admin (INV-18).
 *
 * @see docs/locale-switcher-v2/10-suggestion-engine/00-study/behavioral-profiles.md
 * @see docs/locale-switcher-v2/CONTRACT.md §7
 */
import { type Locale } from '@/i18n.config';

/** Signaux observés (sous-ensemble pertinent pour la politique). */
export interface Signals {
  servedLocale: Locale;
  guessedLocale: Locale;
  confidence: number; // 0..1
  // Tâche en cours (zones calmes)
  inCheckout: boolean;
  formFocused: boolean;
  isDeepReading: boolean;
  modalOpen: boolean;
  videoPlaying: boolean;
  // Engagement / moment
  dwellMs: number;
  scrollVelocity: number;
  atBreakpoint: boolean;
  // Intention
  hoverSwitcher: boolean;
  exitIntent: boolean;
  // Budget
  cooldownActive: boolean;
  impressionsThisVisitor: number;
  dismissedPersistent: boolean;
}

/**
 * Valeurs par défaut **conservatrices** : tout signal manquant pousse vers
 * « ne pas montrer » (zones calmes à `true`, budget épuisé, confiance nulle).
 * Un appelant fournit un `Partial<Signals>` ; les trous prennent ces défauts.
 */
export const SAFE_DEFAULT_SIGNALS: Omit<
  Signals,
  'servedLocale' | 'guessedLocale'
> = {
  confidence: 0,
  inCheckout: true,
  formFocused: true,
  isDeepReading: true,
  modalOpen: true,
  videoPlaying: true,
  dwellMs: 0,
  scrollVelocity: Number.POSITIVE_INFINITY,
  atBreakpoint: false,
  hoverSwitcher: false,
  exitIntent: false,
  cooldownActive: true,
  impressionsThisVisitor: 9999,
  dismissedPersistent: true,
};

/** Opérateurs d'une condition déclarative. */
export type ConditionOp =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'truthy'
  | 'falsy';

export interface Condition {
  signal: keyof Signals;
  op: ConditionOp;
  value?: number | string | boolean;
}

export type ProfileKind = 'trigger' | 'never';

export interface Profile {
  id: string;
  kind: ProfileKind;
  enabled: boolean;
  priority: number; // plus grand = évalué d'abord (triggers)
  conditions: Condition[]; // toutes doivent matcher (ET)
  minConfidence?: number; // triggers : confiance minimale
  opportuneRequired?: boolean; // triggers : exige un breakpoint (INV-17)
}

export interface EngineConfig {
  engineEnabled: boolean; // OFF par défaut (INV-13)
  globalConfidenceFloor: number; // 0..1
  maxImpressionsPerVisitor: number;
  profiles: Profile[];
}

export type SuppressReason =
  | 'engine-off'
  | 'no-trigger'
  | 'low-confidence'
  | 'same-locale'
  | 'budget'
  | 'dismissed-persistent'
  | 'defer-expired'
  | string; // id d'un profil NEVER-*

export interface Decision {
  decision: 'show' | 'suppress' | 'defer';
  reason: SuppressReason | null;
  profileMatched: string | null;
  neverProfile: string | null;
  suggested: Locale | null;
}

/** Construit des signaux complets à partir d'un sous-ensemble + défauts sûrs. */
export function withSafeDefaults(
  partial: Partial<Signals> & Pick<Signals, 'servedLocale' | 'guessedLocale'>,
): Signals {
  return { ...SAFE_DEFAULT_SIGNALS, ...partial };
}
