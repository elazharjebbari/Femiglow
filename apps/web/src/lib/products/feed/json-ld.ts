/**
 * Adapter feed produit → Schema.org Product enrichment.
 *
 * Convertit un `ProductFeed` (+ témoignages bruts) en
 * `ProductSchemaEnrichment` consommable par `productSchema()` du module
 * SEO. C'est le pont entre :
 *  - **le builder Kolenda** (`buildKitProductFeed`) qui agrège la note
 *    moyenne et le compteur d'avis,
 *  - **le rendu HTML** (`<JsonLd data={productSchema(...)} />`) qui injecte
 *    le `<script type="application/ld+json">` dans `/kit`.
 *
 * Le but : débloquer les **Rich Results** Google (étoiles + nb d'avis +
 * extrait de citation directement dans la SERP). Sans aggregateRating,
 * Google ne peut pas afficher d'étoiles, même si on a 287 avis 4.8/5.
 *
 * Pure : ne fait pas d'I/O. Sortable côté serveur (RSC) ou côté client.
 */
import type { ProductSchemaEnrichment } from '@/lib/seo/json-ld';
import type { HandsTestimonial } from '@/lib/schemas';

import type { ProductFeed } from './types';

/**
 * Nombre maximum de reviews à inclure dans le JSON-LD. Au-delà, la
 * SERP Google ne lit plus rien et le payload pèse pour rien.
 */
const MAX_REVIEWS = 5;

/**
 * Construit l'enrichissement Schema.org depuis un `ProductFeed` agrégé
 * et la liste des témoignages mains brute.
 *
 * Hypothèses :
 *  - chaque témoignage hérite de la note moyenne (`feed.socialProof.rating`)
 *    car les témoignages mains FemiGlow ne portent pas de note individuelle.
 *  - on tronque à `MAX_REVIEWS` pour limiter le payload.
 *  - on conserve l'ordre source des témoignages (à l'admin de prioriser).
 */
export function feedToProductSchemaEnrichment(
  feed: ProductFeed,
  testimonials: ReadonlyArray<HandsTestimonial>,
): ProductSchemaEnrichment {
  const aggregateRating = {
    ratingValue: feed.socialProof.rating,
    reviewCount: feed.socialProof.reviewsCount,
    bestRating: 5,
    worstRating: 1,
  };

  const reviews = testimonials.slice(0, MAX_REVIEWS).map((t) => ({
    authorName: t.city
      ? `${t.authorFirstName}, ${t.city}`
      : t.authorFirstName,
    body: t.quote,
    // Les témoignages individuels héritent de la note moyenne — c'est
    // l'usage courant quand on n'a pas de rating par-avis (Schema.org
    // l'autorise explicitement, cf. Yoast Recommendations 2024).
    ratingValue: feed.socialProof.rating,
  }));

  return { aggregateRating, reviews };
}
