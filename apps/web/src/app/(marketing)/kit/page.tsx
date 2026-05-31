import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';

import { cms } from '@/lib/cms';
import { computePromo } from '@/lib/utils/promo';
import { deriveEventId } from '@/lib/tracking/event-id';
import { serverFire } from '@/lib/tracking/server/server-fire';
import { productSchema } from '@/lib/seo/json-ld';
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
import { getRitualSummary } from '@/lib/db/queries/rituals';
import { KIT_LAYOUT_VERSION } from '@/lib/feature-flags/kit-layout';
import { KitPageLayoutV1 } from '@/components/marketing/kit-layout/KitPageLayoutV1';
import { KitPageLayoutV2 } from '@/components/marketing/kit-layout/KitPageLayoutV2';

const FALLBACK_OG = {
  url: '/og/kit.svg',
  width: 1200,
  height: 630,
  alt: 'Le pack FemiGlow — paste, powder, polissoir Step 4',
};

const FALLBACK_TITLE = 'Le pack FemiGlow — manucure japonaise';
const FALLBACK_DESCRIPTION =
  'Pack FemiGlow — coffret de manucure japonaise en deux gestes. Paste verte sauge, powder rose poudré et polissoir Step 4 Polish & Shine. Pensé à Rabat par notre équipe. Sans vernis, sans abrasion. Livraison offerte au Maroc.';

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

/**
 * Override de layout par query param — strictement pour le preview interne
 * (équipe / Vercel preview deployments). En prod, le rollout passe par la
 * variable d'env Vercel `NEXT_PUBLIC_KIT_LAYOUT_V2` (4 paliers Canary →
 * Full, cf. doc 05-runbook-rollout).
 *
 * Pourquoi ne pas se contenter de l'env var ?
 *  - Permet à l'équipe de comparer v1 vs v2 sans rebuild
 *  - Permet aux Playwright `@kit-layout-v2` de cibler explicitement la v2
 *    quand le serveur est en v1 par défaut (test sans manipulation d'env)
 *  - Pas de SEO concern : le canonical de la page reste `/kit` (sans qs).
 */
interface KitPageProps {
  searchParams?: { layout?: string };
}

export default async function KitPage({ searchParams }: KitPageProps) {
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

  // Summary du module rituels (« voix de la maison »). C'est le bloc
  // social proof à grande échelle de la page — le badge hero doit
  // afficher SON count (vs handsTestimonials qui n'a que 3 cartes).
  // Anchor : la section porte H2 id="rituals-module-title".
  const ritualSummary = await getRitualSummary('pack-femiglow');

  // Tracking ViewContent — fire CAPI server-side avec event_id déterministe
  // partagé avec le Pixel client (via ViewItemTracker.eventIdSeed). Meta
  // dédup transparent entre les deux canaux.
  //
  // Objectif Phase 2 : combler le gap CAPI signalé par Meta (7 881 events
  // de moins côté serveur sur 7 j). Le serveur devient la source fiable.
  // cf. docs/meta-quality-audit-2026-05/02-plan-dev-action.md step 2.6
  const reqHeaders = headers();
  const reqCookies = cookies();
  const sessionId =
    reqCookies.get('fg_session_id')?.value ?? reqCookies.get('_fbp')?.value ?? null;
  const eventIdSeed = sessionId
    ? deriveEventId({ eventName: 'view_item', sessionId, pageId: 'kit' })
    : undefined;
  // `eventIdSeed` est réservé pour le futur tracking ViewItem client (Pixel
  // dédup serveur/client). Référencé ici pour conserver la séquence calc et
  // documenter l'intention — sera consommé quand le ViewItemTracker landera.
  void eventIdSeed;
  const kitPromo = computePromo(dbProduct.priceCents, dbProduct.promoPriceCents);
  void serverFire({
    eventName: 'view_item',
    pageId: 'kit',
    pageRoute: '/kit',
    pageUrl: `https://femiglow-maroc.com/kit`,
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

  // Délégation au layout v1 ou v2.
  // Cascade : query param ?layout=v2|v1 (preview override) → env var
  // NEXT_PUBLIC_KIT_LAYOUT_V2 (rollout prod). La query string n'altère
  // pas le canonical (resolveSeoMetadata fige `/kit`).
  // Référence : `docs/kit-landing-reorder-2026-05/`.
  const qsLayout = searchParams?.layout;
  const effectiveLayout: 'v1' | 'v2' =
    qsLayout === 'v2'
      ? 'v2'
      : qsLayout === 'v1'
        ? 'v1'
        : KIT_LAYOUT_VERSION;
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
