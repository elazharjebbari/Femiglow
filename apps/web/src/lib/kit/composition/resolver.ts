/**
 * Resolver de la composition `/kit`.
 *
 * Cascade pour chaque sous-produit :
 *   1. Si override singleton publié → merge sur le mock
 *   2. Si override draft (admin preview) → merge sur le mock (mode draft)
 *   3. Sinon → mock pur
 */
import { mockKitPageContent } from '@/data/mock/kit';
import type { SubProduct } from '@/lib/schemas';
import { getKitCompositionOverride } from './store';
import type {
  KitCompositionOverride,
  KitCompositionSource,
  KitCompositionSubProductId,
  ResolvedKitCompositionItem,
} from './types';

/**
 * Version publique : ne sert l'override QUE s'il est publié.
 */
export function resolveKitComposition(): ResolvedKitCompositionItem[] {
  return mockKitPageContent.composition.map((sub) => {
    const override = getKitCompositionOverride(sub.id as KitCompositionSubProductId);
    if (!override || !override.publishedAt) {
      return { subProduct: sub, meta: emptyMeta() };
    }
    return {
      subProduct: mergeOverride(sub, override),
      meta: {
        source: 'override-published',
        publishedAt: override.publishedAt,
        draftedAt: override.draftedAt,
        updatedAt: override.updatedAt,
      },
    };
  });
}

/**
 * Version admin : sert la dernière version (draft inclus) pour piloter
 * l'aperçu temps réel de l'éditeur.
 */
export function resolveKitCompositionDraft(): ResolvedKitCompositionItem[] {
  return mockKitPageContent.composition.map((sub) => {
    const override = getKitCompositionOverride(sub.id as KitCompositionSubProductId);
    if (!override) {
      return { subProduct: sub, meta: emptyMeta() };
    }
    const source: KitCompositionSource =
      override.publishedAt && !override.draftedAt
        ? 'override-published'
        : 'override-draft';
    return {
      subProduct: mergeOverride(sub, override),
      meta: {
        source,
        publishedAt: override.publishedAt,
        draftedAt: override.draftedAt,
        updatedAt: override.updatedAt,
      },
    };
  });
}

/**
 * Version admin pour un seul sous-produit (utilisé par la page éditeur).
 */
export function resolveKitCompositionItemDraft(
  subProductId: KitCompositionSubProductId,
): ResolvedKitCompositionItem | null {
  const sub = mockKitPageContent.composition.find((s) => s.id === subProductId);
  if (!sub) return null;
  const override = getKitCompositionOverride(subProductId);
  if (!override) {
    return { subProduct: sub, meta: emptyMeta() };
  }
  const source: KitCompositionSource =
    override.publishedAt && !override.draftedAt
      ? 'override-published'
      : 'override-draft';
  return {
    subProduct: mergeOverride(sub, override),
    meta: {
      source,
      publishedAt: override.publishedAt,
      draftedAt: override.draftedAt,
      updatedAt: override.updatedAt,
    },
  };
}

function emptyMeta(): ResolvedKitCompositionItem['meta'] {
  return {
    source: 'mock',
    publishedAt: null,
    draftedAt: null,
    updatedAt: null,
  };
}

function mergeOverride(
  base: SubProduct,
  override: KitCompositionOverride,
): SubProduct {
  return {
    ...base,
    narrative: pickPatch(override.narrative, base.narrative),
    usageHint: pickPatch(override.usageHint, base.usageHint),
    accentColor: pickPatch(override.accentColor, base.accentColor),
    ingredients: pickPatch(override.ingredients, base.ingredients) ?? base.ingredients,
    certifications:
      pickPatch(override.certifications, base.certifications) ?? base.certifications,
  };
}

function pickPatch<T>(
  over: T | null | undefined,
  base: T | undefined,
): T | undefined {
  if (over === null) return base;
  if (over === undefined) return base;
  return over;
}
