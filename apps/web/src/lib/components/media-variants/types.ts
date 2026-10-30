/**
 * Médias par audience — types partagés (purs, utilisables client et serveur).
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.3–4.4
 */
import type { Locale } from '@/i18n.config';
import type {
  MediaObjectPosition,
  MediaSetItemAlt,
  MediaSetStatus,
} from '@/lib/db/types';
import type { MediaVariantPolicy } from '@/lib/components/registry';

/** Langue d'un ensemble : une locale du site, ou `*` (toutes langues). */
export type MediaSetLocale = Locale | '*';

/**
 * Contexte d'audience de la requête.
 *  - `locale` : langue de la page.
 *  - `variants` : clé retenue par dimension (`{ angle: 'e', 'ab:xp': 'b' }`).
 *    `null` / absent = la visiteuse n'a pas de valeur pour cette dimension.
 */
export interface AudienceContext {
  locale: Locale;
  variants: Readonly<Record<string, string | null | undefined>>;
}

/**
 * Niveau atteint dans la chaîne de repli (§4.3) :
 *  1. variante + langue exacte
 *  2. variante, toutes langues (`*`)
 *  3. variante en `fr`, si l'ensemble est `crossLocale`
 *  4. défaut + langue
 *  5. défaut `*`
 *  6. défaut `fr` (`crossLocale`)
 *  7. liaisons legacy (`component_media_bindings`) — géré par l'appelant
 *  8. image produit de repli — géré par l'appelant
 */
export type FallbackLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

/** Niveaux couverts par `selectMediaSet` (un ensemble a été trouvé). */
export type SetFallbackLevel = 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Source d'image déjà choisie (variant hero, sinon original) — tout ce que
 * le rendu lit. Ni les lignes `media` ni la liste des variants ne sont
 * conservées : c'est ce qui garde l'instantané en cache petit.
 */
export interface MediaSetImageSource {
  src: string;
  width: number;
  height: number;
  blurDataURL?: string;
}

/**
 * Item d'ensemble projeté pour la sélection et le rendu (JSON pur, sans
 * `Date`). `desktop: null` = média supprimé, pas prêt ou sans URL : l'item
 * n'est pas affichable.
 */
export interface MediaSetItemDTO {
  setId: string;
  position: number;
  desktop: MediaSetImageSource | null;
  /** Art direction mobile (3:4) ; `null` = même image que desktop. */
  mobile: MediaSetImageSource | null;
  alt: MediaSetItemAlt;
  /** Alt de la médiathèque (rédigé en français) — lu seulement en `fr`. */
  mediaAlt: string | null;
  objectPosition: MediaObjectPosition | null;
  focalX: number | null;
  focalY: number | null;
}

/** Ensemble projeté (JSON pur : dates en chaînes ISO). */
export interface MediaSetDTO {
  id: string;
  slot: string;
  variantDim: string;
  variantKey: string;
  locale: string;
  crossLocale: boolean;
  version: number;
  status: MediaSetStatus;
  publishedAt: string | null;
  updatedAt: string;
  items: MediaSetItemDTO[];
}

/** Résultat de `selectMediaSet` : un ensemble entier, jamais un mélange. */
export interface MediaSetSelection {
  set: MediaSetDTO;
  /** Items affichables de CET ensemble, triés par position (plafonnés). */
  items: MediaSetItemDTO[];
  level: SetFallbackLevel;
}

/** Trace de résolution d'un slot (diagnostic admin + tracking). */
export interface MediaSlotTrace {
  slot: string;
  level: FallbackLevel;
  /** Renseignés seulement pour les niveaux 1 à 6. */
  setId: string | null;
  variantDim: string | null;
  variantKey: string | null;
  locale: string | null;
  version: number | null;
}

/** Image résolue, prête pour l'affichage (`next/image`). */
export interface ResolvedMediaImage {
  id: string;
  src: string;
  width: number;
  height: number;
  blurDataURL?: string;
  alt: string;
  objectPosition?: MediaObjectPosition;
  focalX?: number;
  focalY?: number;
  /** Art direction mobile (3:4). Absent = même image que desktop. */
  mobile?: {
    src: string;
    width: number;
    height: number;
    blurDataURL?: string;
  };
}

/**
 * Instantané lu (et mis en cache) pour un composant : sa politique et ses
 * ensembles PROJETÉS (`MediaSetDTO`). `unstable_cache` sérialise en JSON et
 * plafonne une entrée à 2 Mo : l'instantané ne contient donc que des
 * valeurs JSON (aucune `Date`) et seulement ce que le rendu lit — il est
 * identique avant et après un aller-retour JSON.
 */
export interface ComponentMediaSetsSnapshot {
  componentId: string;
  componentKey: string;
  policy: MediaVariantPolicy;
  sets: MediaSetDTO[];
}
