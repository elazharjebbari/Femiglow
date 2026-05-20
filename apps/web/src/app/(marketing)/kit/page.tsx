import type { Metadata } from 'next';
import { Suspense } from 'react';
import { cms } from '@/lib/cms';
import {
  FAQContextuelle,
  PivotFinal,
} from '@/components/sections';
import { VideoPlayer4GestesKitBound } from '@/components/sections/VideoPlayer4GestesKitBound';
import { HeroProduitBound } from '@/components/sections/HeroProduitBound';
import { CompositionRevealBound } from '@/components/sections/CompositionRevealBound';
import { IngredientsDetailsBound } from '@/components/sections/IngredientsDetailsBound';
import { resolveKitComposition } from '@/lib/kit/composition/resolver';
import { ComparatifSectionBound } from '@/components/sections/ComparatifSectionBound';
import { HandsTestimonialsBound } from '@/components/sections/HandsTestimonialsBound';
import { JournalGridBound } from '@/components/sections/JournalGridBound';
import { ProductFeedSectionBound } from '@/components/sections/ProductFeedSectionBound';
import { RitualsModuleBound } from '@/components/sections/rituals/RitualsModuleBound';
import { RitualsWallDrawer } from '@/components/sections/rituals/RitualsWallDrawer';
import { KitCommanderSectionBound } from '@/components/sections/KitCommanderSectionBound';
import { GeoPromoSlideHeaderSlot } from '@/components/promo/GeoPromoSlideHeaderSlot';
import { JsonLd, productSchema, faqPageSchema } from '@/lib/seo/json-ld';
import { resolveOgImage } from '@/lib/components/og-image';
import { resolveSeoMetadata } from '@/lib/seo/resolve';
import { resolvePageWithComponents } from '@/lib/seo/component-resolve';
import {
  KIT_LOCALE,
  KIT_PRODUCT_SLUG,
  buildKitPublicProduct,
} from '@/lib/products/public';
import { buildKitProductFeed } from '@/lib/products/feed/kit-feed';
import { feedToProductSchemaEnrichment } from '@/lib/products/feed/json-ld';
import { getProductReviewStats } from '@/lib/products/reviews';

const FALLBACK_OG = {
  url: '/og/kit.svg',
  width: 1200,
  height: 630,
  alt: 'Le pack FemiGlow — paste, powder, polissoir Step 4',
};

const FALLBACK_TITLE = 'Le pack FemiGlow — manucure japonaise';
const FALLBACK_DESCRIPTION =
  'Pack FemiGlow — coffret de manucure japonaise en deux gestes. Paste verte sauge, powder rose poudré et polissoir Step 4 Polish & Shine. Pensé à Rabat par Souheila. Sans vernis, sans abrasion. Livraison offerte au Maroc.';

export async function generateMetadata(): Promise<Metadata> {
  const og = (await resolveOgImage('kit-og')) ?? FALLBACK_OG;
  // Phase 5 — résolution page + composants. Le helper court-circuite si le
  // flag `NEXT_PUBLIC_SEO_COMPONENT_OVERRIDES` n'est pas à 'true' : dans ce
  // cas, retombe sur `resolveSeoMetadata` standard (zéro régression
  // vérifiée par snapshot kit-metadata).
  const seo = await resolvePageWithComponents({
    pageScope: 'product',
    pageTargetKey: KIT_PRODUCT_SLUG,
    locale: KIT_LOCALE,
    fallback: { title: FALLBACK_TITLE, description: FALLBACK_DESCRIPTION },
    components: [
      // Le hero kit peut porter son propre SEO override (scope='component',
      // targetKey='kit-hero'). Champs écrasables : title et OG title.
      // La description reste celle du produit (cohérence editorial).
      { componentKey: 'kit-hero', overridableFields: ['title', 'ogTitle'] },
    ],
  });
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: seo.canonical ?? '/kit' },
    robots: { index: seo.robots.index, follow: seo.robots.follow },
    openGraph: {
      type: 'website',
      locale: 'fr_MA',
      title: seo.og.title,
      description: seo.og.description,
      images: [{ url: og.url, width: og.width, height: og.height, alt: og.alt }],
    },
    twitter: {
      card: seo.twitter.card,
    },
  };
}

export const revalidate = 1800;

function isJsonLdRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * `seo.structuredData` retombe sur **Organization** (settings global) quand
 * aucun override Product publié n'existe — cf. `resolveSeoMetadata` qui
 * cascade `override?.structuredData ?? settings.organizationJsonLd`. Sans
 * ce filtre, on attacherait `aggregateRating + review` à un Organization,
 * ce qui produirait du markup Schema.org invalide.
 */
function isProductSchema(value: unknown): value is Record<string, unknown> {
  return (
    isJsonLdRecord(value) &&
    (value as Record<string, unknown>)['@type'] === 'Product'
  );
}

export default async function KitPage() {
  const [content, journalArticles, dbProduct, seo] = await Promise.all([
    cms.getKitPageContent(),
    cms.getArticles({ limit: 3 }),
    buildKitPublicProduct(),
    resolveSeoMetadata({
      scope: 'product',
      targetKey: KIT_PRODUCT_SLUG,
      locale: KIT_LOCALE,
      fallback: { title: FALLBACK_TITLE, description: FALLBACK_DESCRIPTION },
    }),
  ]);
  // Stats reviews lues séparément (dépendent de `dbProduct.id`). Null si
  // la base est encore vide : le builder retombe sur le starter rating.
  const reviewStats = await getProductReviewStats(dbProduct.id);

  // Schema.org Product :
  //  - L'admin garde l'autorité éditoriale sur name / description / offers
  //    via `seo.structuredData` (override CMS, scope product).
  //  - L'aggregateRating + review sont **toujours** system-driven (calculés
  //    depuis le feed kit + les testimonials du CMS). Sans aggregateRating,
  //    Google n'affiche AUCUNE étoile dans les SERP même avec 287 avis 4,8/5.
  //    On les injecte donc systématiquement, même quand un override existe,
  //    pour ne pas perdre les Rich Results.
  const productFeed = buildKitProductFeed(dbProduct, content, reviewStats);
  const enrichment = feedToProductSchemaEnrichment(
    productFeed,
    content.handsTestimonials,
  );
  const enrichedAuto = productSchema(dbProduct, '/kit', enrichment);
  const baseProductJsonLd: Record<string, unknown> = isProductSchema(
    seo.structuredData,
  )
    ? seo.structuredData
    : enrichedAuto;
  const productJsonLd: Record<string, unknown> = { ...baseProductJsonLd };
  if (enrichedAuto.aggregateRating !== undefined) {
    productJsonLd.aggregateRating = enrichedAuto.aggregateRating;
  }
  if (enrichedAuto.review !== undefined) {
    productJsonLd.review = enrichedAuto.review;
  }

  return (
    <div id="contenu-kit" className="pb-24 lg:pb-0">
      <GeoPromoSlideHeaderSlot />
      <JsonLd data={productJsonLd} />
      <JsonLd data={faqPageSchema(content.faq)} />
      <HeroProduitBound
        product={dbProduct}
        reassurances={content.reassurances}
        componentKey="kit-hero-produit"
      />
      {/*
        CHA-230 — Funnel commander embarqué (Mode A — wizard_embed) remonté
        immédiatement sous le Hero pour capter l'intention chaude avant que
        l'utilisateur ne dérive vers les sections de réassurance. Cible des
        CTA in-page et de la sticky bottom ; le client passe par
        lead → address → thank_you sans quitter la page.
      */}
      <KitCommanderSectionBound />
      <CompositionRevealBound items={content.composition} />
      <VideoPlayer4GestesKitBound />
      <IngredientsDetailsBound
        composition={resolveKitComposition().map((it) => it.subProduct)}
        componentKey="kit-detail-mains"
      />
      {/*
        Feed produit Kolenda-driven : densifie la conversion juste après
        les détails ingrédients et avant le comparatif. Apporte les 4
        gestes du rituel officiel + 3 promesses + social proof condensé.
        Copy/principes : `lib/products/feed/kit-feed.ts`.
      */}
      <ProductFeedSectionBound
        product={dbProduct}
        content={content}
        reviewStats={reviewStats}
      />
      <ComparatifSectionBound data={content.comparatif} />
      <RitualsModuleBound productKey="pack-femiglow" />
      <FAQContextuelle items={content.faq} />
      <HandsTestimonialsBound items={content.handsTestimonials} />
      <PivotFinal product={dbProduct} />
      <JournalGridBound
        articles={journalArticles}
        kicker="Pour aller plus loin"
        title="Trois lectures."
        variant="symmetric"
      />
      <Suspense fallback={null}>
        <RitualsWallDrawer productKey="pack-femiglow" />
      </Suspense>
    </div>
  );
}
