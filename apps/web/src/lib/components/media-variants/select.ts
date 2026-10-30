/**
 * Médias par audience — choix de l'ensemble d'un slot (fonction PURE).
 *
 * Chaîne de repli (§4.3), slot par slot, ensemble ENTIER :
 *  pour chaque dimension de la politique, dans l'ordre de priorité, si la
 *  visiteuse a une clé pour cette dimension :
 *    1. variante + langue exacte
 *    2. variante, toutes langues (`*`)
 *    3. variante en `fr`, seulement si l'ensemble est `crossLocale`
 *  puis la dimension implicite `default` :
 *    4. défaut + langue
 *    5. défaut `*`
 *    6. défaut `fr` (`crossLocale`)
 *  sinon `null` : l'appelant applique 7 (liaisons legacy) puis 8 (produit).
 *
 * Un ensemble sans aucun item affichable (médias supprimés, pas prêts, sans
 * URL) est ignoré et on passe au niveau suivant. On ne complète JAMAIS un
 * ensemble avec les images d'un autre.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.3
 */
import type { MediaVariantPolicy } from '@/lib/components/registry';
import { DEFAULT_DIMENSION, WILDCARD } from './dimensions';
import { findSlotPolicy, slotMaxItems } from './policy';
import type {
  AudienceContext,
  MediaSetDTO,
  MediaSetItemDTO,
  MediaSetSelection,
  SetFallbackLevel,
} from './types';

export { mediaDisplayUrl } from './dto';

/** Langue de référence des ensembles `crossLocale` (niveaux 3 et 6). */
export const CROSS_LOCALE_SOURCE = 'fr';

/** Vrai si l'item a une image desktop affichable (URL résolue à la projection). */
export function isRenderableItem(item: MediaSetItemDTO): boolean {
  return item.desktop !== null;
}

interface Candidate {
  dim: string;
  key: string;
  locale: string;
  requireCrossLocale: boolean;
  level: SetFallbackLevel;
}

/** Les (au plus) trois candidats d'une dimension, dans l'ordre 1-2-3 / 4-5-6. */
function candidatesFor(
  dim: string,
  key: string,
  locale: string,
  base: 1 | 4,
): Candidate[] {
  const out: Candidate[] = [
    { dim, key, locale, requireCrossLocale: false, level: base },
    { dim, key, locale: WILDCARD, requireCrossLocale: false, level: (base + 1) as SetFallbackLevel },
  ];
  // En `fr`, le niveau 3/6 serait identique au niveau 1/4 : inutile.
  if (locale !== CROSS_LOCALE_SOURCE) {
    out.push({
      dim,
      key,
      locale: CROSS_LOCALE_SOURCE,
      requireCrossLocale: true,
      level: (base + 2) as SetFallbackLevel,
    });
  }
  return out;
}

/**
 * Ordre complet des candidats pour un contexte : dimensions de la politique
 * (priorité décroissante) puis `default`.
 */
export function fallbackCandidates(
  policy: MediaVariantPolicy,
  ctx: AudienceContext,
): ReadonlyArray<Readonly<Candidate>> {
  const out: Candidate[] = [];
  for (const dim of policy.dimensions) {
    if (dim === DEFAULT_DIMENSION) continue;
    const key = ctx.variants[dim];
    if (typeof key !== 'string' || key.length === 0 || key === WILDCARD) continue;
    out.push(...candidatesFor(dim, key, ctx.locale, 1));
  }
  out.push(...candidatesFor(DEFAULT_DIMENSION, WILDCARD, ctx.locale, 4));
  return out;
}

/**
 * Choisit l'ensemble à afficher pour `slot`. `sets` = ensembles candidats
 * (publiés, ou aperçu brouillon) d'UN composant, déjà projetés en DTO. Renvoie `null` si aucun
 * niveau 1 à 6 ne donne d'image : l'appelant applique les niveaux 7 et 8.
 */
export function selectMediaSet(
  sets: readonly MediaSetDTO[],
  slot: string,
  ctx: AudienceContext,
  policy: MediaVariantPolicy,
): MediaSetSelection | null {
  const slotPolicy = findSlotPolicy(policy, slot);
  if (!slotPolicy) return null;
  const max = slotMaxItems(slotPolicy);
  const forSlot = sets.filter((s) => s.slot === slot);
  if (forSlot.length === 0) return null;

  for (const c of fallbackCandidates(policy, ctx)) {
    const set = forSlot.find(
      (s) => s.variantDim === c.dim && s.variantKey === c.key && s.locale === c.locale,
    );
    if (!set) continue;
    if (c.requireCrossLocale && !set.crossLocale) continue;
    const items = [...set.items]
      .sort((a, b) => a.position - b.position)
      .filter(isRenderableItem)
      .slice(0, max);
    if (items.length === 0) continue;
    return { set, items, level: c.level };
  }
  return null;
}
