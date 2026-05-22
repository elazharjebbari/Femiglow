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

import { FAQContextuelle } from '@/components/sections';
import { VideoPlayer4GestesKitBound } from '@/components/sections/VideoPlayer4GestesKitBound';
import { HeroProduitBound } from '@/components/sections/HeroProduitBound';
import { CompositionRevealBound } from '@/components/sections/CompositionRevealBound';
import { IngredientsDetailsBound } from '@/components/sections/IngredientsDetailsBound';
import { resolveKitComposition } from '@/lib/kit/composition/resolver';
import { HandsTestimonialsBound } from '@/components/sections/HandsTestimonialsBound';
import { JournalGridBound } from '@/components/sections/JournalGridBound';
import { ProductFeedSectionBound } from '@/components/sections/ProductFeedSectionBound';
import { RitualsModuleBound } from '@/components/sections/rituals/RitualsModuleBound';
import { RitualsWallDrawer } from '@/components/sections/rituals/RitualsWallDrawer';
import { KitCommanderSectionBound } from '@/components/sections/KitCommanderSectionBound';
import { GeoPromoSlideHeaderSlot } from '@/components/promo/GeoPromoSlideHeaderSlot';
import { JsonLd, faqPageSchema } from '@/lib/seo/json-ld';

import type { KitPageLayoutProps } from './types';

export function KitPageLayoutV2({
  content,
  journalArticles,
  dbProduct,
  productJsonLd,
  reviewStats,
  ritualSummary,
}: KitPageLayoutProps) {
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
        // Count badge avis depuis le module rituels (47 en DB courante).
        // Fallback handsTestimonials si rituals vide. L'ancre cliquable
        // cible #rituals-module-title (cf. HeroProduitBound).
        reviewsCountOverride={
          ritualSummary.totalCount > 0
            ? ritualSummary.totalCount
            : (content.handsTestimonials?.length ?? 0)
        }
      />

      {/* — 2. PREUVE 1 : Composition (qualité formule) — §4.3 */}
      <CompositionRevealBound items={content.composition} />

      {/* — 3. PREUVE 2 : Vidéo 4 gestes (usage in vivo) — §4.4 */}
      <VideoPlayer4GestesKitBound />

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
      />

      {/*
        — 5. ⭐ DÉCISION : Wizard commander — 2ème zone de conversion §4.6 —
        Position OPTIMALE selon Kolenda playbook : après le pack (densité
        commerciale), avant les testimonials (réassurance post-décision).
        L'utilisateur arrive ici avec 3 preuves fortes en tête (composition,
        usage, pack) → conversion à chaud maximal sans scroll excessif.
      */}
      <KitCommanderSectionBound />

      {/*
        — 6. RÉASSURANCE POST-DÉCISION : Trois mains §4.10 —
        HandsTestimonials placé APRÈS le wizard : sert de "deuxième chance"
        pour les utilisateurs qui ont scrollé au-delà sans commander.
        Avant/après visuels → restaure la projection de soi (« moi dans 3 mois »).
      */}
      <HandsTestimonialsBound items={content.handsTestimonials} />

      {/* — 7. DÉTAIL TECHNIQUE : Ingrédients approfondis §4.5 — */}
      <IngredientsDetailsBound
        composition={resolveKitComposition().map((it) => it.subProduct)}
        componentKey="kit-detail-mains"
      />

      {/*
        — 8. SOCIAL PROOF À GRANDE ÉCHELLE : Voix de la maison §4.8 —
        Module rituels (47 initiées ont partagé, 38 reprendraient). C'est
        ce module qui alimente le compteur du badge hero et son ancre.
        Position post-wizard : capte les hésitants à grande échelle.
      */}
      <RitualsModuleBound productKey="pack-femiglow" />

      {/* — 9. OBJECTIONS : FAQ §4.9 — */}
      <FAQContextuelle items={content.faq} />

      {/* — 10. BOTTOM FUNNEL : Journal §4.12 — */}
      <JournalGridBound
        articles={journalArticles}
        kicker="Pour aller plus loin"
        title="Trois lectures."
        variant="symmetric"
      />

      {/* — 11. OVERLAY : RitualsWallDrawer (Suspense) — */}
      <Suspense fallback={null}>
        <RitualsWallDrawer productKey="pack-femiglow" />
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
