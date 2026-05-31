/**
 * Types côté admin pour les overrides de composition `/kit`.
 *
 * Singleton par sous-produit : 1 override par `subProductId` (3 entries
 * max : 1-paste, 2-powder, polissoir-step-4).
 */
import type {
  Certification,
  IngredientDetailed,
  SubProduct,
  SubProductAccentColor,
} from '@/lib/schemas';

export const KIT_COMPOSITION_SUB_PRODUCT_IDS = [
  '1-paste',
  '2-powder',
  'polissoir-step-4',
] as const;

export type KitCompositionSubProductId =
  (typeof KIT_COMPOSITION_SUB_PRODUCT_IDS)[number];

/**
 * Patch partiel admin — chaque champ optionnel peut être :
 *  - absent → champ existant conservé (mock ou override précédent)
 *  - `null` → reset au mock pour ce champ
 *  - valeur → écrase
 */
export interface KitCompositionOverridePatch {
  subProductId: KitCompositionSubProductId;
  narrative?: string | null;
  usageHint?: string | null;
  accentColor?: SubProductAccentColor | null;
  ingredients?: IngredientDetailed[] | null;
  certifications?: Certification[] | null;
}

export interface KitCompositionOverride extends KitCompositionOverridePatch {
  /** ID = `kit-composition:${subProductId}`. */
  id: string;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  draftedAt: Date | null;
  createdBy: string | null;
}

export type KitCompositionSource =
  | 'override-published'
  | 'override-draft'
  | 'mock';

export interface ResolvedKitCompositionItem {
  subProduct: SubProduct;
  meta: {
    source: KitCompositionSource;
    publishedAt: Date | null;
    draftedAt: Date | null;
    updatedAt: Date | null;
  };
}
