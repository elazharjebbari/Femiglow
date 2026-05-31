/**
 * Reviews aggregation — feeds the social-proof block of `<ProductFeedSection/>`
 * (rating + reviewsCount) and the `aggregateRating` of the Product JSON-LD.
 *
 * Pourquoi un module dédié plutôt qu'une lecture in-line dans le builder ?
 *
 *  - **Source unique** : le rating qui s'affiche sur `/kit`, dans `/feed.xml`
 *    et dans le JSON-LD doit être strictement le même. Sans ce module, on
 *    finit par avoir 3 chiffres différents (literal hardcodé, agrégation
 *    DB, mock testimonials).
 *  - **Builder pur** : `buildKitProductFeed` reste sync + sans I/O. Le
 *    fetch des stats se fait côté caller (RSC qui peut faire `await`),
 *    puis on injecte le résultat dans le builder.
 *  - **Fallback gracieux** : tant que la DB de reviews n'a pas de
 *    données (cohorte de démarrage), on retourne `null` ici et le
 *    builder retombe sur `DEFAULT_KIT_REVIEW_STATS`. C'est ce qu'on
 *    appelle un « cached starter rating » (Kolenda Pricing #14 — chiffres
 *    précis dès le premier hit, sans afficher 0/5 sur un produit fraîchement
 *    publié).
 *  - **Mockable** : les tests d'intégration mockent ce module via
 *    `vi.mock('@/lib/products/reviews', …)` plutôt que de polluer le
 *    memoryStore avec des reviews fictives à chaque suite.
 *
 * État actuel : la table `productReviews` n'existe pas encore en DB
 * (Drizzle). On stocke les reviews dans le memoryStore via le pattern
 * `ext()` — même approche que `products.ts`. Quand le sprint « collecte
 * d'avis » ajoutera la table, il suffira d'ajouter la branche `db()`
 * ici sans toucher aux callers ni aux tests.
 */
import { memoryStore } from '@/lib/db/client';

/** Stat agrégée d'un produit. */
export interface ProductReviewStats {
  /** Note moyenne arrondie à 1 décimale (ex : 4.8). */
  rating: number;
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

/**
 * Fallback rating exposé au public quand la base de reviews est vide.
 *
 * Ces chiffres reprennent le « starter rating » historique (4,8 / 287)
 * cohérent avec :
 *  - les témoignages mains du CMS (95 avis × 3 cohortes saisonnières),
 *  - l'historique social proof imprimé sur le visuel produit officiel.
 *
 * **Important** : dès qu'au moins UNE review réelle entre en DB, le
 * fallback s'efface (cf. `getProductReviewStats` ci-dessous). On ne
 * « lisse » pas le starter avec les vraies notes — sinon on mentirait
 * sur le rating réel, et Google Merchant peut suspendre le feed pour
 * inconsistance avec les reviews remontées via Customer Reviews.
 */
export const DEFAULT_KIT_REVIEW_STATS: ProductReviewStats = {
  rating: 4.8,
  reviewsCount: 287,
};

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
 * Retourne `null` quand aucune review n'existe — laisse au caller le
 * choix du fallback (généralement `DEFAULT_KIT_REVIEW_STATS`).
 *
 * La moyenne est arrondie au dixième : 4.83 → 4.8, 4.85 → 4.9. Cela
 * évite à la fois les chiffres ronds (Pricing #14) et les chiffres
 * « scientifiques » (4.834782) qui décrédibilisent la social proof.
 */
export async function getProductReviewStats(
  productId: string,
): Promise<ProductReviewStats | null> {
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
 * Helper test — insère une review en mémoire. Exposé publiquement pour
 * permettre aux suites vitest de seed le store sans réimporter `ext()`.
 */
export function _seedReview(review: ProductReview): void {
  ext().productReviews.set(review.id, review);
}
