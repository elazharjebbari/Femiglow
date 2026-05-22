/**
 * Layout v2 — refonte Kolenda (arc hero → preuve → décision).
 *
 * Référence : `docs/kit-landing-reorder-2026-05/02-vision-arc.md`.
 *
 * Changements vs v1 :
 *   - Wizard remonté à position 6 (après social proof) → conversion warm
 *   - 2 sections retirées : Comparatif, PivotFinal
 *     (composants conservés dans le repo pour rollback ; non importés ici)
 *   - RitualsModule (gros bloc « Les voix de la maison » — 47 rituels
 *     partagés en DB) maintenu en post-wizard (position 8), seul bloc
 *     social proof à grande échelle de la page. C'est lui que le badge
 *     hero référence (count + ancre).
 *   - 11 sections au lieu de 14 (cf. doc 01 P4 : Kolenda §1.3)
 *
 * NB : pas de sticky CTA bottom mobile ajouté — le `GeoPromoSlideHeaderSlot`
 * (top sticky de l'app) porte déjà un bouton « Commander » mobile, le
 * doublon créerait du bruit + double tracking. Si on veut a/b tester un
 * CTA bottom en complément du top, prévoir un flag dédié.
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

      {/* — 1. HERO — premier contact, sans CTA wizard inline */}
      <HeroProduitBound
        product={dbProduct}
        reassurances={content.reassurances}
        componentKey="kit-hero-produit"
        // Cf. KitPageLayoutV1 — count badge avis depuis le module rituels
        // (47 en DB courante). Fallback handsTestimonials si rituals vide.
        // L'ancre cliquable du badge cible #rituals-module-title (cf.
        // HeroProduitBound).
        reviewsCountOverride={
          ritualSummary.totalCount > 0
            ? ritualSummary.totalCount
            : (content.handsTestimonials?.length ?? 0)
        }
      />

      {/* — 2. PREUVE 1 : Composition (qualité formule) — */}
      <CompositionRevealBound items={content.composition} />

      {/* — 3. PREUVE 2 : Vidéo 4 gestes (usage in vivo) — */}
      <VideoPlayer4GestesKitBound />

      {/* — 4. PREUVE 3 : Pack + Steps Kolenda §4.6/§4.7 — */}
      <ProductFeedSectionBound
        product={dbProduct}
        content={content}
        reviewStats={reviewStats}
      />

      {/* — 5. PREUVE 4 : Social proof — */}
      <HandsTestimonialsBound items={content.handsTestimonials} />

      {/*
        — 6. DÉCISION : Wizard commander (warm user) —
        L'utilisateur a vu composition + vidéo + pack + témoignages avant
        d'arriver ici. Conversion d'un public informé, ticket plus stable.
        Référence Kolenda §5 W1 — la commande doit suivre la preuve.
      */}
      <KitCommanderSectionBound />

      {/* — 7. DÉTAIL : Ingrédients approfondis (post-décision) — */}
      <IngredientsDetailsBound
        composition={resolveKitComposition().map((it) => it.subProduct)}
        componentKey="kit-detail-mains"
      />

      {/*
        — 8. SOCIAL PROOF À GRANDE ÉCHELLE : Les voix de la maison —
        Module rituels (47 initiées ont partagé, 38 reprendraient). C'est
        ce module qui alimente le compteur du badge hero et son ancre.
        Position post-wizard : capte les utilisateurs qui ont scrollé au-
        delà du wizard sans convertir, et leur donne un dernier signal
        de confiance avant la FAQ + Journal.
      */}
      <RitualsModuleBound productKey="pack-femiglow" />

      {/* — 9. OBJECTIONS : FAQ — */}
      <FAQContextuelle items={content.faq} />

      {/* — 10. BOTTOM FUNNEL : Journal — */}
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
