/**
 * Props partagées entre `KitPageLayoutV1` et `KitPageLayoutV2`.
 *
 * Source de vérité : `apps/web/src/app/(marketing)/kit/page.tsx` qui
 * résoud toute la data en parallèle et passe le résultat aux deux layouts.
 * Cela garantit zéro divergence DB / cache / tracking entre les versions.
 */
import type { KitPageContent, Article, Product } from '@/lib/schemas';
import type { ProductReviewStats } from '@/lib/products/reviews';
import type { RitualSummary } from '@/lib/schemas/rituals';

export interface KitPageLayoutProps {
  /** Contenu CMS structuré (composition, faq, comparatif, testimonials, etc.). */
  content: KitPageContent;
  /** 3 derniers articles du journal pour la grille bottom-funnel. */
  journalArticles: Article[];
  /** Produit DB (prix dynamique cf. fix L-1). */
  dbProduct: Product;
  /** JSON-LD Product enrichi (aggregateRating + review system-driven). */
  productJsonLd: Record<string, unknown>;
  /** Stats reviews DB — null si bdd vide (starter rating fallback côté builder). */
  reviewStats: ProductReviewStats | null;
  /**
   * Summary du module rituels (« voix de la maison »). Source du count
   * affiché dans le badge hero + ancre href cible. totalCount=0 si la
   * table `ritual_aggregate` est vide (le layout retombe alors sur le
   * fallback handsTestimonials ou starter rating).
   */
  ritualSummary: RitualSummary;
}
