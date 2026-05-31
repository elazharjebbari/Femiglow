'use client';

import { Container } from '@/components/ui/Container';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Reassurance } from '@/components/ui/Reassurance';
import { Text } from '@/components/ui/Text';
import { AddToCartButton } from '@/components/commerce/AddToCartButton';
import { CommanderAnchorButton } from '@/components/commerce/CommanderAnchorButton';
import { PriceDisplay } from '@/components/commerce/PriceDisplay';
import { AttributeChips } from '@/components/commerce/AttributeChips';
import { SocialProofBadge } from '@/components/commerce/SocialProofBadge';
import { TrustRow } from '@/components/commerce/TrustRow';
import { ViewItemTracker } from '@/components/tracking/ViewItemTracker';
import { HeroGallery } from './hero/HeroGallery';
import { cn } from '@/lib/utils/cn';
import { computePromo } from '@/lib/utils/promo';
import type {
  Product,
  Reassurance as ReassuranceData,
} from '@/lib/schemas';
import type { HeroGalleryImage } from '@/lib/products/hero-gallery-types';
import type { ProductReviewStats } from '@/lib/products/reviews';

export interface HeroProduitFields {
  tagline: string;
  description: string;
  attributeChips: string[];
  trustRow: string[];
  reviewBadgeEnabled: boolean;
  ctaPulseEnabled: boolean;
}

export interface HeroProduitProps {
  product: Product;
  reassurances: ReassuranceData[];
  /** Liste des images de la galerie (au moins 1). */
  galleryImages: HeroGalleryImage[];
  /** Champs editorial CMS. */
  fields: HeroProduitFields;
  /** Stats reviews — note + count. */
  reviewStats: ProductReviewStats;
  observeId?: string;
  /**
   * Mode du CTA primaire :
   *  - `wizard-anchor` (défaut) : scroll vers le funnel embarqué (#commander-femiglow)
   *  - `cart-redirect` : ajoute au panier + redirige vers `/panier`
   */
  commanderMode?: 'wizard-anchor' | 'cart-redirect';
  /**
   * Seed event_id déterministe (32 hex) fourni par le Server Component pour
   * aligner le Pixel client (via ViewItemTracker) avec le fire CAPI server-side.
   *
   * cf. docs/meta-quality-audit-2026-05/01-design-conception.md §3.3
   */
  eventIdSeed?: string;
  /**
   * Ancre href du SocialProofBadge — rend le compte avis cliquable et
   * scroll vers la section sociale proof (typiquement `#hands-title`).
   * Si undefined, le badge reste un span statique.
   */
  reviewsAnchorHref?: string;
  /**
   * Phase 7E — Strings UI localisés (kicker, CTA, économie). Résolus
   * server-side dans `HeroProduitBound` via `marketing.kit.hero`. Chaque
   * champ retombe sur le défaut FR si `strings` (ou le champ) est absent —
   * compat tests vitest qui rendent `<HeroProduit>` sans `strings`.
   */
  strings?: {
    kicker: string;
    ctaLabel: string;
    /** Libellé économie déjà formaté (montant inclus), ou absent si pas de promo. */
    savingsLabel?: string;
    /** Phase 9bis — libellé avis localisé (« {n} avis » / « {n} تقييم »). */
    reviewsLabel?: string;
    /** Phase 9bis — aria-label complet du badge avis localisé. */
    reviewsAriaLabel?: string;
  };
  /**
   * Phase 7E — Nom produit affiché dans le H1 + l'aria galerie. Localisé
   * via le contenu CMS (`content.product.name`). Défaut : `product.name`
   * (= nom DB canonique, conservé pour le tracking/cart).
   */
  displayName?: string;
}

const SAGE_LIGHT = '#A8B89E';

export function HeroProduit({
  product,
  reassurances,
  galleryImages,
  fields,
  reviewStats,
  observeId = 'hero-produit-anchor',
  commanderMode = 'wizard-anchor',
  eventIdSeed,
  reviewsAnchorHref,
  strings,
  displayName,
}: HeroProduitProps): JSX.Element {
  const promo = computePromo(product.priceCents, product.promoPriceCents);
  const savings = product.promoPriceCents
    ? Math.round((product.priceCents - product.promoPriceCents) / 100)
    : 0;

  // Phase 7E — chaque string retombe sur le défaut FR si non fourni.
  const heroName = displayName ?? product.name;
  const heroKicker = strings?.kicker ?? 'Le rituel';
  const heroCtaLabel = strings?.ctaLabel ?? 'Commander le rituel';
  const heroSavingsLabel = strings?.savingsLabel ?? `Économie ${savings} MAD`;

  return (
    <section
      aria-labelledby="hero-kit-title"
      className="relative bg-creme-warm py-8 sm:py-12 lg:py-20"
    >
      <ViewItemTracker
        itemId={product.id}
        itemName={product.name}
        priceCents={promo.effectivePriceCents}
        currency={product.currency}
        eventIdSeed={eventIdSeed}
      />
      <Container width="page">
        <div className="grid gap-8 lg:grid-cols-2 lg:gap-16">
          {/* Colonne gauche — Galerie */}
          <div className="-mx-4 lg:mx-0">
            <HeroGallery
              images={galleryImages}
              ariaLabel={`Galerie ${heroName}`}
            />
          </div>

          {/* Colonne droite — Contenu */}
          <div className="space-y-5 lg:pt-4">
            <Kicker>{heroKicker}</Kicker>
            <Heading id="hero-kit-title" as="h1" size="display-md">
              {heroName}
            </Heading>

            {fields.reviewBadgeEnabled && reviewStats.reviewsCount > 0 ? (
              <SocialProofBadge
                rating={reviewStats.rating}
                reviewsCount={reviewStats.reviewsCount}
                href={reviewsAnchorHref}
                reviewsLabel={strings?.reviewsLabel}
                ariaLabel={strings?.reviewsAriaLabel}
              />
            ) : null}

            <Text size="lead" tone="secondary" prose>
              {fields.tagline}
            </Text>

            <AttributeChips items={fields.attributeChips} />

            {/* Bloc prix : gap horizontal généreux (Müller-Lyer).
                `showSavings={false}` désactive le micro-libellé CAPS posé
                par `PriceDisplay` — on lui préfère la version sauge ci-dessous
                (cohérent avec Kolenda Color §1 « pas de pop chaud sauf CTA »
                + Copywriting §13 « zéro caps d'emphase »). */}
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 pt-2">
              <PriceDisplay
                priceCents={product.priceCents}
                promoPriceCents={product.promoPriceCents}
                currency={product.currency}
                size="xl"
                showSavings={false}
              />
              {savings > 0 ? (
                <span
                  className="text-[15px] font-medium tabular-nums tracking-[0.005em]"
                  style={{ color: SAGE_LIGHT }}
                >
                  {heroSavingsLabel}
                </span>
              ) : null}
            </div>

            {/* Trust row AU-DESSUS du CTA — mots positifs collés à la décision */}
            <TrustRow items={fields.trustRow} className="pt-1" />

            {/* CTA principal — sauge profond + micro-pulse optionnel */}
            <div
              className={cn(
                'pt-1 hero-cta-wrapper',
                fields.ctaPulseEnabled && 'hero-cta-pulse',
              )}
            >
              {commanderMode === 'wizard-anchor' ? (
                <CommanderAnchorButton
                  size="lg"
                  fullWidth
                  productId={product.id}
                  productName={product.name}
                  priceCents={promo.effectivePriceCents}
                  currency={product.currency}
                >
                  {heroCtaLabel}
                </CommanderAnchorButton>
              ) : (
                <AddToCartButton
                  product={product}
                  size="lg"
                  fullWidth
                  redirectTo="/panier"
                >
                  {heroCtaLabel}
                </AddToCartButton>
              )}
            </div>

            {/* Description longue — sous le CTA, lecture optionnelle */}
            {fields.description ? (
              <Text size="body" tone="secondary" prose className="pt-3">
                {fields.description}
              </Text>
            ) : null}

            {reassurances.length > 0 ? (
              <ul
                aria-label="Réassurances"
                className="grid grid-cols-1 gap-4 border-t border-encre/10 pt-5 sm:grid-cols-3"
              >
                {reassurances.map((r) => (
                  <li key={r.label}>
                    <Reassurance icon={r.icon} label={r.label} detail={r.detail} />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
      </Container>
      <div id={observeId} aria-hidden="true" className="h-px w-full" />
    </section>
  );
}
