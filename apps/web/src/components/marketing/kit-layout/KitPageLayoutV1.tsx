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
import { getTranslations } from 'next-intl/server';

import {
  FAQContextuelle,
  PivotFinal,
} from '@/components/sections';
import { VideoPlayer4GestesKitBound } from '@/components/sections/VideoPlayer4GestesKitBound';
import { HeroProduitBound } from '@/components/sections/HeroProduitBound';
import { StoriesVideoBound } from '@/components/sections/StoriesVideoBound';
import { CompositionRevealBound } from '@/components/sections/CompositionRevealBound';
import { IngredientsDetailsBound } from '@/components/sections/IngredientsDetailsBound';
import { resolveKitComposition } from '@/lib/kit/composition/resolver';
import { ComparatifSectionBound } from '@/components/sections/ComparatifSectionBound';
import { HandsTestimonialsBound } from '@/components/sections/HandsTestimonialsBound';
import { JournalGridBound } from '@/components/sections/JournalGridBound';
import { ProductFeedSectionBound } from '@/components/sections/ProductFeedSectionBound';
import { RitualsModuleBound } from '@/components/sections/rituals/RitualsModuleBound';
import { RitualsWallDrawer } from '@/components/sections/rituals/RitualsWallDrawer';
import { resolveRitualsWallStrings } from '@/components/sections/rituals/strings';
import { KitCommanderSectionBound } from '@/components/sections/KitCommanderSectionBound';
import { GeoPromoSlideHeaderSlot } from '@/components/promo/GeoPromoSlideHeaderSlot';
import { DEFAULT_LOCALE } from '@/i18n.config';
import { JsonLd, faqPageSchema } from '@/lib/seo/json-ld';

import type { KitPageLayoutProps } from './types';

export async function KitPageLayoutV1({
  content,
  journalArticles,
  dbProduct,
  productJsonLd,
  reviewStats,
  ritualSummary,
  locale,
}: KitPageLayoutProps) {
  const effectiveLocale = locale ?? DEFAULT_LOCALE;
  // Phase 7E — strings de niveau layout (kicker/title JournalGrid) localisées.
  // `?? DEFAULT_LOCALE` : le legacy `(marketing)/kit` ne passe pas de locale.
  const [tKit, tRituals, tJournal] = await Promise.all([
    getTranslations({ locale: effectiveLocale, namespace: 'marketing.kit' }),
    // Phase 7 wiring — libellés du drawer « rituels partagés » (client
    // component) résolus côté serveur puis injectés en prop.
    getTranslations({
      locale: effectiveLocale,
      namespace: 'marketing.kit.rituals',
    }),
    // Phase 9bis — libellés de catégorie + CTA du JournalGrid localisés
    // (« Maison/Voix/Pratique » + « Lire le journal » fuitaient sur /ar).
    getTranslations({
      locale: effectiveLocale,
      namespace: 'marketing.journal',
    }),
  ]);
  const journalCategoryLabels = {
    maison: tJournal('categories.maison'),
    saison: tJournal('categories.saison'),
    voix: tJournal('categories.voix'),
    matieres: tJournal('categories.matieres'),
    pratique: tJournal('categories.pratique'),
  };
  // Drawer (client) : libellés STRUCTURELS résolus serveur. Les témoignages
  // restent seed data (hors scope i18n).
  const wallStrings = resolveRitualsWallStrings(
    tRituals as unknown as Parameters<typeof resolveRitualsWallStrings>[0],
  );
  // Phase 7E (7E-10) — composition ingrédients locale-aware. En FR (défaut) on
  // garde `resolveKitComposition()` (mock FR + overrides admin) pour ne RIEN
  // changer ; en AR/EN on prend `content.composition` (déjà localisé via
  // kit.ar.ts / kit.en.ts) — sinon IngredientsDetails fuitait le FR de kit.ts.
  const ingredientsComposition =
    (locale ?? DEFAULT_LOCALE) === DEFAULT_LOCALE
      ? resolveKitComposition().map((it) => it.subProduct)
      : content.composition;
  // Phase 9 i18n — libellés de colonnes ingrédients localisés. Sur /ar on
  // affiche aussi l'INCI latin entre parenthèses (toléré par l'audit strict).
  const ingredientLabels = {
    ingredient: tKit('ingredients.columns.ingredient'),
    inci: tKit('ingredients.columns.inci'),
    function: tKit('ingredients.columns.function'),
    origin: tKit('ingredients.columns.origin'),
    regionAria: tKit('ingredients.section.kicker'),
    inciInParens: effectiveLocale === 'ar',
  };
  // Phase 7E (7E-10) — vidéo localisée (transcript) : FR garde resolveKitVideo
  // (override admin) ; AR/EN prennent content.videoSrc (transcript traduit).
  const localizedVideo =
    (locale ?? DEFAULT_LOCALE) === DEFAULT_LOCALE ? undefined : content.videoSrc;
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
        // Phase 7E — nom + tagline localisés depuis le CMS (FR/AR/EN) pour
        // remplacer le nom DB FR ("Pack FemiGlow") et la tagline FR hardcodée.
        displayName={content.product.name}
        taglineFallback={content.product.tagline}
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
      {/* Stories vidéo — DESKTOP uniquement ici (après le Hero). Sur mobile, le
        bloc est rendu DANS le hero (sous les images, avant le titre) via
        `storiesSlot`. Cf. docs/stories-video-2026-08-21/. */}
      <div className="hidden lg:block">
        <StoriesVideoBound locale={locale} />
      </div>
      {/*
        CHA-230 — Funnel commander embarqué (Mode A — wizard_embed) remonté
        immédiatement sous le Hero pour capter l'intention chaude avant que
        l'utilisateur ne dérive vers les sections de réassurance. Cible des
        CTA in-page et de la sticky bottom ; le client passe par
        lead → address → thank_you sans quitter la page.
      */}
      <KitCommanderSectionBound locale={locale} />
      <CompositionRevealBound
        items={content.composition}
        header={{
          kicker: tKit('composition.section.kicker'),
          title: tKit('composition.section.title'),
          description: tKit('composition.section.description'),
        }}
        cardCta={tKit('composition.card_cta')}
      />
      <VideoPlayer4GestesKitBound locale={locale} videoOverride={localizedVideo} />
      <IngredientsDetailsBound
        composition={ingredientsComposition}
        componentKey="kit-detail-mains"
        ingredientLabels={ingredientLabels}
        postCtaLabel={tKit('ingredients.post_cta')}
        header={{
          kicker: tKit('ingredients.section.kicker'),
          title: tKit('ingredients.section.title'),
          description: tKit('ingredients.section.description'),
        }}
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
        locale={locale}
      />
      <ComparatifSectionBound
        data={content.comparatif}
        header={{
          kicker: tKit('comparatif.kicker'),
          title: tKit('comparatif.title'),
          description: tKit('comparatif.description'),
        }}
        axisLabel={tKit('comparatif.axis_label')}
      />
      <RitualsModuleBound productKey="pack-femiglow" locale={effectiveLocale} />
      <FAQContextuelle
        items={content.faq}
        header={{
          kicker: tKit('faq.section.kicker'),
          title: tKit('faq.section.title'),
          description: tKit('faq.section.description'),
        }}
      />
      <HandsTestimonialsBound
        items={content.handsTestimonials}
        header={{
          kicker: tKit('hands.kicker'),
          title: tKit('hands.title'),
          description: tKit('hands.description'),
        }}
        labels={{
          before: tKit('hands.labels.before'),
          after: tKit('hands.labels.after'),
          initieeSince: tKit('hands.labels.initiee_since', { date: '{date}' }),
        }}
      />
      <PivotFinal product={dbProduct} locale={locale} />
      <JournalGridBound
        articles={journalArticles}
        kicker={tKit('journal_grid.kicker')}
        title={tKit('journal_grid.title')}
        ctaLabel={tJournal('grid.cta')}
        categoryLabels={journalCategoryLabels}
        variant="symmetric"
      />
      <Suspense fallback={null}>
        <RitualsWallDrawer productKey="pack-femiglow" strings={wallStrings} />
      </Suspense>
    </div>
  );
}
