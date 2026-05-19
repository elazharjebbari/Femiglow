/**
 * Types partagés serveur ↔ client pour la galerie hero.
 *
 * Séparés de `kit-hero-gallery.ts` (qui a `import 'server-only'`) pour que
 * les composants client puissent référencer le type sans tirer la dépendance
 * server dans leur bundle.
 *
 * cf. docs/kit-hero-optim/03-vignette-system.md
 */

export type HeroGalleryImageKind = 'product' | 'context' | 'review';

export interface HeroGalleryImage {
  id: string;
  src: string;
  alt: string;
  width: number;
  height: number;
  blurDataURL?: string;
  kind: HeroGalleryImageKind;
  /** Caption optionnelle (reviews — "I. R. · Rabat"). */
  caption?: string;
}
