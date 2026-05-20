# 03 — Data model

Toutes les extensions sont **rétro-compatibles** : les nouveaux champs
sont optionnels, un `ProductFeed` sans ces champs reste valide et le
rendu dégrade silencieusement.

## 1. Extension `ProductFeed.hero`

`apps/web/src/lib/products/feed/types.ts` — ajout sur `ProductFeedHero`.

```ts
export interface ProductFeedHero {
  // … champs existants
  kicker: string;
  title: string;
  lead: string;
  pricePrefix: string;
  ctaLabel: string;
  ctaMicrocopy: string;

  // NOUVEAU — Phase 0/1
  /**
   * Décomposition "valeur séparée" : items unitaires + total avant remise.
   * Affichée en micro-liste au-dessus du bloc prix.
   *
   * Exemple :
   *   { items: [{ label: 'Paste', priceCents: 11000 },
   *             { label: 'Powder', priceCents: 9000 },
   *             { label: 'Polissoir Step 4', priceCents: 12000 }],
   *     totalLabel: 'Valeur séparée' }
   *
   * Pricing §15 — anchoring haut, élargit la fenêtre de prix perçue.
   * Optionnel — si absent, pas de micro-liste rendue.
   */
  valueBreakdown?: {
    items: Array<{
      label: string;       // ex. 'Paste', 'Powder'
      priceCents: number;  // en cents (cohérence avec product.priceCents)
    }>;
    totalLabel: string;    // ex. 'Valeur séparée'
  } | null;

  /**
   * Phrase de reframing valeur d'usage affichée sous le bloc prix.
   * Pricing §7-8 — réduit l'objection prix.
   *
   * Exemple :
   *   '≈ 1,5 MAD par manucure · 8 séances salon ≈ 1 200 MAD/an'
   *
   * Contraintes :
   *  - 1-160 chars trim
   *  - Pas de ponctuation finale (clausule, pas phrase)
   *
   * Optionnel — si absent, pas de ligne rendue.
   */
  perUsageHint?: string | null;

  /**
   * Couleur d'accent du CTA principal. Par défaut `encre` (ancien
   * comportement). Kolenda §4.6 recommande `sauge-dark` (#4A5D4A).
   *
   * Valeurs : 'encre' | 'sauge-dark' | 'champagne-dark'.
   *
   * Optionnel — fallback `'encre'`.
   */
  ctaAccent?: 'encre' | 'sauge-dark' | 'champagne-dark' | null;
}
```

## 2. Nouveau type `ProductFeedSocialProofGeo`

`apps/web/src/lib/products/feed/types.ts` — étendre `ProductFeedSocialProof`.

```ts
export interface ProductFeedSocialProof {
  // … champs existants
  rating: number;
  reviewsCount: number;
  quote: string;
  authorLabel: string;

  // NOUVEAU — Phase 2
  /**
   * Libellé géographique du compte social (Copy §11 — lettres pour le
   * compte humain, digits pour la note).
   *
   * Exemple : '287 femmes · Rabat, Casablanca, Marrakech'
   *
   * Si absent, le rendu retombe sur `${reviewsCount} avis` (legacy).
   */
  countLabelGeo?: string | null;
}
```

## 3. Helper de calcul des économies

`apps/web/src/lib/kit/pack/savings.ts` (nouveau).

```ts
/**
 * Calcule l'économie absolue à partir du prix promo + prix original.
 * Retourne un objet déjà formaté pour affichage Kolenda §4.6.
 *
 * Pur — pas d'I/O.
 */
export interface PackSavings {
  amountCents: number;     // 19100 pour 191 MAD
  amountMajor: number;     // 191
  percent: number;         // 49 (jamais affiché — backlog)
  hasSavings: boolean;     // false si promoPriceCents absent ou égal au prix
}

export function computePackSavings(
  priceCents: number,
  promoPriceCents: number | null | undefined,
): PackSavings {
  if (!promoPriceCents || promoPriceCents >= priceCents) {
    return {
      amountCents: 0,
      amountMajor: 0,
      percent: 0,
      hasSavings: false,
    };
  }
  const amountCents = priceCents - promoPriceCents;
  return {
    amountCents,
    amountMajor: Math.round(amountCents / 100),
    percent: Math.round((amountCents / priceCents) * 100),
    hasSavings: true,
  };
}
```

## 4. Helper de calcul des coûts par usage

`apps/web/src/lib/kit/pack/per-usage.ts` (nouveau, Phase 0).

```ts
/**
 * Construit la phrase de reframing valeur d'usage.
 *
 * Convention FemiGlow : 1 pack = ~50 manucures (basé sur la durée du
 * polissoir = 6 mois × env. 2 polissages/semaine).
 *
 * Comparaison salon : 8 manucures/an × ~150 MAD = ~1 200 MAD.
 *
 * Pur — basé sur les chiffres produits, pas de fetch externe.
 */
export interface PerUsageInputs {
  pricePromoCents: number;            // 19900
  currency: 'MAD' | 'EUR' | 'USD';
  manicuresPerPack?: number;          // default 50
  salonPricePerManicureCents?: number; // default 15000 (150 MAD)
  salonManicuresPerYear?: number;     // default 8
}

export function buildPerUsageHint(inputs: PerUsageInputs): string {
  const m = inputs.manicuresPerPack ?? 50;
  const pricePerManicureCents = inputs.pricePromoCents / m;
  const pricePerManicureMad = (pricePerManicureCents / 100).toFixed(1);
  // Format français : 1,5 (virgule)
  const formatted = pricePerManicureMad.replace('.', ',');
  const salonAnnualCents =
    (inputs.salonPricePerManicureCents ?? 15000) *
    (inputs.salonManicuresPerYear ?? 8);
  const salonAnnualMad = Math.round(salonAnnualCents / 100);
  return `≈ ${formatted} ${inputs.currency} par manucure · ${
    inputs.salonManicuresPerYear ?? 8
  } séances salon ≈ ${salonAnnualMad} ${inputs.currency}/an`;
}
```

## 5. Override admin singleton (Phase 4)

Pattern identique à `KitVideoOverride` et `KitCompositionOverride`.

`apps/web/src/lib/kit/pack/types.ts` (nouveau).

```ts
export interface KitPackOverridePatch {
  // Surcharge des champs hero éditables.
  kicker?: string | null;
  title?: string | null;
  lead?: string | null;
  pricePrefix?: string | null;
  ctaLabel?: string | null;
  ctaMicrocopy?: string | null;
  ctaAccent?: 'encre' | 'sauge-dark' | 'champagne-dark' | null;
  perUsageHint?: string | null;
  // Surcharge valeur séparée
  valueBreakdown?: {
    items: Array<{ label: string; priceCents: number }>;
    totalLabel: string;
  } | null;
  // Surcharge social proof libellé géographique
  countLabelGeo?: string | null;
}

export interface KitPackOverride extends KitPackOverridePatch {
  id: 'kit-pack';  // singleton
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  draftedAt: Date | null;
  createdBy: string | null;
}

export type KitPackSource = 'override-published' | 'override-draft' | 'mock';

export interface ResolvedKitPack {
  feed: ProductFeed;        // résolu (merged)
  meta: {
    source: KitPackSource;
    publishedAt: Date | null;
    draftedAt: Date | null;
    updatedAt: Date | null;
  };
}
```

## 6. Zod schemas (Phase 4)

`apps/web/src/lib/kit/pack/schemas.ts` (nouveau).

```ts
import { z } from 'zod';

export const valueBreakdownSchema = z.object({
  items: z
    .array(z.object({
      label: z.string().trim().min(1).max(40),
      priceCents: z.number().int().min(0).max(10_000_000),
    }))
    .min(1)
    .max(8),
  totalLabel: z.string().trim().min(1).max(40),
});

export const kitPackOverrideUpsertSchema = z.object({
  kicker: z.string().trim().min(1).max(40).nullable().optional(),
  title: z.string().trim().min(1).max(120).nullable().optional(),
  lead: z.string().trim().min(1).max(280).nullable().optional(),
  pricePrefix: z.string().trim().min(1).max(40).nullable().optional(),
  ctaLabel: z.string().trim().min(1).max(40).nullable().optional(),
  ctaMicrocopy: z.string().trim().min(1).max(280).nullable().optional(),
  ctaAccent: z.enum(['encre', 'sauge-dark', 'champagne-dark']).nullable().optional(),
  perUsageHint: z.string().trim().min(1).max(160).nullable().optional(),
  valueBreakdown: valueBreakdownSchema.nullable().optional(),
  countLabelGeo: z.string().trim().min(1).max(120).nullable().optional(),
});
```

## 7. Mock à enrichir

`apps/web/src/lib/products/feed/kit-feed.ts` — `buildKitProductFeed` :

```ts
hero: {
  kicker: 'Le pack',
  title: 'Le rituel s’installe en deux gestes et un polissoir.',
  lead: '…',
  pricePrefix: 'Tout compris :',
  ctaLabel: 'Commander le rituel',  // ← Phase 1 (était 'Recevoir le pack')
  ctaMicrocopy: '…',

  // NOUVEAU — Phase 0
  valueBreakdown: {
    items: [
      { label: 'Paste', priceCents: 11000 },
      { label: 'Powder', priceCents: 9000 },
      { label: 'Polissoir Step 4', priceCents: 12000 },
    ],
    totalLabel: 'Valeur séparée',
  },
  perUsageHint: buildPerUsageHint({
    pricePromoCents: promo.effectivePriceCents,
    currency: product.currency,
  }),
  ctaAccent: 'sauge-dark',  // ← Phase 1
},
socialProof: {
  // …
  countLabelGeo: '287 femmes · Rabat, Casablanca, Marrakech',  // ← Phase 2
},
```

## 8. Tracking schemas (Phase 5)

`apps/web/src/lib/tracking/schemas.ts` — ajout 4 events :

```ts
pack_section_view: z.object({
  section_id: z.string(),
  price_cents: z.number().optional(),
  currency: z.string().optional(),
}).strict(),

pack_cta_click: z.object({
  product_id: z.string(),
  cta_label: z.string(),
  price_cents: z.number().optional(),
  from_section: z.literal('product-feed'),
}).strict(),

pack_economy_view: z.object({
  savings_amount: z.number(),
  currency: z.string(),
}).strict(),

pack_social_proof_view: z.object({
  rating: z.number(),
  reviews_count: z.number(),
}).strict(),
```

## 9. Tests de schema

`apps/web/src/lib/products/feed/pack.composition.test.ts` (nouveau) — ~12 cas :

- ✅ Rétro-compat : `ProductFeedHero` sans `valueBreakdown`/`perUsageHint`/`ctaAccent`
- ✅ Avec extensions valides
- ❌ `valueBreakdown` vide refusé
- ❌ `valueBreakdown.items` > 8 refusé
- ❌ `perUsageHint` > 160 chars refusé
- ❌ `ctaAccent` hors enum refusé
- ✅ `kitPackOverrideUpsertSchema` patch vide accepté
- ✅ Reset via `null` accepté
- ❌ `title` > 120 chars refusé
- ❌ `lead` > 280 chars refusé
- ✅ `computePackSavings(19900, 39000)` = `{ amountMajor: 191, percent: 49, hasSavings: true }`
- ✅ `buildPerUsageHint` produit format français correct

## 10. Récap modèle

```
ProductFeed.hero
  ├── kicker, title, lead, pricePrefix, ctaLabel, ctaMicrocopy  (existants)
  ├── valueBreakdown?    ← NOUVEAU Phase 0
  ├── perUsageHint?      ← NOUVEAU Phase 0
  └── ctaAccent?         ← NOUVEAU Phase 1

ProductFeed.socialProof
  ├── rating, reviewsCount, quote, authorLabel  (existants)
  └── countLabelGeo?     ← NOUVEAU Phase 2

KitPackOverride (singleton id='kit-pack')
  ├── tous les champs hero (patch override)
  ├── valueBreakdown?
  ├── countLabelGeo?
  └── meta (createdAt, updatedAt, publishedAt, draftedAt, createdBy)
```
