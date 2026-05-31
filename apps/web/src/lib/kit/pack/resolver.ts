/**
 * Resolver de la section pack `/kit`.
 *
 * Stratégie cascade :
 *   1. `buildKitProductFeed(product, content)` produit le `ProductFeed`
 *      « mock » (la valeur par défaut).
 *   2. Si un `KitPackOverride` publié existe, on merge ses champs sur le
 *      hero + socialProof.countLabelGeo (Phase 4 du plan
 *      `docs/pack-section-optim-2026-05/`).
 *
 *  - `resolveKitPack()` (public)  → utilise SEULEMENT l'override publié.
 *  - `resolveKitPackDraft()` (admin) → utilise le draft non publié si présent.
 */
import type { KitPageContent, Product } from '@/lib/schemas';
import { buildKitProductFeed } from '@/lib/products/feed/kit-feed';
import type { ProductReviewStats } from '@/lib/products/reviews';
import type { ProductFeed } from '@/lib/products/feed/types';

import { getKitPackOverride } from './store';
import type {
  KitPackOverride,
  KitPackSource,
  ResolvedKitPack,
} from './types';

interface ResolveOptions {
  /** Si true (admin preview), utilise aussi le draft non publié. */
  includeDraft?: boolean;
}

/** Tag de cache utilisé par les routes admin pour invalider via `revalidateTag`. */
export const KIT_PACK_TAG = 'kit-pack' as const;

function pickPatch<T>(
  patch: T | null | undefined,
  fallback: T,
): T {
  if (patch === null) return fallback; // « retour au mock » explicite
  if (patch === undefined) return fallback; // champ non saisi
  return patch;
}

function applyOverride(feed: ProductFeed, override: KitPackOverride): ProductFeed {
  return {
    ...feed,
    hero: {
      ...feed.hero,
      kicker: pickPatch(override.kicker, feed.hero.kicker),
      title: pickPatch(override.title, feed.hero.title),
      lead: pickPatch(override.lead, feed.hero.lead),
      pricePrefix: pickPatch(override.pricePrefix, feed.hero.pricePrefix),
      ctaLabel: pickPatch(override.ctaLabel, feed.hero.ctaLabel),
      ctaMicrocopy: pickPatch(override.ctaMicrocopy, feed.hero.ctaMicrocopy),
      priceCompareAt: pickPatch(override.priceCompareAt, feed.hero.priceCompareAt),
      priceCompareAtAriaLabel: pickPatch(
        override.priceCompareAtAriaLabel,
        feed.hero.priceCompareAtAriaLabel,
      ),
      valueBreakdown: pickPatch(override.valueBreakdown, feed.hero.valueBreakdown),
      perUsageHint: pickPatch(override.perUsageHint, feed.hero.perUsageHint),
      ctaAccent: pickPatch(override.ctaAccent, feed.hero.ctaAccent),
    },
    socialProof: {
      ...feed.socialProof,
      countLabelGeo: pickPatch(
        override.countLabelGeo,
        feed.socialProof.countLabelGeo,
      ),
    },
  };
}

function resolve(
  product: Product,
  content: KitPageContent,
  stats: ProductReviewStats | null | undefined,
  options: ResolveOptions = {},
): ResolvedKitPack {
  const baseFeed = buildKitProductFeed(product, content, stats);
  const override = getKitPackOverride();

  let source: KitPackSource = 'mock';
  let feed = baseFeed;
  let publishedAt: Date | null = null;
  let draftedAt: Date | null = null;
  let updatedAt: Date | null = null;

  if (override) {
    publishedAt = override.publishedAt;
    draftedAt = override.draftedAt;
    updatedAt = override.updatedAt;
    if (override.publishedAt !== null) {
      source = 'override-published';
      feed = applyOverride(baseFeed, override);
    } else if (options.includeDraft) {
      source = 'override-draft';
      feed = applyOverride(baseFeed, override);
    }
  }

  return {
    feed,
    meta: { source, publishedAt, draftedAt, updatedAt },
  };
}

/**
 * Resolver public — utilisé en SSR pour rendre `<ProductFeedSection>`.
 * Ne lit que l'override publié.
 */
export function resolveKitPack(
  product: Product,
  content: KitPageContent,
  stats?: ProductReviewStats | null,
): ResolvedKitPack {
  return resolve(product, content, stats);
}

/**
 * Resolver admin — utilisé par l'éditeur pour pré-remplir le formulaire
 * et l'aperçu live. Inclut le draft non publié si présent.
 */
export function resolveKitPackDraft(
  product: Product,
  content: KitPageContent,
  stats?: ProductReviewStats | null,
): ResolvedKitPack {
  return resolve(product, content, stats, { includeDraft: true });
}
