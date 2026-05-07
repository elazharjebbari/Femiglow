import type { Metadata } from 'next';
import { cms } from '@/lib/cms';
import {
  VideoPlayer4Gestes,
  FAQContextuelle,
  PivotFinal,
} from '@/components/sections';
import { HeroProduitBound } from '@/components/sections/HeroProduitBound';
import { CompositionRevealBound } from '@/components/sections/CompositionRevealBound';
import { IngredientsDetailsBound } from '@/components/sections/IngredientsDetailsBound';
import { ComparatifSectionBound } from '@/components/sections/ComparatifSectionBound';
import { HandsTestimonialsBound } from '@/components/sections/HandsTestimonialsBound';
import { JournalGridBound } from '@/components/sections/JournalGridBound';
import { JsonLd, productSchema, faqPageSchema } from '@/lib/seo/json-ld';
import { resolveOgImage } from '@/lib/components/og-image';
import { resolveSeoMetadata } from '@/lib/seo/resolve';
import {
  KIT_LOCALE,
  KIT_PRODUCT_SLUG,
  buildKitPublicProduct,
} from '@/lib/products/public';

const FALLBACK_OG = {
  url: '/og/kit.svg',
  width: 1200,
  height: 630,
  alt: 'Le kit FemiGlow — base, fortifiant, lime',
};

const FALLBACK_TITLE = 'Le kit FemiGlow — trois gestes, une saison';
const FALLBACK_DESCRIPTION =
  'Le kit réunit la base, le fortifiant et la lime. Trois gestes mesurés, pensés à Casablanca, livrés en 48 heures.';

export async function generateMetadata(): Promise<Metadata> {
  const og = (await resolveOgImage('kit-og')) ?? FALLBACK_OG;
  const seo = await resolveSeoMetadata({
    scope: 'product',
    targetKey: KIT_PRODUCT_SLUG,
    locale: KIT_LOCALE,
    fallback: { title: FALLBACK_TITLE, description: FALLBACK_DESCRIPTION },
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

  // Si l'override SEO publié fournit un schema produit, on le préfère ;
  // sinon on retombe sur le schema généré depuis le DB product (ou mock).
  const productJsonLd = isJsonLdRecord(seo.structuredData)
    ? (seo.structuredData as Record<string, unknown>)
    : productSchema(dbProduct, '/kit');

  return (
    <div id="contenu-kit" className="pb-24 lg:pb-0">
      <JsonLd data={productJsonLd} />
      <JsonLd data={faqPageSchema(content.faq)} />
      <HeroProduitBound
        product={dbProduct}
        reassurances={content.reassurances}
        componentKey="kit-hero-produit"
      />
      <CompositionRevealBound items={content.composition} />
      <VideoPlayer4Gestes video={content.videoSrc} />
      <IngredientsDetailsBound
        composition={content.composition}
        componentKey="kit-detail-mains"
      />
      <ComparatifSectionBound data={content.comparatif} />
      <FAQContextuelle items={content.faq} />
      <HandsTestimonialsBound items={content.handsTestimonials} />
      <PivotFinal product={dbProduct} />
      <JournalGridBound
        articles={journalArticles}
        kicker="Pour aller plus loin"
        title="Trois lectures."
        variant="symmetric"
      />
    </div>
  );
}
