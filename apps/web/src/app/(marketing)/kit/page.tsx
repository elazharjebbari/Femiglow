import type { Metadata } from 'next';
import { resolveUrlCouponSeed } from '@/lib/coupons/server-url-coupon';
import { cookies, headers } from 'next/headers';

import { cms } from '@/lib/cms';
import { computePromo } from '@/lib/utils/promo';
import { deriveEventId } from '@/lib/tracking/event-id';
import { serverFire } from '@/lib/tracking/server/server-fire';
import { KitAngleCookie } from '@/components/kit/KitAngleCookie';
import { resolveKitPageContext } from '@/lib/kit/page-context.server';
import { DEFAULT_LOCALE } from '@/i18n.config';
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
import { getKitReviewStats } from '@/lib/products/reviews';
import { KIT_COPY, KIT_FACTS } from '@/lib/products/kit-facts';
import { KIT_LAYOUT_VERSION } from '@/lib/feature-flags/kit-layout';
import { KitPageLayoutV1 } from '@/components/marketing/kit-layout/KitPageLayoutV1';
import { KitPageLayoutV2 } from '@/components/marketing/kit-layout/KitPageLayoutV2';

const FALLBACK_OG = {
  url: '/og/kit.svg',
  width: 1200,
  height: 630,
  alt: 'Le pack FemiGlow — pâte, poudre, polissoir Step 4',
};

const FALLBACK_TITLE = 'Le pack FemiGlow — manucure japonaise';
const FALLBACK_DESCRIPTION = `Pack FemiGlow — manucure japonaise en ${KIT_COPY.fr.gesturesLower}, ${KIT_COPY.fr.duration} ${KIT_COPY.fr.frequency}. Pâte ${KIT_FACTS.paste.grams} g, poudre ${KIT_FACTS.powder.grams} g et polissoir Step 4 Polish & Shine. Pensé à Rabat. Sans vernis, sans abrasion. Livraison partout au Maroc, paiement à la livraison.`;

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
  searchParams?: {
    layout?: string;
    /** Code de campagne (`/kit?code=GLOW99`) — voir resolveUrlCouponSeed. */
    code?: string;
    promo?: string;
    coupon?: string;
    /** Kit CRO v2 §3 — forçage de l'angle pour la recette (`?angle=e`). */
    angle?: string | string[];
    /** Angle publicitaire porté par les publicités Meta (`A-darija`, `E-fr`…). */
    utm_content?: string | string[];
    /** Recette : `?hmv=off` coupe les images par audience pour l'URL. */
    hmv?: string | string[];
    /** Aperçu admin des images par audience brouillons (session requise). */
    hmv_preview?: string | string[];
  };
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
  // Avis — source unique pour hero, bloc pack/prix et JSON-LD : compteur
  // des témoignages approuvés (module rituels, même chiffre que la section
  // « Les voix de la maison ») + note réelle si elle existe. Null si aucune
  // donnée : compteur et note sont masqués partout.
  const reqCookies = cookies();
  const reviewStatsPromise = getKitReviewStats(dbProduct.id);
  // Kit CRO v2 §3 + images par audience (PR 4) — angle publicitaire
  // (`?angle=` > `utm_content` > cookie), drapeau `HERO_MEDIA_VARIANTS` ×
  // CMS × `?hmv=off`, galerie du hero résolue UNE fois : HTML, `view_item`
  // serveur et client portent la même variante.
  // Résolu en parallèle des stats d'avis (cookies lus en amont).
  const [reviewStats, kitContext] = await Promise.all([
    reviewStatsPromise,
    resolveKitPageContext({
      locale: DEFAULT_LOCALE,
      searchParams,
      cookies: reqCookies,
      product: dbProduct,
      fallbackAlt: content.product.name,
    }),
  ]);

  // Tracking ViewContent — fire CAPI server-side avec event_id déterministe
  // partagé avec le Pixel client (via ViewItemTracker.eventIdSeed). Meta
  // dédup transparent entre les deux canaux.
  //
  // Objectif Phase 2 : combler le gap CAPI signalé par Meta (7 881 events
  // de moins côté serveur sur 7 j). Le serveur devient la source fiable.
  // cf. docs/meta-quality-audit-2026-05/02-plan-dev-action.md step 2.6
  const reqHeaders = headers();
  const { kitAngle } = kitContext;
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
  // Aperçu brouillon admin : aucun envoi CAPI (variante non publiée).
  // La galerie (et donc `hero_media_variant`) se résout en parallèle du
  // rendu : l'envoi part dès qu'elle est prête, sans bloquer la page.
  if (kitContext.shouldServerFire) {
    void kitContext.viewItemParams
      .then((viewItemParams) =>
        serverFire({
          eventName: 'view_item',
          pageId: 'kit',
          pageRoute: '/kit',
          pageUrl: `https://femiglow-maroc.com/kit`,
          params: {
            // `kit_angle`, plus `hero_media_variant` / `hero_media_level` quand le
            // drapeau est actif (cf. lib/kit/hero-media.ts).
            ...viewItemParams,
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
        }),
      )
      // Erreur de galerie : remontée par le hero ; ignorée ici.
      .catch(() => undefined);
  }

  // Schema.org Product :
  //  - L'admin garde l'autorité éditoriale sur name / description / offers
  //    via `seo.structuredData` (override CMS, scope product).
  //  - L'aggregateRating + review sont **toujours** system-driven (calculés
  //    depuis le feed kit + les testimonials du CMS). Sans aggregateRating,
  //    Google n'affiche AUCUNE étoile dans les SERP.
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
  // Note et avis toujours issus de `getKitReviewStats` : on écrase (ou on
  // retire) ceux d'un éventuel override admin pour ne jamais publier un
  // chiffre figé.
  if (enrichedAuto.aggregateRating !== undefined) {
    productJsonLd.aggregateRating = enrichedAuto.aggregateRating;
  } else {
    delete productJsonLd.aggregateRating;
  }
  if (enrichedAuto.review !== undefined) {
    productJsonLd.review = enrichedAuto.review;
  } else {
    delete productJsonLd.review;
  }

  // Délégation au layout v1 ou v2.
  // Cascade : query param ?layout=v2|v1 (preview override) → env var
  // NEXT_PUBLIC_KIT_LAYOUT_V2 (rollout prod). La query string n'altère
  // pas le canonical (resolveSeoMetadata fige `/kit`).
  // Référence : `docs/kit-landing-reorder-2026-05/`.
  // Code de campagne présent dans l'URL, validé côté serveur pour que le
  // PREMIER paint porte déjà le prix remisé. Sans `?code=`, aucune requête
  // n'est émise et le rendu est strictement identique à l'existant.
  const initialCoupon = await resolveUrlCouponSeed(searchParams);

  const qsLayout = searchParams?.layout;
  const effectiveLayout: 'v1' | 'v2' =
    qsLayout === 'v2'
      ? 'v2'
      : qsLayout === 'v1'
        ? 'v1'
        : KIT_LAYOUT_VERSION;
  const layoutProps = {
    initialCoupon,
    content,
    journalArticles,
    dbProduct,
    productJsonLd,
    reviewStats,
    kitAngle: kitAngle.angle,
    // Galerie du hero résolue une seule fois (cf. resolveKitPageContext).
    heroGallery: kitContext.heroGallery,
    // Arbre legacy (`/kit` servi sans i18n) : le bandeau promo géolocalisé
    // reste actif, comme avant.
    promoBannerEnabled: true,
  };
  return (
    <>
      {kitContext.draftPreview ? null : (
        <KitAngleCookie
          angle={kitAngle.angle}
          fromUrl={kitAngle.source === 'query' || kitAngle.source === 'utm'}
        />
      )}
      {effectiveLayout === 'v2' ? (
        <KitPageLayoutV2 {...layoutProps} />
      ) : (
        <KitPageLayoutV1 {...layoutProps} />
      )}
    </>
  );
}
