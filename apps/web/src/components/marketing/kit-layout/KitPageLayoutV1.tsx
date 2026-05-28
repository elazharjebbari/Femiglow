/**
 * Layout v1 — ordre 14 sections (état historique).
 *
 * Référence : `docs/kit-landing-reorder-2026-05/01-context-baseline.md`.
 *
 * IMPORTANT : aucune modification fonctionnelle vs `kit/page.tsx` historique.
 * Ce fichier est l'exact JSX d'origine ; toute divergence v1 serait un bug.
 * Le flag `NEXT_PUBLIC_KIT_LAYOUT_V2` doit pouvoir basculer en `v1` à tout
 * moment et restaurer l'expérience pré-refonte (rollback < 60 sec).
 */
import { Suspense } from 'react';

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
import { JsonLd, faqPageSchema } from '@/lib/seo/json-ld';

import type { KitPageLayoutProps } from './types';

export function KitPageLayoutV1({
  content,
  journalArticles,
  dbProduct,
  productJsonLd,
  reviewStats,
  ritualSummary,
  locale,
}: KitPageLayoutProps) {
  return (
    <div id="contenu-kit" className="pb-24 lg:pb-0" data-kit-layout="v1">
      <GeoPromoSlideHeaderSlot />
      <JsonLd data={productJsonLd} />
      <JsonLd data={faqPageSchema(content.faq)} />
      <HeroProduitBound
        product={dbProduct}
        reassurances={content.reassurances}
        componentKey="kit-hero-produit"
        locale={locale}
        // Le count badge avis vient du module rituels (« voix de la maison »)
        // — c'est le seul bloc social proof à grande échelle de la page.
        // 47 en DB courante. Fallback handsTestimonials.length si rituals
        // est vide (dev local sans seed). Devient ignoré dès qu'une review
        // DB product_reviews réelle existe (cf. HeroProduitBound).
        reviewsCountOverride={
          ritualSummary.totalCount > 0
            ? ritualSummary.totalCount
            : (content.handsTestimonials?.length ?? 0)
        }
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
