# 05 — Frontend public design

## 1. Hiérarchie cible

```
ProductFeedSectionBound (RSC wrapper — nouveau)
  └─ ProductFeedSection (Server, layout)
        ├─ Hero copy (refondu)
        │   ├─ Kicker "Le pack" (champagne)
        │   ├─ H2 display-md
        │   ├─ Lead
        │   ├─ Packshot (nouveau — image 3 produits)
        │   └─ PriceBlock (Client) — bloc densifié Kolenda
        │       ├─ ValueBreakdownList (Client)
        │       ├─ Prix principal (text-5xl) + barré (text-lg)
        │       ├─ SavingsLine (terracotta)
        │       ├─ PerUsageLine
        │       ├─ CommanderAnchorButton (couleur dynamique, micro-pulse)
        │       └─ Microcopy trust row
        │
        ├─ StepsGrid (Server, animée reveal)
        │   └─ FeedStepCard ×4 (avec Reveal wrapper)
        │
        ├─ ClaimsRow (Server, animée reveal)
        │   └─ FeedClaimItem ×3 (avec Reveal wrapper)
        │
        ├─ SocialProofCard (refondu — libellé géographique)
        │
        └─ PackSectionTracker (Client, IntersectionObserver)
            → émet pack_section_view, pack_economy_view, pack_social_proof_view
```

## 2. Bloc prix densifié — `PriceBlock` (Client)

`apps/web/src/components/commerce/PriceBlock.tsx` (nouveau).

```tsx
'use client';

import { CommanderAnchorButton } from './CommanderAnchorButton';
import { computePackSavings } from '@/lib/kit/pack/savings';
import type { Product } from '@/lib/schemas';
import type { ProductFeedHero } from '@/lib/products/feed/types';

interface PriceBlockProps {
  hero: ProductFeedHero;
  product: Product;
  effectivePriceCents: number;
  originalPriceCents: number;
  currency: string;
  promoActive: boolean;
}

export function PriceBlock({ hero, product, effectivePriceCents, originalPriceCents, currency, promoActive }: PriceBlockProps): JSX.Element {
  const savings = computePackSavings(originalPriceCents, effectivePriceCents);
  const ctaAccentClass = {
    'sauge-dark': 'bg-sauge-dark text-creme hover:bg-sauge',
    'encre': 'bg-encre text-creme',
    'champagne-dark': 'bg-champagne-dark text-creme',
  }[hero.ctaAccent ?? 'encre'];

  return (
    <div className="mx-auto max-w-md space-y-3 pt-6" data-testid="pack-price-block">
      {/* 1. Valeur séparée (Pricing §15) */}
      {hero.valueBreakdown ? (
        <ValueBreakdownList breakdown={hero.valueBreakdown} currency={currency} />
      ) : null}

      {/* 2. Prix principal + barré (Pricing §1-2 hiérarchie + espace) */}
      <p className="flex items-baseline justify-center gap-6">
        <span className="text-xs uppercase tracking-[0.18em] text-encre/55">
          {hero.pricePrefix}
        </span>
        <span className="font-display text-5xl sm:text-6xl text-encre [font-feature-settings:'tnum','lnum']">
          {(effectivePriceCents / 100).toFixed(0)}{' '}
          <span className="text-2xl text-encre/70">{currency}</span>
        </span>
        {promoActive ? (
          <span
            aria-label={`Prix avant promotion ${(originalPriceCents / 100).toFixed(0)} ${currency}`}
            className="text-lg text-encre/45 line-through decoration-encre/35 [font-feature-settings:'tnum','lnum']"
            data-testid="pack-price-original"
          >
            {(originalPriceCents / 100).toFixed(0)} {currency}
          </span>
        ) : null}
      </p>

      {/* 3. Économie absolue terracotta (Pricing §6 + Color §1) */}
      {savings.hasSavings ? (
        <p
          className="text-center text-sm font-medium tracking-tight"
          style={{ color: '#C28A6E' }}
          data-testid="pack-savings-line"
        >
          Économie {savings.amountMajor} {currency}
        </p>
      ) : null}

      {/* 4. Reframing valeur d'usage (Pricing §7-8) */}
      {hero.perUsageHint ? (
        <p
          className="text-center text-[13px] text-encre/70 max-w-prose mx-auto"
          data-testid="pack-per-usage"
        >
          {hero.perUsageHint}
        </p>
      ) : null}

      {/* 5. CTA principal — couleur d'accent + micro-pulse */}
      <CommanderAnchorButton
        size="lg"
        fullWidth
        productId={product.id}
        productName={product.name}
        priceCents={effectivePriceCents}
        currency={product.currency}
        className={`${ctaAccentClass} motion-safe:animate-soft-pulse`}
      >
        {hero.ctaLabel}
      </CommanderAnchorButton>

      {/* 6. Microcopy trust row */}
      <p className="text-[11px] uppercase tracking-[0.2em] text-encre/55 text-center">
        {hero.ctaMicrocopy}
      </p>
    </div>
  );
}
```

### 2.1 Animation micro-pulse CTA

`tailwind.config.ts` — ajout keyframes :

```ts
extend: {
  keyframes: {
    'soft-pulse': {
      '0%, 100%': { transform: 'scale(1)' },
      '50%': { transform: 'scale(1.02)' },
    },
  },
  animation: {
    'soft-pulse': 'soft-pulse 3.5s ease-in-out infinite',
  },
},
```

Respect `prefers-reduced-motion` via `motion-safe:animate-soft-pulse`
(Tailwind utility). Kolenda Attention §3 : 3-4 s = bon rythme.

## 3. `ValueBreakdownList` (Client)

`apps/web/src/components/commerce/ValueBreakdownList.tsx` (nouveau).

```tsx
import type { ProductFeedHero } from '@/lib/products/feed/types';

interface ValueBreakdownListProps {
  breakdown: NonNullable<ProductFeedHero['valueBreakdown']>;
  currency: string;
}

export function ValueBreakdownList({ breakdown, currency }: ValueBreakdownListProps): JSX.Element {
  const total = breakdown.items.reduce((sum, it) => sum + it.priceCents, 0);
  return (
    <div
      className="space-y-1 text-center text-xs text-encre/55 [font-feature-settings:'tnum','lnum']"
      data-testid="pack-value-breakdown"
    >
      <p>
        {breakdown.items.map((it, i) => (
          <span key={it.label}>
            {i > 0 ? <span aria-hidden="true" className="mx-1">+</span> : null}
            {it.label} {(it.priceCents / 100).toFixed(0)}
          </span>
        ))}
      </p>
      <p className="font-medium text-encre/70">
        {breakdown.totalLabel} ≈ {(total / 100).toFixed(0)} {currency}
      </p>
    </div>
  );
}
```

## 4. Packshot — `PackVisual` (Server)

`apps/web/src/components/sections/PackVisual.tsx` (nouveau).

Réutilise `/products/kit-principale.svg` (déjà rendu sur cover vidéo,
pas de nouveau payload). Cadrage 16:10 (paysage horizontal), centré
above-the-fold du bloc prix.

```tsx
import Image from 'next/image';

export function PackVisual(): JSX.Element {
  return (
    <div
      className="mx-auto mt-10 mb-8 aspect-[16/10] w-full max-w-xl overflow-hidden rounded-md"
      data-testid="pack-visual"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/products/kit-principale.svg"
        alt="Pack FemiGlow — paste, powder et polissoir Step 4 sur fond crème"
        className="h-full w-full object-cover"
        loading="lazy"
      />
    </div>
  );
}
```

Si DA livre un meilleur visuel plus tard (photo macro 3 produits sur
plan crème), on swap `src` sans rework.

## 5. Reveal animations — `Reveal` (réutilisé)

Pattern existant `@/components/motion/Reveal` (composition phase 4)
réutilisé sur :
- 4 step cards : `<Reveal as="li" delay={index * 80}>...`
- 3 claims : `<Reveal as="li" delay={index * 100}>...`

```tsx
import { Reveal } from '@/components/motion/Reveal';

// dans la grid 4 steps :
<ol role="list" aria-label="Les quatre gestes du rituel">
  {feed.steps.map((step, i) => (
    <Reveal key={step.step} as="li" delay={i * 80}>
      <FeedStepCard step={step} />
    </Reveal>
  ))}
</ol>
```

`Reveal` respecte déjà `useReducedMotion` (no-op si reduced).

## 6. Social proof refondu

`SocialProofCard` (extrait inline) — affichage adjusté Phase 2.

```tsx
<figure
  aria-label="Avis clientes"
  className="mx-auto mt-8 max-w-2xl rounded-md border border-encre/10 bg-creme-warm px-8 py-8 text-center"
  data-testid="product-feed-social-proof"
>
  <div className="flex items-center justify-center gap-2 text-sm text-champagne-dark">
    <span aria-hidden="true">★★★★★</span>
    <span className="font-medium tabular-nums">
      {feed.socialProof.rating.toFixed(1)}/5
    </span>
    <span className="text-encre/50">·</span>
    <span className="text-encre/70" data-testid="pack-social-count">
      {feed.socialProof.countLabelGeo ?? `${feed.socialProof.reviewsCount} avis`}
    </span>
  </div>
  <blockquote className="mt-4">
    <Text size="lead" italic prose className="mx-auto">
      {`« ${feed.socialProof.quote} »`}
    </Text>
  </blockquote>
  <figcaption className="mt-3 text-xs uppercase tracking-[0.18em] text-encre/55">
    {feed.socialProof.authorLabel}
  </figcaption>
</figure>
```

Notable :
- `mt-16` → `mt-8` : rapproche du CTA (Pricing §14 grand nombre près du prix)
- `py-10` → `py-8` : moins d'aération, signal de densité Ecommerce §14

## 7. `PackSectionTracker` (Client)

`apps/web/src/components/sections/PackSectionTracker.tsx` (nouveau, Phase 5).

IntersectionObserver émet 3 events au franchissement des seuils :

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { useTracking } from '@/lib/tracking/use-tracking';

interface PackSectionTrackerProps {
  productId: string;
  effectivePriceCents: number;
  savingsAmountCents: number;
  rating: number;
  reviewsCount: number;
  currency: string;
}

export function PackSectionTracker({
  productId,
  effectivePriceCents,
  savingsAmountCents,
  rating,
  reviewsCount,
  currency,
}: PackSectionTrackerProps): null {
  const { emit } = useTracking();
  // Observers indépendants pour 3 elements :
  // - `[data-testid="product-feed-section"]` → pack_section_view (0.5)
  // - `[data-testid="pack-savings-line"]` → pack_economy_view (0.8)
  // - `[data-testid="product-feed-social-proof"]` → pack_social_proof_view (0.5)

  // Each one fires once, then disconnects.
  // …
  return null;
}
```

Détails de l'implémentation calqués sur `NarrativeIntro` (composition phase 4).

## 8. Refactor `ProductFeedSection` — extrait

```tsx
export function ProductFeedSection({ feed, product, anchorId = 'product-feed' }: Props) {
  const promo = computePromo(product.priceCents, product.promoPriceCents);
  const savings = computePackSavings(product.priceCents, promo.effectivePriceCents);

  return (
    <section
      id={anchorId}
      aria-labelledby="product-feed-title"
      className="bg-creme py-16 sm:py-20"  // ← réduit de py-20/28 à py-16/20 (densité)
      data-testid="product-feed-section"
    >
      <Container width="wide">
        <div className="mx-auto max-w-3xl space-y-4 text-center">  // ← space-y-5 → space-y-4
          <Kicker tone="champagne">{feed.hero.kicker}</Kicker>
          <Heading id="product-feed-title" as="h2" size="display-md">
            {feed.hero.title}
          </Heading>
          <Text size="lead" tone="secondary" prose className="mx-auto">
            {feed.hero.lead}
          </Text>

          {/* NOUVEAU — Packshot */}
          <PackVisual />

          {/* NOUVEAU — Bloc prix densifié */}
          <PriceBlock
            hero={feed.hero}
            product={product}
            effectivePriceCents={promo.effectivePriceCents}
            originalPriceCents={promo.originalPriceCents}
            currency={feed.currency}
            promoActive={promo.active}
          />
        </div>

        {/* Rituel 4 gestes — Reveal stagger */}
        <ol role="list" aria-label="Les quatre gestes du rituel"
            className="mt-16 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">  // mt-20 → mt-16
          {feed.steps.map((step, i) => (
            <Reveal key={step.step} as="li" delay={i * 80}>
              <FeedStepCard step={step} />
            </Reveal>
          ))}
        </ol>

        {/* Claims — Reveal stagger */}
        <ul role="list" aria-label="Promesses produit"
            className="mt-16 grid grid-cols-1 gap-8 border-y border-encre/10 py-8 sm:grid-cols-3">  // mt-20/py-10 → mt-16/py-8
          {feed.claims.map((claim, i) => (
            <Reveal key={claim.label} as="li" delay={i * 100}>
              <FeedClaimItem claim={claim} />
            </Reveal>
          ))}
        </ul>

        {/* Social proof — rapproché */}
        <SocialProofCard socialProof={feed.socialProof} />

        {/* Tracker IntersectionObserver */}
        <PackSectionTracker
          productId={product.id}
          effectivePriceCents={promo.effectivePriceCents}
          savingsAmountCents={savings.amountCents}
          rating={feed.socialProof.rating}
          reviewsCount={feed.socialProof.reviewsCount}
          currency={feed.currency}
        />
      </Container>
    </section>
  );
}
```

## 9. Bind public — `ProductFeedSectionKitBound` (Server)

`apps/web/src/components/sections/ProductFeedSectionKitBound.tsx` (nouveau).

```tsx
import 'server-only';
import { ProductFeedSection } from './ProductFeedSection';
import { resolveKitPack } from '@/lib/kit/pack/resolver';
import { mockKit } from '@/data/mock/product';

export function ProductFeedSectionKitBound(): JSX.Element {
  const { feed } = resolveKitPack();
  return <ProductFeedSection feed={feed} product={mockKit} />;
}
```

Et dans `/kit/page.tsx` : remplacer `<ProductFeedSectionBound feed={...} product={...} />` par `<ProductFeedSectionKitBound />`.

## 10. Wireframe mobile final

```
┌────────────────────────────────────────────────┐
│                                                 │
│             LE PACK                            │  ← kicker champagne
│                                                 │
│     Le rituel s'installe en deux gestes        │
│            et un polissoir.                    │  ← H2 display-md
│                                                 │
│  Trois objets dans la main, deux gestes…       │  ← lead
│                                                 │
│  ┌────────────────────────────────────────┐    │
│  │                                         │    │
│  │   [packshot 3 produits sur table]      │    │  ← PackVisual
│  │                                         │    │     16:10 max-w-xl
│  └────────────────────────────────────────┘    │
│                                                 │
│       Paste 110 + Powder 90 + Polissoir 120    │  ← valueBreakdown
│             Valeur séparée ≈ 320 MAD            │     petit gris
│                                                 │
│   Tout compris :    199 MAD     ─── 390 ───    │  ← prix XXL + barré
│                                                 │     hiérarchie forte
│              Économie 191 MAD                   │  ← terracotta #C28A6E
│                                                 │
│   ≈ 1,5 MAD par manucure · 8 séances salon     │  ← reframing usage
│           ≈ 1 200 MAD/an                        │
│                                                 │
│   ┌─────────────────────────────────────────┐  │
│   │      Commander le rituel                 │  │  ← CTA sauge profond
│   └─────────────────────────────────────────┘  │     + micro-pulse 3.5s
│                                                 │
│  PASTE · POWDER · POLISSOIR · LIVRAISON…       │  ← microcopy trust row
│                                                 │
│  ─── 4 cards rituel (reveal stagger) ───       │
│  ─── 3 claims (reveal stagger) ───              │
│                                                 │
│  ★ 4,8/5 · 287 femmes · Rabat, Casablanca,     │  ← social proof
│                  Marrakech                      │     géographique
│  « citation italique »                          │     proche du CTA
│  IMANE, RABAT                                   │
└────────────────────────────────────────────────┘
```

## 11. A11y récap

| Élément | Attribut | Test |
|---|---|---|
| `<section>` | `aria-labelledby="product-feed-title"` | snapshot |
| H2 | `id="product-feed-title"` | snapshot |
| Prix barré | `aria-label="Prix avant promotion 390 MAD"` | snapshot |
| Économie | role implicite paragraphe, lisible par screen reader | axe |
| Reframing | role implicite paragraphe | axe |
| CTA | `<button>` natif, focus-visible | axe |
| Packshot | `<img alt="...">` descriptif | snapshot |
| Reveal | `useReducedMotion` désactive l'animation | snapshot + test reduced-motion |
| Social proof | `<figure aria-label>`, `<blockquote>`, `<figcaption>` | axe |

Cible : **0 violation axe sérieuse/critique** sur `#product-feed`.

## 12. Tracking events émis

| Event | Émetteur | Quand |
|---|---|---|
| `pack_section_view` | `PackSectionTracker` | IntersectionObserver 0.5 |
| `pack_economy_view` | `PackSectionTracker` | IntersectionObserver 0.8 sur `pack-savings-line` |
| `pack_social_proof_view` | `PackSectionTracker` | IntersectionObserver 0.5 sur le bandeau |
| `pack_cta_click` | `CommanderAnchorButton` étendu | Click CTA |
