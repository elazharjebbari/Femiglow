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
 *  - Luxury #6 — **Imply craftsmanship** : « affinée à Casablanca »,
 *    « lustrée au polissoir », « atelier marocain ».
 *
 * Toute évolution éditoriale du feed se fait ici. Les composants
 * (`<ProductFeedSection/>`) ne contiennent **aucun** texte produit.
 */
import type { KitPageContent, Product } from '@/lib/schemas';

import {
  DEFAULT_KIT_REVIEW_STATS,
  type ProductReviewStats,
} from '../reviews';
import { assertValidProductFeed } from './schema';
import type {
  ProductFeed,
  ProductFeedClaim,
  ProductFeedSocialProof,
  ProductFeedStep,
} from './types';

/** URL absolue du site (override possible via env pour l'XML Merchant). */
function siteOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  return fromEnv && fromEnv.length > 0 ? fromEnv : 'https://femiglow.ma';
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
      kicker: 'Geste 1',
      title: 'Préparez vos ongles',
      // Présent + verbes sensoriels (Kolenda Copy #1, #29).
      description:
        'On nettoie, on sèche, on lime légèrement — la plaque s\u2019ouvre au soin.',
      accent: 'sauge',
    },
    {
      step: 2,
      kicker: 'Geste 2',
      title: 'Appliquez Paste',
      description:
        'Une noisette de 1 Paste, le polissoir glisse, la cire entre dans la kératine.',
      accent: 'sauge',
    },
    {
      step: 3,
      kicker: 'Geste 3',
      title: 'Appliquez Powder',
      description:
        'On dépose 2 Powder, on lustre lentement, la lumière revient à la surface.',
      accent: 'petale',
    },
    {
      step: 4,
      kicker: 'Résultat',
      title: 'Brillance naturelle',
      // Premier pas montré comme déjà accompli (Copy #21).
      description:
        'Ongles lisses, lumineux, soignés — la main suffit, le geste tient la saison.',
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
      label: 'Ingrédients d\u2019origine naturelle',
      detail: 'Cire d\u2019abeille, jojoba, kaolin — sourcés au Maroc.',
    },
    {
      icon: 'drop',
      label: 'Sans produits chimiques agressifs',
      detail: 'Ni acétone, ni phtalates, ni toluene — la plaque respire.',
    },
    {
      icon: 'sparkle',
      label: 'Pour des ongles forts et éclatants',
      detail: 'Kératine renforcée, brillance lustrée à la main.',
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
    hero: {
      kicker: 'Le rituel',
      // Présent + verbes d'action (Copy #1).
      title: 'Le rituel s\u2019installe en quatre gestes.',
      lead:
        'Trois objets dans la main, quatre gestes dans la soirée. La paste filme, la poudre lustre, la plaque retrouve sa cadence — un soin lent, pensé à Casablanca.',
      pricePrefix: 'Tout compris :',
      ctaLabel: 'Composer mon rituel',
      // Microcopy serrée (Pricing #11) — chiffres précis (Pricing #14).
      ctaMicrocopy:
        'Paste · Powder · Polissoir inclus · Livraison 48 h · Paiement à la livraison · Retour 30 j.',
    },
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
