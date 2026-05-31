/**
 * Moteur de suggestion — devinette de la langue préférée (lot L9).
 *
 * Faisceau d'indices **pondéré** (jamais une règle unique) : chaque
 * stratégie vote, on agrège, et la **confiance** = force du consensus.
 * Fonction **pure** → testable par table. La géoloc IP n'est jamais un
 * signal dur (INV-20) ; non incluse ici.
 *
 * @see docs/locale-switcher-v2/10-suggestion-engine/01-conception/detection-strategies.md
 */
import { isLocale, LOCALES, type Locale } from '@/i18n.config';

/** Poids par défaut des stratégies (surchargés par la config admin). */
export const DEFAULT_STRATEGY_WEIGHTS = {
  cookie: 1.0, // S1 — choix explicite antérieur
  prior: 0.8, // S2 — langue de la session précédente
  acceptLanguage: 0.5, // S3 — header (×q)
  ad: 0.7, // S4 — langue de la créa / utm
  behavior: 0.6, // S5 — clic contenu d'une autre langue / hover
} as const;

export type StrategyWeights = typeof DEFAULT_STRATEGY_WEIGHTS;

export interface GuessInput {
  servedLocale: Locale;
  cookieLocale?: Locale | null;
  priorLocale?: Locale | null;
  acceptLanguages?: Array<{ locale: Locale; q: number }>;
  adLocale?: Locale | null;
  behaviorLocale?: Locale | null;
}

export interface GuessVote {
  strategy: keyof StrategyWeights;
  locale: Locale;
  weight: number;
}

export interface GuessResult {
  guessedLocale: Locale;
  confidence: number; // 0..1
  evidence: GuessVote[];
}

/**
 * Parse un header `Accept-Language` en votes `{locale, q}` limités aux
 * locales supportées (base de langue, max q par locale).
 */
export function parseAcceptLanguage(
  header: string | null | undefined,
): Array<{ locale: Locale; q: number }> {
  if (!header) return [];
  const byLocale = new Map<Locale, number>();
  for (const part of header.split(',')) {
    const [tag, ...params] = part.trim().split(';');
    const base = tag?.trim().split('-')[0]?.toLowerCase();
    if (!base || !isLocale(base)) continue;
    let q = 1;
    for (const p of params) {
      const m = p.trim().match(/^q=([0-9.]+)$/);
      if (m?.[1]) q = Number.parseFloat(m[1]);
    }
    byLocale.set(base, Math.max(byLocale.get(base) ?? 0, q));
  }
  return [...byLocale.entries()].map(([locale, q]) => ({ locale, q }));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Agrège les stratégies en `{ guessedLocale, confidence, evidence }`.
 * Confiance = `force × accord` : force = min(1, meilleur score) ;
 * accord = (meilleur − second) / meilleur. Aucun vote ⇒ langue servie,
 * confiance 0 (on ne proposera rien).
 */
export function guessPreferredLocale(
  input: GuessInput,
  weights: StrategyWeights = DEFAULT_STRATEGY_WEIGHTS,
): GuessResult {
  const evidence: GuessVote[] = [];
  const add = (
    strategy: keyof StrategyWeights,
    locale: Locale | null | undefined,
    weight: number,
  ) => {
    if (locale && isLocale(locale) && weight > 0) {
      evidence.push({ strategy, locale, weight });
    }
  };

  add('cookie', input.cookieLocale, weights.cookie);
  add('prior', input.priorLocale, weights.prior);
  add('ad', input.adLocale, weights.ad);
  add('behavior', input.behaviorLocale, weights.behavior);
  for (const al of input.acceptLanguages ?? []) {
    add('acceptLanguage', al.locale, weights.acceptLanguage * al.q);
  }

  if (evidence.length === 0) {
    return { guessedLocale: input.servedLocale, confidence: 0, evidence };
  }

  const tally = new Map<Locale, number>();
  for (const loc of LOCALES) tally.set(loc, 0);
  for (const v of evidence) tally.set(v.locale, (tally.get(v.locale) ?? 0) + v.weight);

  const ranked = [...tally.entries()]
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1]);
  const [bestLocale, best] = ranked[0]!;
  const second = ranked[1]?.[1] ?? 0;

  const strength = Math.min(1, best);
  const agreement = best > 0 ? (best - second) / best : 0;
  const confidence = round2(strength * agreement);

  return { guessedLocale: bestLocale, confidence, evidence };
}
