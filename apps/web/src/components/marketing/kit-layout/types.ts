/**
 * Props partagées entre `KitPageLayoutV1` et `KitPageLayoutV2`.
 *
 * Source de vérité : `apps/web/src/app/(marketing)/kit/page.tsx` qui
 * résoud toute la data en parallèle et passe le résultat aux deux layouts.
 * Cela garantit zéro divergence DB / cache / tracking entre les versions.
 */
import type { KitPageContent, Article, Product } from '@/lib/schemas';
import type { ProductReviewStats } from '@/lib/products/reviews';
import type { Locale } from '@/i18n.config';
import type { AppliedCouponSeed } from '@/lib/checkout/state/use-applied-coupon';

export interface KitPageLayoutProps {
  /** Contenu CMS structuré (composition, faq, comparatif, testimonials, etc.). */
  content: KitPageContent;
  /** 3 derniers articles du journal pour la grille bottom-funnel. */
  journalArticles: Article[];
  /** Produit DB (prix dynamique cf. fix L-1). */
  dbProduct: Product;
  /** JSON-LD Product enrichi (aggregateRating + review system-driven). */
  productJsonLd: Record<string, unknown>;
  /**
   * Stats d'avis — source unique (`getKitReviewStats`) : compteur des
   * témoignages approuvés + note réelle si elle existe. `null` si aucune
   * donnée : hero, bloc pack/prix et JSON-LD masquent compteur et note.
   */
  reviewStats: ProductReviewStats | null;
  /**
   * Phase 7B — Locale active de la page. Propagée aux Bound qui consomment
   * `resolveComponentFields(componentKey, locale)`. Optionnel pour rester
   * back-compat avec `(marketing)/kit/page.tsx` (legacy non locale-aware).
   */
  locale?: Locale;
  /**
   * Code de campagne présent dans l'URL et validé CÔTÉ SERVEUR pour cette
   * requête. Permet au premier paint de porter déjà le prix remisé, au lieu
   * d'afficher le prix catalogue puis de sauter après hydratation.
   * `undefined` pour toute visiteuse sans `?code=` : rendu inchangé.
   */
  initialCoupon?: AppliedCouponSeed;
}
