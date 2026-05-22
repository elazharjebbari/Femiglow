/**
 * Layout v2 — refonte Kolenda (arc hero → preuve → décision).
 *
 * Référence : `docs/kit-landing-reorder-2026-05/02-vision-arc.md`.
 *
 * Changements vs v1 :
 *   - Wizard remonté à position 6 (après social proof) → conversion warm
 *   - 3 sections retirées : Comparatif, RitualsModule, PivotFinal
 *     (composants conservés dans le repo pour rollback ; non importés ici)
 *   - Sticky CTA mobile ajouté (scroll-to-wizard pour les mobiles qui
 *     pourraient sinon manquer la zone commande en pos 6)
 *   - 10 sections au lieu de 14 (cf. doc 01 P4 : Kolenda §1.3)
 *
 * Tests : Playwright `@kit-layout-v2` dans
 *   `apps/web-e2e/tests/kit/kit-layout-v2.spec.ts` (L3).
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
import { RitualsWallDrawer } from '@/components/sections/rituals/RitualsWallDrawer';
import { KitCommanderSectionBound } from '@/components/sections/KitCommanderSectionBound';
import { GeoPromoSlideHeaderSlot } from '@/components/promo/GeoPromoSlideHeaderSlot';
import { JsonLd, faqPageSchema } from '@/lib/seo/json-ld';

import { KitStickyMobileCta } from './KitStickyMobileCta';
import type { KitPageLayoutProps } from './types';

export function KitPageLayoutV2({
  content,
  journalArticles,
  dbProduct,
  productJsonLd,
  reviewStats,
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
        // Cf. KitPageLayoutV1 — count avis = handsTestimonials.length tant
        // que la table product_reviews est vide, et badge cliquable vers
        // #hands-title (handled inside HeroProduitBound).
        reviewsCountOverride={content.handsTestimonials?.length ?? 0}
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

      {/* — 8. OBJECTIONS : FAQ — */}
      <FAQContextuelle items={content.faq} />

      {/* — 9. BOTTOM FUNNEL : Journal — */}
      <JournalGridBound
        articles={journalArticles}
        kicker="Pour aller plus loin"
        title="Trois lectures."
        variant="symmetric"
      />

      {/* — 10. OVERLAY : RitualsWallDrawer (Suspense) — */}
      <Suspense fallback={null}>
        <RitualsWallDrawer productKey="pack-femiglow" />
      </Suspense>

      {/* — Sticky CTA mobile : visible < lg, scroll-to-wizard — */}
      <KitStickyMobileCta />
    </div>
  );
}
