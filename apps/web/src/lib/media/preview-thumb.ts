/**
 * Helpers pour obtenir une URL de vignette d'aperçu à afficher dans
 * l'admin (MediaTile, MediaPickerDrawer, SlotCard).
 *
 * Stratégie :
 *   1. Si la media a des `variants[]` chargés (MediaWithRelations), on
 *      préfère la plus petite variant disponible (xs > sm > md > …) au
 *      format avif/webp/jpeg.
 *   2. Sinon, on tombe sur `media.originalUrl` (peut être `/_media/...`
 *      ou un SVG `/svg/...`).
 *   3. Sinon, `null` — l'appelant affichera le placeholder couleur.
 *
 * Pas de `next/image` ici : les URLs `/_media/...` sont servies par le
 * route handler `app/media-files/[...path]/route.ts` (cf. `next.config.mjs`
 * rewrites). `next/image` ajouterait une couche d'optimisation inutile
 * pour des miniatures admin.
 */
import type {
  Media,
  MediaVariant,
  MediaWithRelations,
  VariantBreakpoint,
} from '@/lib/db/types';

const THUMB_PRIORITY: VariantBreakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
const FORMAT_PRIORITY = ['avif', 'webp', 'jpeg'] as const;

function pickThumbVariant(variants: MediaVariant[]): MediaVariant | null {
  if (variants.length === 0) return null;
  for (const bp of THUMB_PRIORITY) {
    for (const fmt of FORMAT_PRIORITY) {
      const v = variants.find((x) => x.breakpoint === bp && x.format === fmt);
      if (v) return v;
    }
  }
  // Fallback : n'importe quelle variant (cas où breakpoint serait null).
  return variants[0] ?? null;
}

/**
 * Retourne l'URL d'aperçu pour un media. Accepte `Media` (sans variants)
 * ou `MediaWithRelations` (avec variants).
 */
export function previewThumbUrl(
  media: Media | (Media & { variants?: MediaVariant[] }) | MediaWithRelations,
): string | null {
  const variants = (media as { variants?: MediaVariant[] }).variants;
  if (variants && variants.length > 0) {
    const v = pickThumbVariant(variants);
    if (v?.url) return v.url;
  }
  return media.originalUrl ?? null;
}
