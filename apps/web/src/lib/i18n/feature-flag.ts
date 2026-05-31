/**
 * Feature flag i18n — contrôle l'activation runtime du routing locale-aware.
 *
 * Tant que `I18N_ENABLED=false` (par défaut), le site reste 100% FR sur les
 * routes legacy (`/kit`, `/maison`, etc.) — zéro régression. Le passage à
 * `true` active le middleware next-intl et redirige vers `/{locale}/...`.
 *
 * Cette indirection permet :
 *   - rollback instantané via variable d'env (Vercel edge config)
 *   - tests E2E ON/OFF du flag pour valider la migration
 *   - déploiement canary (10% → 50% → 100%) sans modification de code
 *
 * @see docs/i18n-strategy-2026-05/08-plan-action/feature-flags.md
 */

const I18N_ENABLED_TRUTHY = new Set(['true', '1', 'on', 'yes', 'enabled']);

/**
 * Indique si l'i18n routing est activé pour ce déploiement.
 *
 * - Lit `process.env.I18N_ENABLED` (string env var, vide ou inconnu = false).
 * - Stable durant tout le cycle de vie d'un process serveur (cache implicite
 *   via constante d'init Node.js).
 * - Server-only safe (n'utilise pas `NEXT_PUBLIC_` — pas exposé au browser).
 *
 * @returns `true` si le flag est explicitement truthy, `false` sinon.
 */
export function isI18nEnabled(): boolean {
  const raw = process.env.I18N_ENABLED;
  if (!raw) return false;
  return I18N_ENABLED_TRUTHY.has(raw.toLowerCase().trim());
}

/**
 * Variante client-safe : utilise une variable d'env publique pour exposer
 * le flag au navigateur. Utile uniquement pour bypasser des composants
 * en attendant la migration complète.
 *
 * Préférer `isI18nEnabled()` côté serveur dans la majorité des cas.
 */
export function isI18nEnabledClient(): boolean {
  const raw = process.env.NEXT_PUBLIC_I18N_ENABLED;
  if (!raw) return false;
  return I18N_ENABLED_TRUTHY.has(raw.toLowerCase().trim());
}
