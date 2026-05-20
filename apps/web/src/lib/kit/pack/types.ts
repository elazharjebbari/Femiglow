/**
 * Types côté admin pour l'override singleton de la section pack `/kit`.
 *
 * - Un seul override par site (la section pack est unique).
 * - L'override est éditable champ par champ ; seuls les champs modifiés
 *   sont stockés (les autres viennent du mock via `kit-feed.ts`).
 * - `publishedAt` distingue brouillon (draft) et live.
 *
 * Cf. `docs/pack-section-optim-2026-05/03-data-model.md` + `04-backend-design.md`.
 */
import type { ProductFeed, ProductFeedValueItem } from '@/lib/products/feed/types';

/**
 * Sous-ensemble éditable de `ProductFeed.hero`. Volontairement restreint
 * aux champs maîtrisables par un éditeur non-dev :
 *  - `kicker / title / lead / pricePrefix / ctaLabel / ctaMicrocopy` :
 *    Kolenda Pricing #2/#11 + voix maison.
 *  - `priceCompareAt(AriaLabel)`, `valueBreakdown`, `perUsageHint` :
 *    pricing reframe (Kolenda §4.6).
 *  - `ctaAccent` : variante visuelle du CTA.
 *  - `countLabelGeo` (sur socialProof) : libellé géographique.
 *
 * `value === null` signifie « retour au mock » (le builder produira la
 * valeur par défaut).
 */
export interface KitPackOverridePatch {
  kicker?: string | null;
  title?: string | null;
  lead?: string | null;
  pricePrefix?: string | null;
  ctaLabel?: string | null;
  ctaMicrocopy?: string | null;
  priceCompareAt?: string | null;
  priceCompareAtAriaLabel?: string | null;
  valueBreakdown?: ProductFeedValueItem[] | null;
  perUsageHint?: string | null;
  ctaAccent?: 'sauge-dark' | 'champagne' | 'terracotta' | null;
  countLabelGeo?: string | null;
}

export interface KitPackOverride extends KitPackOverridePatch {
  /** Singleton id (`'kit:pack'`). */
  id: string;
  createdAt: Date;
  updatedAt: Date;
  /** Présent quand le draft a été publié au moins une fois. */
  publishedAt: Date | null;
  /** Présent dès qu'il existe un draft non publié. */
  draftedAt: Date | null;
  createdBy: string | null;
}

export type KitPackSource = 'override-published' | 'override-draft' | 'mock';

/**
 * Résultat du resolver : un `ProductFeed` complet (mock + override
 * mergé) + métadonnées de traçabilité pour l'admin et le debug.
 */
export interface ResolvedKitPack {
  feed: ProductFeed;
  meta: {
    source: KitPackSource;
    publishedAt: Date | null;
    draftedAt: Date | null;
    updatedAt: Date | null;
  };
}

/** Identifiant singleton (un seul pack par site). */
export const KIT_PACK_OVERRIDE_ID = 'kit:pack' as const;
