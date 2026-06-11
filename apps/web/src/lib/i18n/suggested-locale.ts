/**
 * Locale Switcher V2 — détection serveur de la langue suggérée (lot L5).
 *
 * Composition **pure** (testable) du faisceau de devinette à partir des
 * signaux disponibles côté serveur (cookie `NEXT_LOCALE`, `Accept-Language`,
 * langue de session précédente, langue de la créa). Résolue en RSC puis
 * passée en **prop** → aucun flash (ADR-006). Jamais d'auto-redirect (INV-20).
 *
 * @see docs/locale-switcher-v2/10-suggestion-engine/01-conception/detection-strategies.md
 */
import { type Locale } from '@/i18n.config';

import {
  guessPreferredLocale,
  parseAcceptLanguage,
  type StrategyWeights,
} from './guess-preferred-locale';

export interface SuggestedLocaleInput {
  servedLocale: Locale;
  acceptLanguage?: string | null;
  cookieLocale?: Locale | null; // NEXT_LOCALE — choix explicite (prioritaire)
  priorLocale?: Locale | null;
  adLocale?: Locale | null;
  weights?: StrategyWeights;
}

export interface SuggestedLocaleResult {
  suggested: Locale;
  served: Locale;
  confidence: number;
  /** La suggestion diffère-t-elle de la langue servie ? (pré-requis nudge) */
  differsFromServed: boolean;
}

/**
 * Devine la langue préférée côté serveur. La précédence (cookie explicite >
 * Accept-Language > défaut) est portée par les poids du faisceau (le cookie
 * pèse le plus). Aucun signal → langue servie, confiance 0.
 */
export function resolveSuggestedLocale(
  input: SuggestedLocaleInput,
): SuggestedLocaleResult {
  const guess = guessPreferredLocale(
    {
      servedLocale: input.servedLocale,
      cookieLocale: input.cookieLocale ?? null,
      priorLocale: input.priorLocale ?? null,
      adLocale: input.adLocale ?? null,
      acceptLanguages: parseAcceptLanguage(input.acceptLanguage),
    },
    input.weights,
  );
  return {
    suggested: guess.guessedLocale,
    served: input.servedLocale,
    confidence: guess.confidence,
    differsFromServed: guess.guessedLocale !== input.servedLocale,
  };
}
