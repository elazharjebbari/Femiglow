/**
 * Types pour le « feed produit » Kolenda-driven exposé sur `/kit`.
 *
 * Le feed n'est pas un simple bloc de copy : c'est une structure de
 * conversion qui matérialise plusieurs principes de Nick Kolenda
 * (Copywriting, Pricing, Ecommerce, Luxury) sur une seule page :
 *
 *  - **Hero** : titre au présent (Copywriting #1), small word près du
 *    prix (Pricing #2), description impliquant le savoir-faire
 *    (Luxury #6).
 *  - **Steps (rituel 4 gestes)** : un seul focus par carte, verbe
 *    d'action en présent, alternance des longueurs (Copywriting #2).
 *  - **Claims** : framing « impact sur les autres » (Copywriting #29),
 *    descriptions sensorielles et nombres précis (Pricing #5, #14).
 *  - **Social proof** : citation courte + rating + comptage (Ecom #14).
 *  - **Microcopy** : « Inclus : … » à proximité du CTA (Pricing #11,
 *    densify the payment section).
 *
 * Le feed peut aussi être sérialisé en XML Google Merchant (RSS 2.0
 * + namespace `g:`) via `merchant-xml.ts` pour alimenter Google
 * Shopping / Facebook Catalog.
 */

/** Couleur d'accent FemiGlow utilisée par les cartes de step. */
export type FeedAccent = 'sauge' | 'petale' | 'champagne' | 'ciel';

/**
 * Une étape du rituel 4 gestes (cf. visuel produit officiel) :
 * Préparer · Paste · Powder · Résultat.
 */
export interface ProductFeedStep {
  /** Numéro 1..4 de l'étape dans le rituel. */
  step: number;
  /** Kicker court ("Geste 1"). */
  kicker: string;
  /** Titre de l'étape ("Préparez vos ongles"). */
  title: string;
  /**
   * Description en français, idéalement au présent ou à l'impératif
   * léger (Kolenda Copywriting #1) — 12 à 22 mots, une seule idée.
   */
  description: string;
  /** Couleur du voyant numéroté (rappel des 4 pastilles du visuel). */
  accent: FeedAccent;
}

/**
 * Bloc « hero » du feed : le pitch principal.
 * Pensé pour être lu en moins de 4 secondes.
 */
export interface ProductFeedHero {
  /** Court kicker ("Le rituel"). */
  kicker: string;
  /** Headline produit, au présent. ≤ 50 caractères. */
  title: string;
  /**
   * Lead : 1-2 phrases sensorielles qui impliquent le savoir-faire
   * sans le claim direct (Luxury #6 : décrire l'ouvrage).
   */
  lead: string;
  /**
   * Préfixe court juste avant le prix (Kolenda Pricing #2 — small
   * words near prices). Ex : « Juste », « Tout compris : ».
   */
  pricePrefix: string;
  /** Libellé du CTA principal. Verbe d'invitation, pas d'achat sec. */
  ctaLabel: string;
  /** Microcopy de réassurance dense sous le CTA. */
  ctaMicrocopy: string;
}

/**
 * Une promesse / claim, matérialisé par un pictogramme + un libellé +
 * un sous-libellé. Reprend les 3 promesses du visuel officiel.
 */
export interface ProductFeedClaim {
  /** Clé picto. */
  icon: 'leaf' | 'drop' | 'sparkle';
  /** Promesse en 3-7 mots. */
  label: string;
  /** Détail concret en 8-15 mots. */
  detail: string;
}

/**
 * Bloc social proof condensé : note moyenne, nombre d'avis, citation,
 * attribution. Évite les chiffres ronds (Pricing #14 — precise digits).
 */
export interface ProductFeedSocialProof {
  /** Nombre d'avis. */
  reviewsCount: number;
  /** Note moyenne (0-5), affichée avec décimale. */
  rating: number;
  /** Citation courte d'un témoignage réel. */
  quote: string;
  /** Attribution lisible ("Lina, Rabat"). */
  authorLabel: string;
}

/**
 * Le feed produit complet, prêt à être consommé par
 * `<ProductFeedSection/>` ou sérialisé en XML Merchant.
 */
export interface ProductFeed {
  /** Slug du produit lié. */
  productSlug: string;
  /** Locale du feed ("fr-MA"). */
  locale: string;
  /** URL canonique de la fiche produit. */
  canonicalUrl: string;
  /** Image principale absolue (utilisée dans le XML Merchant). */
  imageUrl: string;
  /** Marque (toujours "FemiGlow" pour ce site). */
  brand: string;
  /** Devise ISO (ex : "MAD"). */
  currency: string;
  /** Prix affichable (en majeurs : 320 pour 320 MAD). */
  priceMajor: number;
  /** Prix promo affichable, ou null. */
  promoPriceMajor: number | null;
  /** Disponibilité Merchant. */
  availability: 'in_stock' | 'out_of_stock';
  /** Description longue (utilisée dans Merchant). */
  description: string;
  /** Bloc hero copy. */
  hero: ProductFeedHero;
  /** 4 cartes du rituel (Préparer · Paste · Powder · Résultat). */
  steps: ProductFeedStep[];
  /** 3 claims (origine naturelle · sans agressifs · ongles forts). */
  claims: ProductFeedClaim[];
  /** Social proof condensé. */
  socialProof: ProductFeedSocialProof;
}
