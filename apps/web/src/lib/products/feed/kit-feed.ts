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
 *  - Pricing #14 — **Precise digits** : les chiffres affichés sont les
 *    vrais (avis : `getKitReviewStats`, contenances : `kit-facts.ts`).
 *  - Ecommerce #14 — Reviews count + average + quote, ensemble.
 *  - Luxury #6 — **Imply craftsmanship** : « affin\u00E9e \u00E0 Rabat »,
 *    « lustr\u00E9e au polissoir », « atelier marocain ».
 *
 * Toute évolution éditoriale du feed se fait ici. Les composants
 * (`<ProductFeedSection/>`) ne contiennent **aucun** texte produit.
 */
import type { KitPageContent, Product } from '@/lib/schemas';

import type { ProductReviewStats } from '../reviews';
import { KIT_COPY, KIT_FACTS } from '../kit-facts';
import { assertValidProductFeed } from './schema';
import type {
  ProductFeed,
  ProductFeedClaim,
  ProductFeedHero,
  ProductFeedSocialProof,
  ProductFeedStep,
  ProductFeedStepsHeader,
  ProductFeedStepsPostCta,
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
      duration: '30\u00A0s',
      icon: 'buffer',
    },
    {
      step: 2,
      kicker: 'Geste 1',
      title: 'Appliquez la p\u00E2te',
      description:
        'Une noisette de p\u00E2te, le polissoir glisse, la cire d\u2019abeille nourrit la k\u00E9ratine.',
      accent: 'sauge',
      duration: '1\u00A0min',
      icon: 'drop',
    },
    {
      step: 3,
      kicker: 'Geste 2',
      title: 'Appliquez la poudre',
      description:
        'On d\u00E9pose un voile de poudre blanche, on lustre lentement, la lumi\u00E8re revient \u00E0 la surface.',
      accent: 'petale',
      duration: '2\u00A0min',
      icon: 'sparkle',
    },
    {
      step: 4,
      kicker: 'Polissoir Step\u00A04',
      title: 'Polish & Shine',
      // Premier pas montr\u00E9 comme d\u00E9j\u00E0 accompli (Copy #21).
      description:
        'On finit au polissoir Step\u00A04 \u2014 l\u2019ongle devient miroir, sans vernis, sans abrasion.',
      accent: 'champagne',
      duration: '1\u00A0min',
      icon: 'mirror',
      isResult: true,
    },
  ];
}

/**
 * En-t\u00EAte de la grille des 4 gestes (Kolenda \u00A74.7 Attention #18).
 * Annonce la dur\u00E9e totale avant la liste pour r\u00E9duire l'anxi\u00E9t\u00E9 temps.
 */
function buildStepsHeader(): ProductFeedStepsHeader {
  return {
    kicker: 'EN TOUT',
    totalDuration: `${capitalize(KIT_COPY.fr.duration)} en tout`,
    lead: `${KIT_COPY.fr.gestures} lents, ${KIT_COPY.fr.frequency}.`,
  };
}

/**
 * CTA \u00E9ditorial chuchot\u00E9 sous la grille — relance vers
 * #commander-femiglow (Kolenda Attention #12, directional cues).
 */
function buildStepsPostCta(): ProductFeedStepsPostCta {
  return {
    label: 'D\u00E9marrer le rituel',
    anchorId: 'commander-femiglow',
  };
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
 * Le compteur + la note viennent de `stats` (`getKitReviewStats`, lu par
 * le caller). Sans stats (base vide, mode mémoire), le bloc n'existe pas :
 * on masque plutôt que d'afficher un chiffre inventé.
 */
function buildSocialProof(
  content: KitPageContent,
  stats: ProductReviewStats | null | undefined,
): ProductFeedSocialProof | undefined {
  if (!stats || stats.reviewsCount <= 0) return undefined;
  const quotes = content.handsTestimonials
    .map((t) => ({ quote: t.quote, label: `${t.authorFirstName}, ${t.city ?? 'Maroc'}` }))
    .sort((a, b) => a.quote.length - b.quote.length);
  const top = quotes[0];
  return {
    reviewsCount: stats.reviewsCount,
    rating: stats.rating,
    quote: top?.quote ?? '',
    authorLabel: top?.label ?? '',
    // Kolenda §4.6 — libellé géographique plus chaleureux que « avis ».
    // Le builder produit un défaut ; l'override admin peut le personnaliser
    // (le jeton `{count}` y est remplacé par le vrai compteur).
    countLabelGeo: `${stats.reviewsCount} maisons au Maroc`,
  };
}

/** « cinq minutes » → « Cinq minutes ». */
function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/**
 * Coût par soin : prix du pack réparti sur les soins qu'il contient
 * (`KIT_FACTS.treatmentsPerPack`, un soin par semaine ≈ six mois).
 * Format parsé par `localize.ts` (`≈ montant devise … N mot`).
 */
function buildPerSoinHint(priceCents: number, currencyUnit: string): string | null {
  const soins = KIT_FACTS.treatmentsPerPack;
  if (!Number.isFinite(priceCents) || priceCents <= 0) return null;
  const formatted = (priceCents / 100 / soins).toFixed(2).replace('.', ',');
  return `\u2248 ${formatted} ${currencyUnit} le soin, sur ${soins} soins`;
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
  // Base du prix barré = `priceCents` du Product (= prix avant promo).
  // - Si une promo est active (`promoPriceCents` > 0 et < priceCents),
  //   le prix XXL sera `promoPriceCents` (géré par `computePromo`
  //   côté PriceBlock) et le prix barré sera `priceCents`.
  // - Sinon, on retombe sur un fallback ~1,4× (pack vs séparé estimé)
  //   pour conserver un savings crédible même en l'absence de promo.
  const hasPromo =
    typeof product.promoPriceCents === 'number' &&
    product.promoPriceCents > 0 &&
    product.promoPriceCents < product.priceCents;
  const compareCents = hasPromo
    ? product.priceCents
    : Math.round(product.priceCents * 1.4);
  const effectiveCents = hasPromo
    ? (product.promoPriceCents as number)
    : product.priceCents;
  const compareMajor = Math.round(compareCents / 100);
  const currencyUnit = product.currency === 'MAD' ? 'MAD' : '€';
  const compareLabel = `${compareMajor} ${currencyUnit}`;

  // Répartition % du prix barré sur les 3 sous-produits — la somme
  // tombe *exactement* sur `compareMajor` (l'arrondi est absorbé par
  // le polissoir). Hiérarchie : Paste 40 % (matiere + complexité
  // formule), Powder 32 %, Polissoir reste. La/le lectrice peut
  // additionner mentalement et retomber pile sur le prix barré du
  // bandeau économie (Kolenda §4.6).
  const pasteVal = Math.round(compareMajor * 0.4);
  const powderVal = Math.round(compareMajor * 0.32);
  const polissoirVal = compareMajor - pasteVal - powderVal;

  const valueBreakdown: ProductFeedValueItem[] = [
    { label: `P\u00E2te · ${KIT_FACTS.paste.grams}\u00A0g`, valueLabel: `${pasteVal} ${currencyUnit}` },
    { label: `Poudre · ${KIT_FACTS.powder.grams}\u00A0g`, valueLabel: `${powderVal} ${currencyUnit}` },
    {
      label: `Polissoir Step\u00A04 · ${KIT_FACTS.polissoir.faces} faces`,
      valueLabel: `${polissoirVal} ${currencyUnit}`,
    },
    { label: 'Notice rituel + carte', valueLabel: 'offert', muted: true },
  ];

  // Coût par soin : le pack contient ~25 soins (un par semaine, environ
  // six mois). Unité alignée sur la devise du produit (cohérence visuelle
  // avec le prix XXL — éviter savings € sur prix MAD).
  const perUsage = buildPerSoinHint(effectiveCents, currencyUnit);

  return {
    kicker: 'Le pack',
    // Présent + verbes d'action (Copy #1).
    title: `Le rituel s’installe en ${KIT_COPY.fr.gesturesLower}, ${KIT_COPY.fr.frequency}.`,
    lead:
      'Trois objets dans la main, cinq minutes devant soi. La pâte nourrit, la poudre lustre, le polissoir Step 4 révèle — manucure japonaise, pensée à Rabat.',
    pricePrefix: 'Tout compris :',
    // Kit CRO v2 §4 — ton direct ; `{price}` est rempli côté client (prix net
    // du code appliqué). Surchargé par `kit-cta/ctaPack` s'il est publié.
    ctaLabel: 'Je commande — {price}',
    // Microcopy serrée (Pricing #11) — chiffres précis (Pricing #14).
    ctaMicrocopy:
      'Pâte · Poudre · Polissoir Step 4 inclus · Livraison partout au Maroc · Paiement à la livraison · Retour 30 j.',
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
 * `stats` est optionnel : si non passé (ou null), le feed n'a pas de
 * `socialProof` — compteur et note sont masqués partout.
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
    stepsHeader: buildStepsHeader(),
    stepsPostCta: buildStepsPostCta(),
    claims: buildClaims(),
  };
  const socialProof = buildSocialProof(content, stats);
  if (socialProof) feed.socialProof = socialProof;

  // Validation runtime — fail-fast en dev/test pour repérer toute
  // dérive du contrat (champ manquant, type erroné, contrainte
  // métier violée). En prod, on log mais on ne crash pas la SSR :
  // un feed légèrement dégradé est moins grave qu'une page 500.
  assertValidProductFeed(feed, {
    strict: process.env.NODE_ENV !== 'production',
  });

  return feed;
}
