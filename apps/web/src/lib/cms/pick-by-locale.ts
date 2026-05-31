/**
 * Helper de sélection de contenu CMS par locale, avec fallback chain.
 *
 * Phase 3 T3.3 — Implémente la logique métier pour retourner le bon
 * contenu depuis un dictionnaire `Record<Locale, T>` :
 *
 *   1. Si une entrée existe pour `locale` → retourne celle-ci
 *   2. Sinon si un `fallback` est configuré (cf. `CmsLocaleOptions`)
 *      → retourne l'entrée du `fallback`
 *   3. Sinon → throw avec un message explicite
 *
 * Conçu pour cohabiter avec `resolveCmsLocale` :
 *
 * @example
 * import { pickByLocale } from '@/lib/cms/pick-by-locale';
 * import { resolveCmsLocale } from '@/lib/cms/locale-options';
 *
 * async function getHomepage(opts?: CmsLocaleOptions) {
 *   const { locale, fallback } = resolveCmsLocale(opts);
 *   return pickByLocale(
 *     { fr: mockHomepageFr, ar: mockHomepageAr, en: mockHomepageEn },
 *     { locale, fallback },
 *   );
 * }
 *
 * @see docs/i18n-strategy-2026-05/03-backend/translation-store.md §4
 */
import type { Locale } from '@/i18n.config';

import { resolveCmsLocale, type CmsLocaleOptions } from './locale-options';

/**
 * Pseudo-error class qu'on peut catch précisément côté caller.
 *
 * Permet de distinguer une "vraie" erreur (DB down, etc.) d'une simple
 * absence de contenu — utile pour log / metric / monitoring.
 */
export class LocaleContentMissingError extends Error {
  override readonly name = 'LocaleContentMissingError';
  constructor(
    public readonly attemptedLocale: Locale,
    public readonly fallbackTried: Locale | null,
    message?: string,
  ) {
    super(
      message ??
        `No content found for locale "${attemptedLocale}"${
          fallbackTried ? ` (fallback "${fallbackTried}" also missing)` : ''
        }.`,
    );
  }
}

/**
 * Sélectionne l'entrée du dictionnaire `byLocale` selon la `locale`
 * demandée, avec fallback configurable.
 *
 * @throws {LocaleContentMissingError} si ni la locale ni le fallback
 *   ne sont présents dans `byLocale`.
 */
export function pickByLocale<T>(
  byLocale: Partial<Record<Locale, T>>,
  options?: CmsLocaleOptions,
): T {
  const { locale, fallback } = resolveCmsLocale(options);

  const direct = byLocale[locale];
  if (direct !== undefined) return direct;

  if (fallback !== null) {
    const viaFallback = byLocale[fallback];
    if (viaFallback !== undefined) return viaFallback;
  }

  throw new LocaleContentMissingError(locale, fallback);
}

/**
 * Variante non-throw qui retourne `null` si aucun contenu trouvé.
 * Utile pour les call sites qui veulent gérer eux-mêmes le cas 404.
 */
export function pickByLocaleOrNull<T>(
  byLocale: Partial<Record<Locale, T>>,
  options?: CmsLocaleOptions,
): T | null {
  try {
    return pickByLocale(byLocale, options);
  } catch (err) {
    if (err instanceof LocaleContentMissingError) return null;
    throw err;
  }
}
