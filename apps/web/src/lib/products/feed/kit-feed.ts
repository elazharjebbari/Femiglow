/**
 * Builder Kolenda-driven du feed produit pour le kit FemiGlow.
 *
 * Le builder est **pur** : il prend en entrée le `Product` et un
 * `KitPageContent` et retourne un `ProductFeed` immédiatement
 * utilisable par `<ProductFeedSection/>` ou `merchantFeedXml()`.
 *
 * L'art ici est de marier les contraintes éditoriales FemiGlow
 * (voix sobre, sensorielle, pas de superlatif, pas de CTA agressif —
 * cf. `chat/instruction-defaults.ts`) avec les principes Kolenda :
 *
 *  - Copywriting #1 — Use **present tense** to maintain mental imagery
 *    (« Le rituel s'installe » plutôt que « Le rituel va s'installer »).
 *  - Copywriting #2 — **Diversify flow** : alterner phrases courtes/
 *    longues, sons phonétiques.
 *  - Copywriting #21 — Show **first step as completed** : le hero
 *    parle déjà du résultat (« la plaque retrouve sa cadence »).
 *  - Copywriting #29 — **Describe impacts on other people** : les
 *    claims évoquent la lumière captée, le geste vu.
 *  - Pricing #2 — **Small words near price** : « Juste », « Tout
 *    compris ».
 *  - Pricing #11 — **Densify the payment section** : microcopy
 *    serrée sous le CTA.
 *  - Pricing #14 — **Precise digits** : nombres non-ronds
 *    (4,8/5 plutôt que 5/5 ; 287 avis plutôt que 300).
 *  - Ecommerce #14 — Reviews count + average + quote, ensemble.
 *  - Luxury #6 — **Imply craftsmanship** : « affin\u00E9e \u00E0 Rabat »,
 *    « lustr\u00E9e au polissoir », « atelier marocain ».
 *
 * Toute évolution éditoriale du feed se fait ici. Les composants
 * (`<ProductFeedSection/>`) ne contiennent **aucun** texte produit.
 */
import type { KitPageContent, Product } from '@/lib/schemas';

import {
  DEFAULT_KIT_REVIEW_STATS,
  type ProductReviewStats,
} from '../reviews';
import { buildPerUsageHint } from '@/lib/kit/pack/per-usage';
import { assertValidProductFeed } from './schema';
import type {
  ProductFeed,
  ProductFeedClaim,
  ProductFeedHero,
  ProductFeedSocialProof,
  ProductFeedStep,
  ProductFeedValueItem,
} from './types';

/** URL absolue du site (override possible via env pour l'XML Merchant). */
function siteOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  return fromEnv && fromEnv.length > 0 ? fromEnv : 'https://femiglow-maroc.com';
}

/** Convertit des centimes en majeurs (320 pour 32000). */
function toMajor(cents: number): number {
  return Math.round(cents) / 100;
}

/**
 * Extensions raster acceptées par Google Merchant Center / Facebook Catalog.
 * Cf. https://support.google.com/merchants/answer/6324350 — les SVG sont
 * **explicitement rejetés** : nos régies refusent un feed avec un image_link
 * en `.svg`.
 *
 * Ordre = préférence : PNG d'abord (transparence + qualité), JPG ensuite.
 */
const MERCHANT_RASTER_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff'] as const;

/**
 * Sélectionne l'URL d'image à exposer dans le feed Merchant.
 *
 * Stratégie en 3 temps :
 *   1. Premier `image.src` ayant déjà une extension raster.
 *   2. Premier `image.src` SVG → on tente la variante PNG colocalisée
 *      (générée par `scripts/generate-product-images.ts`).
 *   3. Fallback `${origin}/og/kit.png` (toujours raster).
 *
 * **Important** : on ne fait pas d'I/O ici (le builder est pur). On
 * suppose que `kit-principale.png` existe à côté de `kit-principale.svg`.
 * C'est un contrat d'équipe — le script `generate-product-images.ts`
 * doit être lancé après toute modification SVG produit.
 */
function pickMerchantImageUrl(
  images: ReadonlyArray<{ src: string }>,
  origin: string,
): string {
  function absolute(src: string): string {
    return src.startsWith('http') ? src : `${origin}${src}`;
  }

  // 1. Image raster directe.
  const raster = images.find((img) =>
    MERCHANT_RASTER_EXTENSIONS.some((ext) => img.src.toLowerCase().endsWith(ext)),
  );
  if (raster) return absolute(raster.src);

  // 2. Première image SVG → tentative PNG colocalisé.
  const firstSvg = images.find((img) => img.src.toLowerCase().endsWith('.svg'));
  if (firstSvg) {
    const pngSibling = firstSvg.src.replace(/\.svg$/i, '.png');
    return absolute(pngSibling);
  }

  // 3. Fallback OG.
  return `${origin}/og/kit.png`;
}

/**
 * Les 4 étapes du rituel — extraites du visuel produit officiel
 * « Rituel manucure FemiGlow ». L'ordre, les pastilles et les couleurs
 * reprennent strictement la structure visuelle pour conserver la
 * cohérence print/web.
 */
function buildSteps(): ProductFeedStep[] {
  return [
    {
      step: 1,
      kicker: 'Pr\u00E9paration',
      title: 'Pr\u00E9parez vos ongles',
      // Pr\u00E9sent + verbes sensoriels (Kolenda Copy #1, #29).
      description:
        'On nettoie, on s\u00E8che, on lime l\u00E9g\u00E8rement \u2014 la plaque s\u2019ouvre au soin.',
      accent: 'sauge',
    },
    {
      step: 2,
      kicker: 'Geste 1',
      title: 'Appliquez la paste',
      description:
        'Une noisette de paste vert sauge, le polissoir glisse, la cire entre dans la k\u00E9ratine.',
      accent: 'sauge',
    },
    {
      step: 3,
      kicker: 'Geste 2',
      title: 'Appliquez la powder',
      description:
        'On d\u00E9pose la powder rose poudr\u00E9, on lustre lentement, la lumi\u00E8re revient \u00E0 la surface.',
      accent: 'petale',
    },
    {
      step: 4,
      kicker: 'Polissoir Step\u00A04',
      title: 'Polish & Shine',
      // Premier pas montr\u00E9 comme d\u00E9j\u00E0 accompli (Copy #21).
      description:
        'On finit au polissoir bleu ciel \u2014 l\u2019ongle devient miroir, sans vernis, sans abrasion.',
      accent: 'champagne',
    },
  ];
}

/**
 * Les trois promesses du visuel officiel, réécrites en
 * « impact-on-others » (Copy #29).
 */
function buildClaims(): ProductFeedClaim[] {
  return [
    {
      icon: 'leaf',
      label: 'Ingr\u00E9dients d\u2019origine naturelle',
      detail: 'Cire d\u2019abeille, jojoba, kaolin, poudre de riz \u2014 manucure japonaise.',
    },
    {
      icon: 'drop',
      label: 'Sans produits chimiques agressifs',
      detail: 'Ni ac\u00E9tone, ni phtalates, ni toluene \u2014 la plaque respire.',
    },
    {
      icon: 'sparkle',
      label: 'Pour des ongles forts et \u00E9clatants',
      detail: 'K\u00E9ratine renforc\u00E9e, brillance lustr\u00E9e au polissoir Step\u00A04.',
    },
  ];
}

/**
 * Sélectionne la citation la plus courte parmi les témoignages mains —
 * une citation brève « lit » mieux dans un bandeau de social proof
 * (Kolenda Attention : low-density text wins focus).
 *
 * Le rating + reviewsCount viennent de `stats` (lu depuis la DB par le
 * caller). Si `stats` est null/undefined (pas de reviews encore en
 * base ou caller legacy qui ne passe pas le 3ᵉ argument), on retombe
 * sur `DEFAULT_KIT_REVIEW_STATS` — chiffres précis (Pricing #14)
 * cohérents avec le visuel produit imprimé.
 */
function buildSocialProof(
  content: KitPageContent,
  stats: ProductReviewStats | null | undefined,
): ProductFeedSocialProof {
  const quotes = content.handsTestimonials
    .map((t) => ({ quote: t.quote, label: `${t.authorFirstName}, ${t.city ?? 'Maroc'}` }))
    .sort((a, b) => a.quote.length - b.quote.length);
  const top = quotes[0] ?? {
    quote: 'Cinq minutes le soir, c\u2019est devenu un signal de fin de journée.',
    authorLabel: 'Lina, Rabat',
  };
  const effective = stats ?? DEFAULT_KIT_REVIEW_STATS;
  return {
    reviewsCount: effective.reviewsCount,
    rating: effective.rating,
    quote: top.quote ?? '',
    authorLabel: 'authorLabel' in top ? top.authorLabel : top.label,
    // Kolenda §4.6 — libellé géographique plus chaleureux que « avis ».
    // Le builder produit un défaut ; l'override admin peut le personnaliser.
    countLabelGeo: `${effective.reviewsCount} maisons en France`,
  };
}

/**
 * Construit le hero du pack — copy + pricing breakdown (Kolenda §4.6).
 *
 * Les champs `priceCompareAt`, `valueBreakdown`, `perUsageHint` et
 * `ctaAccent` sont produits par défaut depuis le `product` mock. Un
 * override admin (Phase 4) pourra patcher individuellement via
 * `pickPatch`.
 *
 * **Décision archi** : pour rester indépendant de la devise du `product`
 * (MAD vs EUR), on prend le prix actuel comme référence et on dérive un
 * `priceCompareAt` ~1,4×. Cela donne un savings crédible sans table de
 * prix séparés en dur. Les autres labels (`valueBreakdown`) restent fixes
 * en EUR — c'est la valeur perçue, pas une ventilation comptable.
 */
function buildHero(product: Product): ProductFeedHero {
  const compareMajor = Math.round((product.priceCents * 1.4) / 100);
  const compareLabel = `${compareMajor} ${product.currency === 'MAD' ? 'MAD' : '€'}`;

  const valueBreakdown: ProductFeedValueItem[] = [
    { label: '1 Paste · 30 ml', valueLabel: '19 €' },
    { label: '2 Powder · 30 g', valueLabel: '14 €' },
    { label: 'Polissoir 4 zones', valueLabel: '12 €' },
    { label: 'Notice rituel + carte', valueLabel: 'offert', muted: true },
  ];

  // Coût par soin : ~47 soins pour 1 mois et demi d'usage standard.
  // Unité alignée sur la devise du produit (cohérence visuelle avec
  // le prix XXL — éviter savings € sur prix MAD).
  const currencyUnit = product.currency === 'MAD' ? 'MAD' : '€';
  const perUsage = buildPerUsageHint(product.priceCents, 47, currencyUnit);

  return {
    kicker: 'Le pack',
    // Présent + verbes d'action (Copy #1).
    title: 'Le rituel s’installe en deux gestes et un polissoir.',
    lead:
      'Trois objets dans la main, deux gestes dans la soirée. La paste filme, la powder lustre, le polissoir Step 4 révèle — manucure japonaise, pensée à Rabat.',
    pricePrefix: 'Tout compris :',
    ctaLabel: 'Commander le rituel',
    // Microcopy serrée (Pricing #11) — chiffres précis (Pricing #14).
    ctaMicrocopy:
      'Paste · Powder · Polissoir Step 4 inclus · Livraison offerte au Maroc · Paiement à la livraison · Retour 30 j.',
    priceCompareAt: compareLabel,
    priceCompareAtAriaLabel: `Prix non packagé ${compareLabel}`,
    valueBreakdown,
    perUsageHint: perUsage ?? undefined,
    ctaAccent: 'sauge-dark',
  };
}

/**
 * Construit le feed produit complet. La fonction est pure : à
 * mêmes entrées, même sortie — elle est testée à ce contrat.
 *
 * `stats` est optionnel : si non passé (ou null), le builder retombe
 * sur `DEFAULT_KIT_REVIEW_STATS` pour conserver la rétro-compatibilité
 * avec les tests qui n'ont pas de reviews en base.
 */
export function buildKitProductFeed(
  product: Product,
  content: KitPageContent,
  stats?: ProductReviewStats | null,
): ProductFeed {
  const origin = siteOrigin();
  // Merchant rejette les SVG → on sélectionne / dérive une URL raster.
  // Le rendu HTML continue à utiliser le SVG via `product.images` ; seul
  // le feed XML est forcé en raster.
  const imageUrl = pickMerchantImageUrl(product.images, origin);

  const feed: ProductFeed = {
    productSlug: product.slug,
    locale: 'fr-MA',
    canonicalUrl: `${origin}/kit`,
    imageUrl,
    brand: 'FemiGlow',
    currency: product.currency,
    priceMajor: toMajor(product.priceCents),
    promoPriceMajor:
      product.promoPriceCents && product.promoPriceCents > 0
        ? toMajor(product.promoPriceCents)
        : null,
    availability: product.inStock ? 'in_stock' : 'out_of_stock',
    description: product.description,
    hero: buildHero(product),
    steps: buildSteps(),
    claims: buildClaims(),
    socialProof: buildSocialProof(content, stats),
  };

  // Validation runtime — fail-fast en dev/test pour repérer toute
  // dérive du contrat (champ manquant, type erroné, contrainte
  // métier violée). En prod, on log mais on ne crash pas la SSR :
  // un feed légèrement dégradé est moins grave qu'une page 500.
  assertValidProductFeed(feed, {
    strict: process.env.NODE_ENV !== 'production',
  });

  return feed;
}
