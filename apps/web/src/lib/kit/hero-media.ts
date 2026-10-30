/**
 * Images du hero /kit par audience — paramètres de tracking (module pur,
 * utilisable client et serveur).
 *
 * La page résout la galerie UNE fois (`lib/kit/page-context.server.ts`) et en
 * tire deux valeurs :
 *  - `hero_media_variant` : ensemble affiché pour l'image principale
 *    (`angle-e.ar.v3`, `default.fr.v1`, `ab-<exp>-<bras>.fr.v1`, ou `legacy` /
 *    `product` pour les niveaux de repli 7 et 8) — cf.
 *    `lib/components/media-variants/tracking.ts` ;
 *  - `hero_media_level` : niveau de repli atteint (1 à 8).
 *
 * Règle d'émission (décision PR 4) :
 *  - drapeau ACTIF → les deux paramètres sont TOUJOURS envoyés, y compris
 *    pour les replis `legacy` / `product` : toutes les visites exposées au
 *    système sont comparables entre elles (niveau 1 vs repli) ;
 *  - drapeau COUPÉ → rien n'est envoyé et aucun attribut n'est posé : le HTML
 *    et le tracking restent identiques à l'existant (l'absence du paramètre
 *    identifie la galerie historique).
 *
 * Côté client, les boutons lisent les valeurs au clic depuis le DOM
 * (attributs posés sur la section du hero), comme `data-kit-angle`.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.6
 */

/** Attribut de la section hero portant `hero_media_variant`. */
export const HERO_MEDIA_VARIANT_DATA_ATTRIBUTE = 'data-hero-media-variant';
/** Attribut de la section hero portant `hero_media_level`. */
export const HERO_MEDIA_LEVEL_DATA_ATTRIBUTE = 'data-hero-media-level';

/**
 * Longueur maximale d'une valeur. Une dimension A/B `ab:<exp>` et son bras
 * sont des slugs de 64 caractères au plus : `ab-<64>-<64>.fr.v<n>` peut
 * dépasser 64, d'où une borne plus large que les autres paramètres.
 */
export const HERO_MEDIA_VARIANT_MAX_LENGTH = 160;

/**
 * Alphabet des valeurs produites par `mediaVariantTrackingValue` : minuscules,
 * chiffres, `-`, `_`, `.` (et `:` / `*` par sécurité si un format évolue).
 */
export const HERO_MEDIA_VARIANT_PATTERN = /^[a-z0-9:._*-]+$/;

export const HERO_MEDIA_LEVEL_MIN = 1;
export const HERO_MEDIA_LEVEL_MAX = 8;

/** Valeurs de tracking d'une galerie résolue avec le drapeau actif. */
export interface HeroMediaTracking {
  variant: string;
  level: number;
}

/** Paramètres d'événement correspondants (absents si non applicables). */
export interface HeroMediaTrackingParams {
  hero_media_variant?: string;
  hero_media_level?: number;
}

export function isHeroMediaVariantValue(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length > 0 &&
    value.length <= HERO_MEDIA_VARIANT_MAX_LENGTH &&
    HERO_MEDIA_VARIANT_PATTERN.test(value)
  );
}

export function isHeroMediaLevel(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= HERO_MEDIA_LEVEL_MIN &&
    value <= HERO_MEDIA_LEVEL_MAX
  );
}

/**
 * Paramètres à fusionner dans un événement. Valeur invalide ou absente →
 * paramètre omis (jamais de rejet de l'événement entier par le schéma strict).
 */
export function heroMediaTrackingParams(
  tracking: Partial<HeroMediaTracking> | null | undefined,
): HeroMediaTrackingParams {
  if (!tracking || !isHeroMediaVariantValue(tracking.variant)) return {};
  return {
    hero_media_variant: tracking.variant,
    ...(isHeroMediaLevel(tracking.level) ? { hero_media_level: tracking.level } : {}),
  };
}

/** Attributs `data-*` à poser sur la section du hero (`{}` si drapeau coupé). */
export function heroMediaDataAttributes(
  tracking: HeroMediaTracking | null | undefined,
): Record<string, string> {
  const params = heroMediaTrackingParams(tracking);
  if (!params.hero_media_variant) return {};
  return {
    [HERO_MEDIA_VARIANT_DATA_ATTRIBUTE]: params.hero_media_variant,
    ...(params.hero_media_level !== undefined
      ? { [HERO_MEDIA_LEVEL_DATA_ATTRIBUTE]: String(params.hero_media_level) }
      : {}),
  };
}

/**
 * Lit `hero_media_variant` depuis le DOM (attribut du hero). `null` hors de
 * /kit, drapeau coupé ou valeur invalide.
 */
export function readHeroMediaVariantFromDocument(): string | null {
  if (typeof document === 'undefined') return null;
  const el = document.querySelector(`[${HERO_MEDIA_VARIANT_DATA_ATTRIBUTE}]`);
  if (!el) return null;
  const value = el.getAttribute(HERO_MEDIA_VARIANT_DATA_ATTRIBUTE);
  return isHeroMediaVariantValue(value) ? value : null;
}

/**
 * Lit variante + niveau depuis le DOM et renvoie les paramètres prêts à
 * fusionner (`{}` si absents).
 */
export function readHeroMediaTrackingFromDocument(): HeroMediaTrackingParams {
  const variant = readHeroMediaVariantFromDocument();
  if (!variant) return {};
  const el = document.querySelector(`[${HERO_MEDIA_VARIANT_DATA_ATTRIBUTE}]`);
  const rawLevel = el?.getAttribute(HERO_MEDIA_LEVEL_DATA_ATTRIBUTE);
  const level = rawLevel ? Number(rawLevel) : undefined;
  return heroMediaTrackingParams({ variant, level });
}
