/**
 * `PriceBlock` — bloc prix de la section « Le Pack » sur `/kit`
 * (Kolenda §4.6).
 *
 * Composition :
 *  1. Prix XXL avec préfixe (« Tout compris : » + 35 €)
 *  2. Prix barré « non packagé » (line-through, opacity réduite)
 *  3. Bandeau économie « Vous économisez 14 € · 29 % » en couleur
 *     terracotta `#C28A6E` (color literal — Tailwind opacity-modifier
 *     ne supporte pas les CSS var, cf. bug bg-encre/X documenté)
 *  4. ValueBreakdownList (décomposition par item)
 *  5. perUsageHint microcopy (« ≈ 0,75 € par soin sur 30 jours »)
 *  6. CTA primaire (réutilise CommanderAnchorButton)
 *  7. Microcopy de réassurance dense sous le CTA
 *
 * Client Component — IntersectionObserver émet `pack_section_view` au
 * seuil 0.3 et `pack_economy_view` au seuil 0.5 (once chacun).
 */
'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

import { CommanderAnchorButton } from '@/components/commerce/CommanderAnchorButton';
import { isLocale } from '@/i18n.config';
import { Heading } from '@/components/ui/Heading';
import { Kicker } from '@/components/ui/Kicker';
import { Text } from '@/components/ui/Text';
import { cn } from '@/lib/utils/cn';
import { computePackSavings, formatSavingsLabel } from '@/lib/kit/pack/savings';
import type { ProductFeed } from '@/lib/products/feed/types';
import { useTracking } from '@/lib/tracking/use-tracking';
import { computePromo } from '@/lib/utils/promo';
import type { Product } from '@/lib/schemas';

import { ValueBreakdownList } from './ValueBreakdownList';
import { CouponWelcomeNote } from './CouponWelcomeNote';

export interface PriceBlockProps {
  feed: ProductFeed;
  product: Product;
  /**
   * Indique si un packshot visuel accompagne le bloc dans la section.
   * Propagé à l'event `pack_section_view` (analytique de variante).
   */
  hasVisual?: boolean;
  /**
   * Coupon d'accueil résolu côté serveur (CPN-14). `active` ⇔ un
   * `welcome_auto` est actif en bucket treatment → on affiche la note
   * « geste d'accueil ». `endsAt` ISO pour la mention de validité civile.
   */
  welcomeCoupon?: { active: boolean; endsAt: string | null };
}

/**
 * Format français d'une note flottante (« 4,8 »).
 * On garde 1 décimale pour la lisibilité, conformément à Pricing #14
 * (chiffres précis plus crédibles qu'arrondis).
 */
function formatRating(rating: number): string {
  return rating.toFixed(1).replace('.', ',');
}

/**
 * Date civile pour la mention de validité du coupon (« Valable jusqu'au … »).
 * JAMAIS un countdown — format long, sobre, localisé. null si pas de date.
 */
function formatCivilDate(iso: string | null | undefined, isArabic: boolean): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const locale = isArabic ? 'ar-MA' : 'fr-MA';
  const formatted = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(d);
  return isArabic ? `صالح حتى ${formatted}` : `Valable jusqu'au ${formatted}`;
}

function parsePriceCents(label: string | undefined): number | null {
  if (!label) return null;
  // Tolère « 49 € », « 49,00 € », « 49 MAD »
  const match = label.replace(/\s+/g, '').match(/^(\d+(?:[.,]\d{1,2})?)/);
  if (!match) return null;
  const raw = match[1]!.replace(',', '.');
  const major = Number.parseFloat(raw);
  if (!Number.isFinite(major)) return null;
  return Math.round(major * 100);
}

export function PriceBlock({
  feed,
  product,
  hasVisual = false,
  welcomeCoupon,
}: PriceBlockProps): JSX.Element {
  const { hero, currency, socialProof } = feed;
  const { emit } = useTracking();
  const sectionRef = useRef<HTMLDivElement | null>(null);

  // Phase 9 i18n STRICT — locale active (premier segment du pathname). Sur
  // /ar, on remplace le code devise latin (MAD/AED) par درهم pour le prix XXL
  // et le bandeau économie. Hors /ar : sortie inchangée (code ISO).
  const path = usePathname() ?? '/';
  const firstSeg = path.split('/').filter(Boolean)[0];
  const isArabic = !!firstSeg && isLocale(firstSeg) && firstSeg === 'ar';
  const currencyDisplay =
    isArabic && currency === 'MAD'
      ? 'درهم'
      : isArabic && currency === 'AED'
        ? 'درهم إماراتي'
        : currency;
  // Unité passée à `formatSavingsLabel` : درهم sur /ar, sinon MAD/€ legacy.
  const savingsUnit = isArabic
    ? currencyDisplay
    : currency === 'MAD'
      ? 'MAD'
      : '€';

  // Prix effectif (promo-aware) — utilisé pour computeSavings et CTA.
  const promo = computePromo(product.priceCents, product.promoPriceCents);
  const compareAtCents = parsePriceCents(hero.priceCompareAt);
  const savings = computePackSavings(promo.effectivePriceCents, compareAtCents);

  // Social proof condensé — libellé géo prioritaire si défini, sinon
  // fallback sur reviewsCount (compat legacy).
  const socialProofLabel =
    socialProof?.countLabelGeo ??
    (socialProof ? `${socialProof.reviewsCount} avis` : null);
  const socialProofLabelUsed = socialProof?.countLabelGeo ? 'geo' : 'count';

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }
    let firedSection = false;
    let firedEconomy = false;
    let firedSocial = false;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (!firedSection && entry.intersectionRatio >= 0.3) {
            firedSection = true;
            emit('pack_section_view', {
              has_visual: hasVisual,
              layout: window.innerWidth >= 768 ? 'desktop' : 'mobile',
            });
          }
          if (!firedEconomy && savings && entry.intersectionRatio >= 0.5) {
            firedEconomy = true;
            emit('pack_economy_view', {
              savings_eur: savings.eur,
              savings_pct: savings.pct,
            });
          }
          if (
            !firedSocial &&
            socialProof &&
            entry.intersectionRatio >= 0.5
          ) {
            firedSocial = true;
            emit('pack_social_proof_view', {
              rating: socialProof.rating,
              count: socialProof.reviewsCount,
              label_used: socialProofLabelUsed,
            });
          }
          if (
            firedSection &&
            (firedEconomy || !savings) &&
            (firedSocial || !socialProof)
          ) {
            obs.disconnect();
            break;
          }
        }
      },
      { threshold: [0.3, 0.5] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [emit, savings, socialProof, socialProofLabelUsed, hasVisual]);

  // Mapping accent → classes Tailwind. Pour Phase 0 le CTA garde son
  // variant primary natif ; Phase 1 introduira la variante sauge-dark
  // + micro-pulse. Le ctaAccent est préservé pour ne pas recoder cette
  // logique deux fois.
  const ctaAccent = hero.ctaAccent ?? 'champagne';

  return (
    <div
      ref={sectionRef}
      data-testid="pack-price-block"
      data-cta-accent={ctaAccent}
      className="mx-auto max-w-md space-y-4 pt-8"
    >
      {/* 1 + 2 — Prix XXL + prix barré */}
      <div className="space-y-2 text-center">
        <Kicker tone="champagne">{hero.pricePrefix}</Kicker>
        <p
          className="flex items-baseline justify-center gap-3"
          data-testid="pack-price-line"
        >
          <span className="font-display text-5xl text-encre tabular-nums">
            {(promo.effectivePriceCents / 100).toFixed(0)}{' '}
            <span className="text-2xl text-encre/70">{currencyDisplay}</span>
          </span>
          {hero.priceCompareAt && (
            <span
              aria-label={
                hero.priceCompareAtAriaLabel ??
                `Prix avant pack ${hero.priceCompareAt}`
              }
              className="text-sm text-encre/45 line-through decoration-encre/35"
              data-testid="pack-price-compare-at"
            >
              {hero.priceCompareAt}
            </span>
          )}
        </p>

        {/* 3 — Bandeau économie terracotta. L'unité du bandeau suit la
            devise du `ProductFeed` pour rester cohérente avec le prix XXL
            (ex : « 347 MAD · 64 % » et pas « 347 € · 64 % » sur un
            produit en MAD). */}
        {savings && (
          <p
            data-testid="pack-savings-badge"
            className="mx-auto inline-flex max-w-fit items-center gap-1 rounded-full bg-[#C28A6E]/12 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-[#8A4F36]"
          >
            {formatSavingsLabel(
              savings,
              savingsUnit,
              hero.savingsPhrase,
            )}
          </p>
        )}
      </div>

      {/* 3bis — Module « geste d'accueil » (coupon welcome_auto résolu serveur).
          S'adosse à la zone prix, sous le bandeau économie. */}
      {welcomeCoupon?.active && promo.active && (
        <CouponWelcomeNote
          isArabic={isArabic}
          finalPriceLabel={`${(promo.effectivePriceCents / 100).toFixed(0)} ${currencyDisplay}`}
          savingsLabel={
            isArabic
              ? `${(promo.savingsCents / 100).toFixed(0)} ${currencyDisplay} هدية على طلبك الأول`
              : `${(promo.savingsCents / 100).toFixed(0)} ${savingsUnit} offerts sur votre première commande du pack`
          }
          endsAtLabel={formatCivilDate(welcomeCoupon.endsAt, isArabic)}
        />
      )}

      {/* 4 — ValueBreakdownList */}
      {hero.valueBreakdown && hero.valueBreakdown.length > 0 && (
        <ValueBreakdownList items={hero.valueBreakdown} />
      )}

      {/* 5 — perUsageHint microcopy */}
      {hero.perUsageHint && (
        <p
          data-testid="pack-per-usage-hint"
          className="text-center text-xs italic text-encre/65"
        >
          {hero.perUsageHint}
        </p>
      )}

      {/* 6 — CTA primaire — Kolenda §4.6 : accent sauge-dark + micro-pulse */}
      <CommanderAnchorButton
        size="lg"
        fullWidth
        productId={product.id}
        productName={product.name}
        priceCents={promo.effectivePriceCents}
        currency={product.currency}
        accent={ctaAccent === 'champagne' ? undefined : ctaAccent}
        source="pack_section"
        trackingLabel={hero.ctaLabel}
      >
        {hero.ctaLabel}
      </CommanderAnchorButton>

      {/* 7 — Social proof condensé sous le CTA (Kolenda §4.6 — proof
          de proximité). Labels géo prioritaire si défini, sinon fallback
          `reviewsCount`. Note formatée FR (1 décimale, virgule). */}
      {socialProof && socialProofLabel && (
        <p
          data-testid="pack-social-proof"
          data-label-used={socialProofLabelUsed}
          className="flex items-center justify-center gap-2 text-sm text-champagne-dark"
        >
          <span aria-hidden="true">★★★★★</span>
          <span className="font-medium tabular-nums">
            {formatRating(socialProof.rating)}/5
          </span>
          <span className="text-encre/40">·</span>
          <span className="text-encre/70">{socialProofLabel}</span>
        </p>
      )}

      {/* 8 — Microcopy de réassurance */}
      <p
        className={cn(
          'text-center text-[11px] uppercase tracking-[0.2em] text-encre/55',
        )}
      >
        {hero.ctaMicrocopy}
      </p>
    </div>
  );
}
