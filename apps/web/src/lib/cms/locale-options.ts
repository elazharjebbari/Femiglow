/**
 * Options i18n pour les méthodes CMS.
 *
 * Phase 3 T3.1 — Premier helper pour passer la locale aux méthodes CMS.
 * Tant que les implémentations (mock / Sanity) ne sont pas étendues pour
 * fetcher par locale, ce paramètre est **plumb-through** : il transporte
 * la locale jusqu'au repo sans changer le résultat.
 *
 * Évolution attendue Phase 3.2 :
 *  - Le mock fait fallback FR (déjà actuel)
 *  - L'impl Sanity (ou autre prod) interroge `component_field_bindings`
 *    avec `WHERE locale = $1 OR locale = 'fr'` + priorisation
 *  - Le `fallback` permet d'override le comportement par défaut
 *
 * @see docs/i18n-strategy-2026-05/03-backend/content-translation.md
 */
import { DEFAULT_LOCALE, type Locale } from '@/i18n.config';

/**
 * Options de locale à passer aux méthodes CMS.
 *
 * Toutes les méthodes acceptent cette option de manière optionnelle —
 * `undefined` = pas de localisation (utilise locale racine).
 */
export interface CmsLocaleOptions {
  /**
   * Locale active de la request. Si omis, le repo utilise `DEFAULT_LOCALE`
   * et retourne le contenu source FR.
   */
  locale?: Locale;
  /**
   * Locale de fallback si le binding pour `locale` n'existe pas.
   * Par défaut : `DEFAULT_LOCALE` (fr).
   *
   * Mettre à `null` pour désactiver le fallback (retournera `null` si vide).
   */
  fallback?: Locale | null;
}

/**
 * Résolution canonique des options de locale CMS : applique les défauts
 * et expose des champs garantis non-undefined.
 *
 * @example
 * function someRepoMethod(opts?: CmsLocaleOptions) {
 *   const { locale, fallback } = resolveCmsLocale(opts);
 *   // locale est toujours Locale (jamais undefined)
 *   // fallback est Locale | null (explicitement null si désactivé)
 * }
 */
export function resolveCmsLocale(opts?: CmsLocaleOptions): {
  locale: Locale;
  fallback: Locale | null;
} {
  return {
    locale: opts?.locale ?? DEFAULT_LOCALE,
    fallback: opts?.fallback === undefined ? DEFAULT_LOCALE : opts.fallback,
  };
}
