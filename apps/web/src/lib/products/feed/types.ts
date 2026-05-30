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
 * Clé d'icône SVG affichée au-dessus de la pastille numérotée.
 * 4 valeurs figées — cohérent avec la grammaire `ProductFeedClaim.icon`.
 *  - `buffer`  : étapes de limage / préparation
 *  - `drop`    : application d'un soin liquide / pâteux
 *  - `sparkle` : étape qui lustre / révèle la lumière
 *  - `mirror`  : résultat final (effet miroir)
 */
export type ProductFeedStepIcon = 'buffer' | 'drop' | 'sparkle' | 'mirror';

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
  /**
   * Durée approximative du geste, formatée FR (« 30 s », « 1 min »).
   * Optionnel — si absent, le badge durée n'est pas rendu (rétro-compat).
   */
  duration?: string;
  /**
   * Marque ce step comme l'aboutissement du rituel (= step 4 par
   * convention). Le rendu applique : anneau doublé sur la pastille,
   * badge « RÉSULTAT », description en `font-display italic`.
   */
  isResult?: boolean;
  /**
   * Clé de l'icône SVG à afficher au-dessus de la pastille. Si absent,
   * pas d'icône (rétro-compat).
   */
  icon?: ProductFeedStepIcon;
}

/**
 * En-tête de la grille « rituel 4 gestes » (Kolenda §4.7 Attention #18).
 * Rendu au-dessus des 4 cartes pour annoncer la durée totale et réduire
 * l'anxiété temps perçue.
 */
export interface ProductFeedStepsHeader {
  /** Kicker court (« EN TOUT »). */
  kicker: string;
  /** Durée totale formatée (« 5 minutes le soir »). */
  totalDuration: string;
  /** Lead 1 phrase sensorielle sous le titre. */
  lead: string;
}

/**
 * CTA éditorial chuchoté sous la grille des 4 gestes — relance funnel
 * vers le bloc commande (Kolenda Attention #12, directional cues).
 */
export interface ProductFeedStepsPostCta {
  /** Libellé du lien (« Démarrer le rituel »). */
  label: string;
  /** Ancre cible (sans #). */
  anchorId: string;
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
  /**
   * Pack pricing — extensions Kolenda §4.6 (optional, rétro-compat).
   * Le builder peut produire ces champs ; un override admin peut les
   * patcher ; un consommateur legacy peut les ignorer.
   */
  /** Prix barré « non packagé » (chaîne FR ex « 49 € »). Affiché en
   *  petit, line-through. Sert au calcul `computePackSavings`. */
  priceCompareAt?: string;
  /** `aria-label` du prix barré pour les lecteurs d'écran. */
  priceCompareAtAriaLabel?: string;
  /**
   * Décomposition de la valeur du pack — liste ordonnée d'items
   * `{label, valueLabel, muted?}` rendue par `<ValueBreakdownList>`.
   * `muted: true` rend l'item en italique opacity 60 % (ex : « offert »).
   */
  valueBreakdown?: ProductFeedValueItem[];
  /** Microcopy coût/usage. Ex « ≈ 0,75 € par soin sur 30 jours ». */
  perUsageHint?: string;
  /**
   * Phase 7 wiring — gabarit ICU localisé du bandeau économie, avec les
   * placeholders `{amount}` / `{currency}` / `{pct}` (ex AR « توفّرين
   * {amount} {currency} · {pct} % »). Renseigné par `localizeKitProductFeed`
   * pour les locales non-défaut ; absent en FR (le bandeau garde alors la
   * sortie byte-identique de `formatSavingsLabel`). `<PriceBlock>` substitue
   * les valeurs calculées au rendu.
   */
  savingsPhrase?: string;
  /**
   * Accent visuel du CTA primaire. `sauge-dark` est le défaut Kolenda
   * (contraste fort, conversion). `champagne` = fallback luxe doux.
   * `terracotta` = bandeau économie/CTA secondaire (couleur littérale
   * `#C28A6E`, cohérente avec le bandeau savings).
   */
  ctaAccent?: 'sauge-dark' | 'champagne' | 'terracotta';
}

/**
 * Un item de la décomposition de valeur du pack.
 * Affiché dans `<ValueBreakdownList>` sous forme d'une liste verticale
 * label · valueLabel.
 */
export interface ProductFeedValueItem {
  /** Libellé court de l'item (ex « 1 Paste · 30 ml »). */
  label: string;
  /** Valeur affichée à droite (ex « 19 € » ou « offert »). */
  valueLabel: string;
  /** Si true → item rendu en italique + opacity réduite (bonus/offert). */
  muted?: boolean;
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
  /**
   * Libellé géographique optionnel pour le bloc condensé sous le CTA
   * (ex « 287 maisons au Maroc »). Fallback : `${reviewsCount} avis`.
   * Plus chaleureux et plus crédible qu'un simple « avis ».
   */
  countLabelGeo?: string;
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
  /**
   * En-tête de la grille des 4 gestes (Kolenda §4.7). Optionnel —
   * rétro-compat : un feed sans header continue de rendre la grille
   * inchangée.
   */
  stepsHeader?: ProductFeedStepsHeader;
  /**
   * CTA éditorial sous la grille — relance vers `#commander-femiglow`.
   * Optionnel — rétro-compat.
   */
  stepsPostCta?: ProductFeedStepsPostCta;
  /** 3 claims (origine naturelle · sans agressifs · ongles forts). */
  claims: ProductFeedClaim[];
  /** Social proof condensé. */
  socialProof: ProductFeedSocialProof;
}
