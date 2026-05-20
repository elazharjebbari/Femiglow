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

import { CommanderAnchorButton } from '@/components/commerce/CommanderAnchorButton';
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

export interface PriceBlockProps {
  feed: ProductFeed;
  product: Product;
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

export function PriceBlock({ feed, product }: PriceBlockProps): JSX.Element {
  const { hero, currency } = feed;
  const { emit } = useTracking();
  const sectionRef = useRef<HTMLDivElement | null>(null);

  // Prix effectif (promo-aware) — utilisé pour computeSavings et CTA.
  const promo = computePromo(product.priceCents, product.promoPriceCents);
  const compareAtCents = parsePriceCents(hero.priceCompareAt);
  const savings = computePackSavings(promo.effectivePriceCents, compareAtCents);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      return;
    }
    let firedSection = false;
    let firedEconomy = false;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          if (!firedSection && entry.intersectionRatio >= 0.3) {
            firedSection = true;
            emit('pack_section_view', {
              has_visual: false,
              layout: window.innerWidth >= 640 ? 'desktop' : 'mobile',
            });
          }
          if (!firedEconomy && savings && entry.intersectionRatio >= 0.5) {
            firedEconomy = true;
            emit('pack_economy_view', {
              savings_eur: savings.eur,
              savings_pct: savings.pct,
            });
          }
          if (firedSection && (firedEconomy || !savings)) {
            obs.disconnect();
            break;
          }
        }
      },
      { threshold: [0.3, 0.5] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [emit, savings]);

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
            <span className="text-2xl text-encre/70">{currency}</span>
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

        {/* 3 — Bandeau économie terracotta */}
        {savings && (
          <p
            data-testid="pack-savings-badge"
            className="mx-auto inline-flex max-w-fit items-center gap-1 rounded-full bg-[#C28A6E]/12 px-3 py-1 text-xs font-medium uppercase tracking-[0.14em] text-[#8A4F36]"
          >
            {formatSavingsLabel(savings)}
          </p>
        )}
      </div>

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

      {/* 6 — CTA primaire */}
      <CommanderAnchorButton
        size="lg"
        fullWidth
        productId={product.id}
        productName={product.name}
        priceCents={promo.effectivePriceCents}
        currency={product.currency}
      >
        {hero.ctaLabel}
      </CommanderAnchorButton>

      {/* 7 — Microcopy de réassurance */}
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
