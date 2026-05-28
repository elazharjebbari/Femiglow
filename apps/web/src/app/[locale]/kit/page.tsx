/**
 * Page `/[locale]/kit` — migration depuis `/kit` legacy.
 *
 * La page /kit est la page conversion principale (Kolenda playbook). Elle est
 * fortement couplée au CMS : `resolveSeoMetadata` cascade (admin override →
 * settings → fallback), CAPI server-side tracking, layout v1/v2 derrière
 * feature flag, JSON-LD Product enrichi (aggregateRating + review).
 *
 * Stratégie Phase 2 : minimal viable wrapper i18n. On :
 *  - Localise le canonical + hreflang alternates (path locale-aware)
 *  - Set og.locale selon params.locale (fr_MA / ar_MA / en_US)
 *  - Préserve l'admin override CMS (`resolveSeoMetadata`) pour title/desc
 *  - Garde KitPageLayoutV1/V2 intacts (contenu FR jusqu'à Phase 3)
 *  - Adapt CAPI pageRoute en `/${locale}/kit` (URLs trackées correctement)
 *
 * Phase 3 (CMS multilingue) :
 *  - `resolveSeoMetadata` étendu pour fetcher par locale
 *  - `cms.getKitPageContent({ locale })` retourne le contenu localisé
 *  - JSON-LD Product utilise les reviews de la locale active
 *
 * @see docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md
 * @see docs/i18n-strategy-2026-05/08-plan-action/phases.md §T2.9
 */
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';

import { KitPageLayoutV1 } from '@/components/marketing/kit-layout/KitPageLayoutV1';
import { KitPageLayoutV2 } from '@/components/marketing/kit-layout/KitPageLayoutV2';
import { isLocale, type Locale } from '@/i18n.config';
import { cms } from '@/lib/cms';
import { KIT_LAYOUT_VERSION } from '@/lib/feature-flags/kit-layout';
import { buildKitProductFeed } from '@/lib/products/feed/kit-feed';
import { feedToProductSchemaEnrichment } from '@/lib/products/feed/json-ld';
import {
  buildKitPublicProduct,
  KIT_LOCALE,
  KIT_PRODUCT_SLUG,
} from '@/lib/products/public';
import { getProductReviewStats } from '@/lib/products/reviews';
import { getRitualSummary } from '@/lib/db/queries/rituals';
import { resolveOgImage } from '@/lib/components/og-image';
import { resolvePageWithComponents } from '@/lib/seo/component-resolve';
import { resolveSeoMetadata } from '@/lib/seo/resolve';
import { productSchema } from '@/lib/seo/json-ld';
import { computePromo } from '@/lib/utils/promo';
import { deriveEventId } from '@/lib/tracking/event-id';
import { serverFire } from '@/lib/tracking/server/server-fire';

const FALLBACK_OG = {
  url: '/og/kit.svg',
  width: 1200,
  height: 630,
  alt: 'Le pack FemiGlow — paste, powder, polissoir Step 4',
};

const FALLBACK_TITLE = 'Le pack FemiGlow — manucure japonaise';
const FALLBACK_DESCRIPTION =
  'Pack FemiGlow — coffret de manucure japonaise en deux gestes. Paste verte sauge, powder rose poudré et polissoir Step 4 Polish & Shine. Pensé à Rabat par notre équipe. Sans vernis, sans abrasion. Livraison offerte au Maroc.';

interface PageProps {
  params: { locale: string };
  searchParams?: { layout?: string };
}

// ---------------------------------------------------------------------------
// generateMetadata — CMS override + locale-aware canonical/hreflang
// ---------------------------------------------------------------------------

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  if (!isLocale(params.locale)) {
    return { title: FALLBACK_TITLE };
  }
  const og = (await resolveOgImage('kit-og')) ?? FALLBACK_OG;

  // Phase 5 SEO override (admin CMS) — cf. /kit legacy. Non-locale-aware
  // pour l'instant ; Phase 3 étendra `resolvePageWithComponents` pour
  // accepter params.locale et chercher l'override par locale.
  const seo = await resolvePageWithComponents({
    pageScope: 'product',
    pageTargetKey: KIT_PRODUCT_SLUG,
    locale: KIT_LOCALE,
    fallback: { title: FALLBACK_TITLE, description: FALLBACK_DESCRIPTION },
    components: [
      { componentKey: 'kit-hero', overridableFields: ['title', 'ogTitle'] },
    ],
  });

  const canonicalPath = `/${params.locale}/kit`;

  return {
    title: seo.title,
    description: seo.description,
    alternates: {
      canonical: seo.canonical ?? canonicalPath,
      languages: {
        fr: '/fr/kit',
        ar: '/ar/kit',
        en: '/en/kit',
        'x-default': '/fr/kit',
      },
    },
    robots: { index: seo.robots.index, follow: seo.robots.follow },
    openGraph: {
      type: 'website',
      locale:
        params.locale === 'ar'
          ? 'ar_MA'
          : params.locale === 'en'
            ? 'en_US'
            : 'fr_MA',
      title: seo.og.title,
      description: seo.og.description,
      images: [
        { url: og.url, width: og.width, height: og.height, alt: og.alt },
      ],
    },
    twitter: {
      card: seo.twitter.card,
    },
  };
}

export const revalidate = 1800;

// ---------------------------------------------------------------------------
// Type guards (préservés de la version legacy)
// ---------------------------------------------------------------------------

function isJsonLdRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProductSchema(value: unknown): value is Record<string, unknown> {
  return (
    isJsonLdRecord(value) &&
    (value as Record<string, unknown>)['@type'] === 'Product'
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function KitPage({ params, searchParams }: PageProps) {
  if (!isLocale(params.locale)) {
    notFound();
  }
  const locale = params.locale as Locale;
  setRequestLocale(locale);

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

  const reviewStats = await getProductReviewStats(dbProduct.id);
  const ritualSummary = await getRitualSummary('pack-femiglow');

  // Tracking ViewContent — CAPI server-side avec pageRoute localisé.
  const reqHeaders = headers();
  const reqCookies = cookies();
  const sessionId =
    reqCookies.get('fg_session_id')?.value ??
    reqCookies.get('_fbp')?.value ??
    null;
  const eventIdSeed = sessionId
    ? deriveEventId({ eventName: 'view_item', sessionId, pageId: 'kit' })
    : undefined;
  void eventIdSeed;
  const kitPromo = computePromo(dbProduct.priceCents, dbProduct.promoPriceCents);
  void serverFire({
    eventName: 'view_item',
    pageId: 'kit',
    pageRoute: `/${locale}/kit`,
    pageUrl: `https://femiglow-maroc.com/${locale}/kit`,
    params: {
      currency: dbProduct.currency,
      value: kitPromo.effectivePriceCents / 100,
      items: [
        {
          item_id: dbProduct.id,
          item_name: dbProduct.name,
          price: kitPromo.effectivePriceCents / 100,
          quantity: 1,
        },
      ],
    },
    headers: reqHeaders,
    cookies: reqCookies,
  });

  // Product JSON-LD — admin override + aggregateRating system-driven.
  const productFeed = buildKitProductFeed(dbProduct, content, reviewStats);
  const enrichment = feedToProductSchemaEnrichment(
    productFeed,
    content.handsTestimonials,
  );
  const enrichedAuto = productSchema(dbProduct, `/${locale}/kit`, enrichment);
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

  // Délégation au layout v1 ou v2 (query param > env var > default).
  const qsLayout = searchParams?.layout;
  const effectiveLayout: 'v1' | 'v2' =
    qsLayout === 'v2' ? 'v2' : qsLayout === 'v1' ? 'v1' : KIT_LAYOUT_VERSION;
  const layoutProps = {
    content,
    journalArticles,
    dbProduct,
    productJsonLd,
    reviewStats,
    ritualSummary,
  };
  return effectiveLayout === 'v2' ? (
    <KitPageLayoutV2 {...layoutProps} />
  ) : (
    <KitPageLayoutV1 {...layoutProps} />
  );
}
