/**
 * Moteur de suggestion — politique pure `evaluateSuggestionPolicy` (lot L9).
 *
 * Ordre d'évaluation (figé, CONTRACT §7.3) :
 *   1. zones calmes HARD (checkout, formulaire) — plancher non désactivable (INV-14)
 *   2. profils NEVER configurés (deep-read, fast-scroll…) (INV-14/15)
 *   3. moteur off → suppress('engine-off') (INV-13)
 *   4. dismiss persistant / budget → suppress (INV-16)
 *   5. pertinence : même langue / confiance trop basse → suppress
 *   6. profils TRIGGER activés (priorité, confiance) ; aucun → 'no-trigger'
 *   7. moment opportun requis mais pas de breakpoint → defer (INV-17)
 *   8. sinon → show
 *
 * Fonction **pure & déterministe** → testable par table de vérité.
 *
 * @see docs/locale-switcher-v2/10-suggestion-engine/00-study/behavioral-profiles.md §4
 */
import {
  type Condition,
  type Decision,
  type EngineConfig,
  type Profile,
  type Signals,
} from './suggestion-types';

function matchCondition(cond: Condition, signals: Signals): boolean {
  const actual = signals[cond.signal] as number | string | boolean;
  switch (cond.op) {
    case 'truthy':
      return Boolean(actual);
    case 'falsy':
      return !actual;
    case 'eq':
      return actual === cond.value;
    case 'neq':
      return actual !== cond.value;
    case 'gt':
      return typeof actual === 'number' && actual > (cond.value as number);
    case 'gte':
      return typeof actual === 'number' && actual >= (cond.value as number);
    case 'lt':
      return typeof actual === 'number' && actual < (cond.value as number);
    case 'lte':
      return typeof actual === 'number' && actual <= (cond.value as number);
    default:
      return false;
  }
}

function profileMatches(profile: Profile, signals: Signals): boolean {
  return profile.conditions.every((c) => matchCondition(c, signals));
}

function suppress(reason: string, neverProfile: string | null = null): Decision {
  return {
    decision: 'suppress',
    reason,
    profileMatched: null,
    neverProfile,
    suggested: null,
  };
}

export function evaluateSuggestionPolicy(
  signals: Signals,
  config: EngineConfig,
): Decision {
  // 1. Zones calmes HARD — plancher non désactivable (INV-14). Évaluées
  //    AVANT le court-circuit engine-off : la priorité est absolue.
  if (signals.inCheckout) return suppress('NEVER-CHECKOUT', 'NEVER-CHECKOUT');
  if (signals.formFocused) return suppress('NEVER-FORM', 'NEVER-FORM');

  // 2. Profils NEVER configurés (deep-read, fast-scroll, modal, vidéo…).
  const neverProfiles = config.profiles
    .filter((p) => p.kind === 'never' && p.enabled)
    .sort((a, b) => a.priority - b.priority);
  for (const np of neverProfiles) {
    if (profileMatches(np, signals)) return suppress(np.id, np.id);
  }

  // 3. Moteur off (défaut) — INV-13.
  if (!config.engineEnabled) return suppress('engine-off');

  // 4. Budget / refus (INV-16).
  if (signals.dismissedPersistent) return suppress('dismissed-persistent');
  if (
    signals.cooldownActive ||
    signals.impressionsThisVisitor >= config.maxImpressionsPerVisitor
  ) {
    return suppress('budget');
  }

  // 5. Pertinence.
  if (signals.guessedLocale === signals.servedLocale)
    return suppress('same-locale');
  if (signals.confidence < config.globalConfidenceFloor)
    return suppress('low-confidence');

  // 6. Triggers activés (priorité décroissante), conditions + confiance.
  const triggers = config.profiles
    .filter((p) => p.kind === 'trigger' && p.enabled)
    .sort((a, b) => b.priority - a.priority);
  const candidate = triggers.find(
    (t) =>
      profileMatches(t, signals) &&
      signals.confidence >= (t.minConfidence ?? config.globalConfidenceFloor),
  );
  if (!candidate) return suppress('no-trigger');

  // 7. Moment opportun (INV-17) — defer si breakpoint requis mais absent.
  if (candidate.opportuneRequired && !signals.atBreakpoint) {
    return {
      decision: 'defer',
      reason: null,
      profileMatched: candidate.id,
      neverProfile: null,
      suggested: signals.guessedLocale,
    };
  }

  // 8. Montrer.
  return {
    decision: 'show',
    reason: null,
    profileMatched: candidate.id,
    neverProfile: null,
    suggested: signals.guessedLocale,
  };
}
