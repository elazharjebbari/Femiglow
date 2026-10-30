/**
 * Feature flag — images du hero kit par audience (angle × langue).
 *
 * Trois niveaux, tous doivent laisser passer (§4.9) :
 *  1. Environnement : variable serveur `HERO_MEDIA_VARIANTS`. **Désactivé
 *     par défaut** ; seules `on`, `true` ou `1` (insensibles à la casse,
 *     espaces ignorés) l'activent. Lu dans `process.env` du processus :
 *     un changement demande un **redémarrage du serveur**.
 *  2. CMS : champ booléen `kit-hero-produit.mediaVariantsEnabled` (défaut
 *     `false`) — coupe-circuit immédiat, sans déploiement.
 *  3. Recette : `?hmv=off` désactive pour une URL.
 *
 * Évalué une fois par requête par `lib/kit/page-context.server.ts` (pages
 * /kit), qui lit le champ CMS puis résout la galerie du hero.
 *
 * Référence : `docs/hero-media-par-angle/05-architecture-technique.md` §4.9.
 */

const HERO_MEDIA_VARIANTS_TRUTHY = new Set(['on', 'true', '1']);

/** Valeur de `?hmv=` qui désactive la fonctionnalité pour l'URL. */
export const HERO_MEDIA_VARIANTS_QUERY_PARAM = 'hmv';
export const HERO_MEDIA_VARIANTS_QUERY_OFF = 'off';

/**
 * Calcule l'état du flag d'environnement à partir de la valeur brute.
 * Exporté pour les tests ; en runtime, passer par `isHeroMediaVariantsEnabled()`.
 */
export function resolveHeroMediaVariantsEnv(envValue: string | undefined): boolean {
  if (envValue === undefined) return false;
  return HERO_MEDIA_VARIANTS_TRUTHY.has(envValue.trim().toLowerCase());
}

/** Vrai si `?hmv=` demande la désactivation (paramètre répété : la 1re valeur compte). */
export function isHeroMediaVariantsQueryOff(queryOverride: unknown): boolean {
  const first = Array.isArray(queryOverride) ? queryOverride[0] : queryOverride;
  return (
    typeof first === 'string' &&
    first.trim().toLowerCase() === HERO_MEDIA_VARIANTS_QUERY_OFF
  );
}

export interface HeroMediaVariantsFlagInputs {
  /** Valeur résolue du champ CMS `mediaVariantsEnabled` (absent = `false`). */
  cmsEnabled: unknown;
  /** Valeur brute de `?hmv=` (string, string[] ou absent). */
  queryOverride?: unknown;
  /** Valeur d'env injectable (tests). Défaut : `process.env.HERO_MEDIA_VARIANTS`. */
  envValue?: string;
}

/**
 * `true` seulement si l'environnement l'autorise, que le champ CMS vaut
 * strictement `true` et que l'URL ne porte pas `?hmv=off`.
 */
export function isHeroMediaVariantsEnabled({
  cmsEnabled,
  queryOverride,
  envValue = process.env.HERO_MEDIA_VARIANTS,
}: HeroMediaVariantsFlagInputs): boolean {
  if (!resolveHeroMediaVariantsEnv(envValue)) return false;
  if (cmsEnabled !== true) return false;
  return !isHeroMediaVariantsQueryOff(queryOverride);
}
