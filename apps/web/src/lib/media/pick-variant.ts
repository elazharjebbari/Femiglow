/**
 * Choix d'une variant « hero » pour un média (module pur, sans I/O).
 *
 * Extrait de `lib/products/kit-hero-gallery.ts` pour être partagé avec le
 * résolveur des médias par audience (`lib/components/media-variants/`).
 * Comportement strictement identique à la version d'origine.
 *
 * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.4
 */

/** Forme minimale lue : seuls `url`, `breakpoint` et `format` comptent. */
export interface PickableVariant {
  url: string;
  breakpoint: string | null;
  format: string;
}

/** Ordre de préférence des tailles (la plus grande d'abord). */
export const HERO_VARIANT_SIZES = ['xl', 'lg', 'md', 'sm', 'xs'] as const;

/** Ordre de préférence des formats. */
export const HERO_VARIANT_FORMATS = ['webp', 'avif', 'jpeg'] as const;

/**
 * Pick une variant adaptée au hero (priorité décroissante) :
 * `xl` > `lg` > `md` > `sm` > `xs`, format `webp` > `avif` > `jpeg`.
 *
 * Pourquoi `webp` en premier ? Universal browser support (95 %+ Q4 2026), et
 * pas besoin de logique de négociation côté client (`MediaImage` server faisait
 * `<picture><source>` pour AVIF, mais on est en client component ici).
 *
 * Sans correspondance stricte : premier variant disponible. Sans variant :
 * `null` (l'appelant retombe sur `originalUrl`).
 */
export function pickHeroVariantUrl(
  media: { variants?: readonly PickableVariant[] } | null | undefined,
): string | null {
  if (!media) return null;
  const variants = media.variants;
  if (!variants || variants.length === 0) return null;
  for (const size of HERO_VARIANT_SIZES) {
    for (const format of HERO_VARIANT_FORMATS) {
      const v = variants.find((x) => x.breakpoint === size && x.format === format);
      if (v?.url) return v.url;
    }
  }
  // Aucun match strict — premier variant disponible.
  return variants[0]?.url ?? null;
}
