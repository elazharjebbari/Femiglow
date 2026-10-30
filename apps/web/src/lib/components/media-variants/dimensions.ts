/**
 * Médias par audience — catalogue des dimensions (module pur).
 *
 *  - `default` : dimension implicite, clé unique `*`.
 *  - `angle`   : angle publicitaire du kit (`KIT_ANGLES` : `a`…`e`, `temoin`).
 *  - `ab:<expKey>` : bras d'une expérience A/B. Les bras ne sont pas connus
 *    statiquement (table `experiment_variants`) : seule la forme est validée
 *    ici ; la vérification d'existence se fera côté API admin.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.2
 */
import { KIT_ANGLES } from '@/lib/kit/angle';

/** Dimension implicite (ensembles par défaut). */
export const DEFAULT_DIMENSION = 'default';

/** Sentinelle « toutes valeurs » (clé de la dimension `default`, langue `*`). */
export const WILDCARD = '*';

/** Préfixe des dimensions d'expérience A/B. */
export const AB_DIMENSION_PREFIX = 'ab:';

/** Forme d'une clé d'expérience ou d'un bras : slug court en minuscules. */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export interface MediaVariantDimension {
  /** Identifiant stocké dans `variant_dim`. */
  id: string;
  label: string;
  /** Valeurs connues statiquement ; `null` = valeurs dynamiques (A/B). */
  values: readonly string[] | null;
}

const STATIC_DIMENSIONS: Readonly<Record<string, MediaVariantDimension>> = {
  angle: { id: 'angle', label: 'Angle publicitaire', values: KIT_ANGLES },
};

/** Renvoie la clé d'expérience d'une dimension `ab:<expKey>`, sinon `null`. */
export function parseAbDimension(dim: string): string | null {
  if (!dim.startsWith(AB_DIMENSION_PREFIX)) return null;
  const expKey = dim.slice(AB_DIMENSION_PREFIX.length);
  return SLUG_PATTERN.test(expKey) ? expKey : null;
}

/** Description d'une dimension déclarable (hors `default`), sinon `null`. */
export function getDimension(dim: string): MediaVariantDimension | null {
  const known = STATIC_DIMENSIONS[dim];
  if (known) return known;
  const expKey = parseAbDimension(dim);
  if (expKey) return { id: dim, label: `Expérience ${expKey}`, values: null };
  return null;
}

/** Vrai si `dim` peut figurer dans `MediaVariantPolicy.dimensions`. */
export function isKnownDimension(dim: string): boolean {
  return getDimension(dim) !== null;
}

/**
 * Vrai si `key` est une clé valide pour `dim`.
 *  - `default` → uniquement `*` ;
 *  - dimension statique → une de ses valeurs ;
 *  - `ab:<expKey>` → un slug de bras (existence vérifiée ailleurs).
 */
export function isValidVariantKey(dim: string, key: string): boolean {
  if (dim === DEFAULT_DIMENSION) return key === WILDCARD;
  const dimension = getDimension(dim);
  if (!dimension) return false;
  if (dimension.values) return dimension.values.includes(key);
  return SLUG_PATTERN.test(key);
}
