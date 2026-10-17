/**
 * Avis du pack — source unique du compteur et de la note affichés partout
 * (hero, badge social proof, bloc pack/prix, section avis, JSON-LD
 * `aggregateRating`, flux catalogue Merchant).
 *
 * Règles :
 *  - **Compteur** = nombre de témoignages approuvés du module rituels
 *    (`ritual_testimonials`, agrégés dans `ritual_aggregate`). C'est le même
 *    chiffre que la section « Les voix de la maison » plus bas dans la page.
 *  - **Note** = moyenne réelle des avis notés (1 à 5) quand il en existe.
 *    Les témoignages rituels ne portent pas de note : sans avis noté, la note
 *    vaut `null` et n'est pas affichée (aucune étoile inventée).
 *  - **Aucune donnée** (mode mémoire, base vide) → `null` : les surfaces
 *    masquent le compteur et la note. Pas de chiffre de démarrage.
 *
 * Les callers RSC appellent `getKitReviewStats()` une fois et propagent le
 * résultat ; le builder `buildKitProductFeed` reste pur.
 */
import { memoryStore } from '@/lib/db/client';
import { getRitualSummary } from '@/lib/db/queries/rituals';

/** Clé produit du pack dans le module rituels (`ritual_testimonials`). */
export const KIT_RITUAL_PRODUCT_KEY = 'pack-femiglow';

/** Stat agrégée d'un produit. */
export interface ProductReviewStats {
  /**
   * Note moyenne arrondie à 1 décimale (ex : 4.6), calculée sur des avis
   * réellement notés. `null` quand aucun avis noté n'existe : on affiche
   * alors le compteur seul, sans étoiles.
   */
  rating: number | null;
  /** Nombre total d'avis comptabilisés. */
  reviewsCount: number;
}

/**
 * Une review brute, telle que stockée en mémoire (et plus tard en DB).
 *
 * `rating` est un entier de 1 à 5 — la moyenne décimale (4.8) est calculée
 * à l'agrégation, jamais stockée. Les notes intermédiaires (3.5) ne sont
 * pas autorisées : on suit la convention Google Merchant qui n'accepte
 * que des ratings entiers en input et une moyenne décimale en sortie.
 */
export interface ProductReview {
  id: string;
  productId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  createdAt: Date;
}

interface ReviewsStore {
  productReviews: Map<string, ProductReview>;
}

/**
 * Lazy-extends the memory store with `productReviews`. Suit le même
 * pattern que `products.ts` (`ext()`) — évite de polluer la définition
 * de `Store` dans `client.ts` tant que la table DB n'existe pas.
 */
function ext(): ReviewsStore {
  const store = memoryStore() as unknown as ReviewsStore & Record<string, unknown>;
  if (!store.productReviews) store.productReviews = new Map<string, ProductReview>();
  return store;
}

/**
 * Calcule la note moyenne (1 décimale) + le nombre d'avis pour un produit.
 *
 * Retourne `null` quand aucune review n'existe. Préférer
 * `getKitReviewStats()` pour l'affichage public du pack.
 *
 * La moyenne est arrondie au dixième : 4.83 → 4.8, 4.85 → 4.9. Cela
 * évite à la fois les chiffres ronds (Pricing #14) et les chiffres
 * « scientifiques » (4.834782) qui décrédibilisent la social proof.
 */
export async function getProductReviewStats(
  productId: string,
): Promise<(ProductReviewStats & { rating: number }) | null> {
  // Drizzle path à câbler quand la table `product_reviews` arrivera. Pour
  // l'instant on lit depuis le memoryStore : c'est ce que le mock seed
  // alimente en dev local et ce que les tests vitest peuvent peupler.
  const reviews = Array.from(ext().productReviews.values()).filter(
    (r) => r.productId === productId,
  );
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  const avg = sum / reviews.length;
  // Math.round((4.85)*10) → 49 → /10 → 4.9. JS arrondit au pair pour
  // .5 — acceptable ici car la précision business est au dixième.
  const rounded = Math.round(avg * 10) / 10;
  return {
    rating: rounded,
    reviewsCount: reviews.length,
  };
}

/**
 * Stats d'avis du pack, source unique pour toutes les surfaces publiques.
 *
 *  - compteur : témoignages approuvés du module rituels ;
 *  - note : moyenne des avis notés si disponible, sinon `null` ;
 *  - `null` si aucune donnée (les surfaces masquent alors compteur et note).
 *
 * Une erreur de lecture du module rituels est traitée comme « pas de
 * donnée » : on masque plutôt que d'afficher un chiffre faux.
 */
export async function getKitReviewStats(
  productId: string,
): Promise<ProductReviewStats | null> {
  const [rated, rituals] = await Promise.all([
    getProductReviewStats(productId),
    getRitualSummary(KIT_RITUAL_PRODUCT_KEY).catch(() => null),
  ]);
  const ritualCount = rituals?.totalCount ?? 0;
  if (ritualCount > 0) {
    return { reviewsCount: ritualCount, rating: rated?.rating ?? null };
  }
  return rated;
}

/**
 * Helper test — insère une review en mémoire. Exposé publiquement pour
 * permettre aux suites vitest de seed le store sans réimporter `ext()`.
 */
export function _seedReview(review: ProductReview): void {
  ext().productReviews.set(review.id, review);
}
