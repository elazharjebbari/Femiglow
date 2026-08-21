/**
 * Layout v2 — refonte Kolenda (arc hero → preuve → décision).
 *
 * Référence : `docs/kit-landing-reorder-2026-05/02-vision-arc.md`
 *           + `docs/kolenda/FEMIGLOW-KIT-PLAYBOOK.md` §4.6
 *
 * Position du wizard
 * ──────────────────
 * Kolenda §4.6 « Le pack » est explicitement décrit comme **la deuxième
 * zone de conversion de la page** (la première étant le CTA du hero qui
 * scroll au wizard). Le wizard doit matérialiser cette zone : on le
 * positionne **immédiatement après le ProductFeed §4.6/§4.7** (Pack +
 * Steps). L'utilisateur a alors vu :
 *   1. Composition (preuve formule)
 *   2. Vidéo 4 gestes (preuve usage)
 *   3. Pack + Steps avec prix complet, value-per-manucure, économie 191 MAD
 * → conversion à chaud maximal, sans avoir scrollé trop loin.
 *
 * Les HandsTestimonials viennent **APRÈS** le wizard : c'est de la
 * réassurance post-décision pour les utilisateurs qui ont scrollé au-
 * delà du wizard sans cliquer (Kolenda §4.10 — placement « après le
 * bloc commande » dans l'ordre playbook).
 *
 * Changements vs v1 :
 *   - Wizard à position 5 (après Pack §4.6) — 2ème zone de conversion
 *   - 2 sections retirées : Comparatif, PivotFinal
 *     (composants conservés dans le repo pour rollback ; non importés ici)
 *   - RitualsModule (« voix de la maison ») maintenu en post-wizard,
 *     seul bloc social proof à grande échelle. C'est lui que le badge
 *     hero référence (count + ancre #rituals-module-title).
 *   - 11 sections au lieu de 14 (cf. doc 01 P4 : Kolenda §1.3)
 *
 * NB : pas de sticky CTA bottom mobile ajouté — le `GeoPromoSlideHeaderSlot`
 * (top sticky de l'app) porte déjà un bouton « Commander » mobile.
 *
 * Tests : Playwright `@kit-layout-v2` dans `apps/web/e2e/kit-layout-v2.spec.ts`.
 */
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';

import { FAQContextuelle } from '@/components/sections';
import { VideoPlayer4GestesKitBound } from '@/components/sections/VideoPlayer4GestesKitBound';
import { HeroProduitBound } from '@/components/sections/HeroProduitBound';
import { StoriesVideoBound } from '@/components/sections/StoriesVideoBound';
import { CompositionRevealBound } from '@/components/sections/CompositionRevealBound';
import { IngredientsDetailsBound } from '@/components/sections/IngredientsDetailsBound';
import { resolveKitComposition } from '@/lib/kit/composition/resolver';
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

export async function KitPageLayoutV2({
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
    // Phase 9bis — libellés de catégorie + CTA du JournalGrid localisés.
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
  // Phase 7E (7E-10) — composition ingrédients locale-aware (cf. V1).
  const ingredientsComposition =
    (locale ?? DEFAULT_LOCALE) === DEFAULT_LOCALE
      ? resolveKitComposition().map((it) => it.subProduct)
      : content.composition;
  // Phase 9 i18n — libellés de colonnes ingrédients localisés (cf. V1).
  const ingredientLabels = {
    ingredient: tKit('ingredients.columns.ingredient'),
    inci: tKit('ingredients.columns.inci'),
    function: tKit('ingredients.columns.function'),
    origin: tKit('ingredients.columns.origin'),
    regionAria: tKit('ingredients.section.kicker'),
    inciInParens: effectiveLocale === 'ar',
  };
  // Phase 7E (7E-10) — vidéo localisée (transcript), cf. V1.
  const localizedVideo =
    (locale ?? DEFAULT_LOCALE) === DEFAULT_LOCALE ? undefined : content.videoSrc;
  return (
    <div id="contenu-kit" className="pb-24 lg:pb-0" data-kit-layout="v2">
      <GeoPromoSlideHeaderSlot />
      <JsonLd data={productJsonLd} />
      <JsonLd data={faqPageSchema(content.faq)} />

      {/* — 1. HERO — première zone de conversion (CTA → scroll wizard) */}
      <HeroProduitBound
        product={dbProduct}
        reassurances={content.reassurances}
        componentKey="kit-hero-produit"
        locale={locale}
        // Phase 7E — nom + tagline localisés depuis le CMS (FR/AR/EN) pour
        // remplacer le nom DB FR ("Pack FemiGlow") et la tagline FR hardcodée.
        displayName={content.product.name}
        taglineFallback={content.product.tagline}
        // Count badge avis depuis le module rituels (47 en DB courante).
        // Fallback handsTestimonials si rituals vide. L'ancre cliquable
        // cible #rituals-module-title (cf. HeroProduitBound).
        reviewsCountOverride={
          ritualSummary.totalCount > 0
            ? ritualSummary.totalCount
            : (content.handsTestimonials?.length ?? 0)
        }
      />

      {/* — 1bis. STORIES vidéo shoppables (preuve + démo précoce) — flag OFF
        par défaut. Rail léger (posters), viewer overlay code-splitté (0 coût
        de layout). Voir docs/stories-video-2026-08-21/. */}
      <StoriesVideoBound locale={locale} />

      {/* — 2. PREUVE 1 : Composition (qualité formule) — §4.3 */}
      <CompositionRevealBound
        items={content.composition}
        header={{
          kicker: tKit('composition.section.kicker'),
          title: tKit('composition.section.title'),
          description: tKit('composition.section.description'),
        }}
        cardCta={tKit('composition.card_cta')}
      />

      {/* — 3. PREUVE 2 : Vidéo 4 gestes (usage in vivo) — §4.4 */}
      <VideoPlayer4GestesKitBound locale={locale} videoOverride={localizedVideo} />

      {/*
        — 4. PACK + STEPS (§4.6 + §4.7) — DENSITÉ COMMERCIALE —
        Prix, économie 191 MAD, value-per-manucure, trust row. C'est la
        zone éditoriale qui prépare la décision. Le wizard juste en
        dessous matérialise la « 2ème zone de conversion » Kolenda §4.6.
      */}
      <ProductFeedSectionBound
        product={dbProduct}
        content={content}
        reviewStats={reviewStats}
        locale={locale}
      />

      {/*
        — 5. ⭐ DÉCISION : Wizard commander — 2ème zone de conversion §4.6 —
        Position OPTIMALE selon Kolenda playbook : après le pack (densité
        commerciale), avant les testimonials (réassurance post-décision).
        L'utilisateur arrive ici avec 3 preuves fortes en tête (composition,
        usage, pack) → conversion à chaud maximal sans scroll excessif.
      */}
      <KitCommanderSectionBound locale={locale} />

      {/*
        — 6. RÉASSURANCE POST-DÉCISION : Trois mains §4.10 —
        HandsTestimonials placé APRÈS le wizard : sert de "deuxième chance"
        pour les utilisateurs qui ont scrollé au-delà sans commander.
        Avant/après visuels → restaure la projection de soi (« moi dans 3 mois »).
      */}
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

      {/* — 7. DÉTAIL TECHNIQUE : Ingrédients approfondis §4.5 — */}
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
        — 8. SOCIAL PROOF À GRANDE ÉCHELLE : Voix de la maison §4.8 —
        Module rituels (47 initiées ont partagé, 38 reprendraient). C'est
        ce module qui alimente le compteur du badge hero et son ancre.
        Position post-wizard : capte les hésitants à grande échelle.
      */}
      <RitualsModuleBound productKey="pack-femiglow" locale={effectiveLocale} />

      {/* — 9. OBJECTIONS : FAQ §4.9 — */}
      <FAQContextuelle
        items={content.faq}
        header={{
          kicker: tKit('faq.section.kicker'),
          title: tKit('faq.section.title'),
          description: tKit('faq.section.description'),
        }}
      />

      {/* — 10. BOTTOM FUNNEL : Journal §4.12 — */}
      <JournalGridBound
        articles={journalArticles}
        kicker={tKit('journal_grid.kicker')}
        title={tKit('journal_grid.title')}
        ctaLabel={tJournal('grid.cta')}
        categoryLabels={journalCategoryLabels}
        variant="symmetric"
      />

      {/* — 11. OVERLAY : RitualsWallDrawer (Suspense) — */}
      <Suspense fallback={null}>
        <RitualsWallDrawer productKey="pack-femiglow" strings={wallStrings} />
      </Suspense>

      {/*
        Pas de sticky CTA bottom en v2 — le `GeoPromoSlideHeaderSlot` (top
        sticky de l'app) porte déjà le bouton « Commander » mobile. Le
        doublon créerait du bruit visuel + double tracking event. Si on
        veut a/b tester un CTA bottom en complément du top, on réintroduira
        un composant dédié avec scope flag distinct.
      */}
    </div>
  );
}
