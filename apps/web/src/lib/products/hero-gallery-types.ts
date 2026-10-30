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

/** Source d'image secondaire (art direction mobile). */
export interface HeroGalleryImageSource {
  src: string;
  width: number;
  height: number;
  blurDataURL?: string;
}

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
  /**
   * Art direction mobile (< 1024 px, ratio 3:4) — images « par audience »
   * uniquement. Absent : la même image sert partout et le rendu reste
   * strictement celui de la galerie historique (`next/image` seul).
   * cf. docs/hero-media-par-angle/05-architecture-technique.md §4.5
   */
  mobile?: HeroGalleryImageSource;
  /** Identifiant du média de la médiathèque, quand il est connu. */
  mediaId?: string;
  /** Cadrage CSS (`object-position`), ex. `top` ou `50% 30%`. */
  objectPosition?: string;
}
