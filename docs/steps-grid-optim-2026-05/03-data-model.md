# 03 — Data model

## 1. Schema actuel

```ts
// apps/web/src/lib/products/feed/types.ts
export interface ProductFeedStep {
  step: number;             // 1..4
  kicker: string;           // "Geste 1"
  title: string;            // "Appliquez la paste"
  description: string;      // 12-22 mots
  accent: FeedAccent;       // 'sauge' | 'petale' | 'champagne' | 'ciel'
}
```

## 2. Schema cible (extensions rétro-compat)

Tous les nouveaux champs sont **optionnels** pour préserver les consommateurs
existants (`merchant-xml`, `json-ld`, tests historiques) :

```ts
export interface ProductFeedStep {
  step: number;
  kicker: string;
  title: string;
  description: string;
  accent: FeedAccent;

  /**
   * Durée approximative du geste, formatée FR (« 30 s », « 1 min »,
   * « 2 min »). Affichée à côté de la pastille. Optionnel — si absent,
   * le badge durée n'est pas rendu.
   */
  duration?: string;

  /**
   * Marque ce step comme l'aboutissement du rituel (= step 4 par défaut).
   * Le rendu applique :
   *  - anneau doublé sur la pastille (`ring-2 ring-champagne-dark/30`)
   *  - badge sous la pastille (« RÉSULTAT »)
   *  - description en `font-display italic`
   */
  isResult?: boolean;

  /**
   * Clé de l'icône SVG à afficher au-dessus de la pastille.
   * Une de : `'buffer' | 'drop' | 'sparkle' | 'mirror'`. Si absent, pas
   * d'icône (rétro-compat).
   */
  icon?: ProductFeedStepIcon;
}

export type ProductFeedStepIcon = 'buffer' | 'drop' | 'sparkle' | 'mirror';
```

## 3. Schema header (nouvelle entité)

```ts
/**
 * En-tête de la grille (au-dessus des 4 cartes) — Kolenda §4.7
 * Attention #18 : la durée totale est visible avant de lire les gestes.
 */
export interface ProductFeedStepsHeader {
  /** Kicker court (« EN TOUT »). */
  kicker: string;
  /** Durée totale formatée (« 5 minutes le soir »). */
  totalDuration: string;
  /** Lead 1 phrase sensorielle sous le titre. */
  lead: string;
}
```

## 4. Schema PostCta (nouvelle entité)

```ts
/**
 * CTA éditorial chuchoté sous la grille — relance funnel vers le bloc
 * commande (cf. Kolenda Attention #12, directional cues).
 */
export interface ProductFeedStepsPostCta {
  /** Libellé du lien (« Démarrer le rituel »). */
  label: string;
  /** Ancre cible (sans #). */
  anchorId: string;
}
```

## 5. Intégration dans `ProductFeed`

```ts
export interface ProductFeed {
  // ... champs existants
  steps: ProductFeedStep[];

  /** Header optionnel au-dessus de la grille (G1). */
  stepsHeader?: ProductFeedStepsHeader;

  /** CTA post-grille optionnel (G4). */
  stepsPostCta?: ProductFeedStepsPostCta;
}
```

## 6. Validation Zod

```ts
// apps/web/src/lib/products/feed/schema.ts
const stepIconSchema = z.enum(['buffer', 'drop', 'sparkle', 'mirror']);

const stepSchema = z.object({
  step: z.number().int().min(1).max(4),
  kicker: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  accent: accentSchema,
  duration: z.string().min(1).max(20).optional(),
  isResult: z.boolean().optional(),
  icon: stepIconSchema.optional(),
});

const stepsHeaderSchema = z.object({
  kicker: z.string().min(1).max(40),
  totalDuration: z.string().min(1).max(40),
  lead: z.string().min(1).max(200),
});

const stepsPostCtaSchema = z.object({
  label: z.string().min(1).max(40),
  anchorId: z.string().min(1).max(60),
});

export const productFeedSchema = z.object({
  // ...
  steps: z.array(stepSchema).length(4),
  stepsHeader: stepsHeaderSchema.optional(),
  stepsPostCta: stepsPostCtaSchema.optional(),
});
```

## 7. Builder dérivation (kit-feed.ts)

Le builder enrichit chaque step avec `duration`, `icon`, `isResult` :

```ts
function buildSteps(): ProductFeedStep[] {
  return [
    {
      step: 1,
      kicker: 'Préparation',
      title: 'Préparez vos ongles',
      description: 'On nettoie, on sèche, on lime légèrement — la plaque s’ouvre au soin.',
      accent: 'sauge',
      duration: '30 s',
      icon: 'buffer',
    },
    {
      step: 2,
      kicker: 'Geste 1',
      title: 'Appliquez la paste',
      description: 'Une noisette de paste vert sauge, le polissoir glisse, la cire entre dans la kératine.',
      accent: 'sauge',
      duration: '1 min',
      icon: 'drop',
    },
    {
      step: 3,
      kicker: 'Geste 2',
      title: 'Appliquez la powder',
      description: 'On dépose la powder rose poudré, on lustre lentement, la lumière revient à la surface.',
      accent: 'petale',
      duration: '2 min',
      icon: 'sparkle',
    },
    {
      step: 4,
      kicker: 'Polissoir Step 4',
      title: 'Polish & Shine',
      description: 'On finit au polissoir bleu ciel — l’ongle devient miroir, sans vernis, sans abrasion.',
      accent: 'champagne',
      duration: '1 min',
      icon: 'mirror',
      isResult: true,
    },
  ];
}

function buildStepsHeader(): ProductFeedStepsHeader {
  return {
    kicker: 'EN TOUT',
    totalDuration: '5 minutes le soir',
    lead: 'Quatre gestes lents, une fois par semaine.',
  };
}

function buildStepsPostCta(): ProductFeedStepsPostCta {
  return {
    label: 'Démarrer le rituel',
    anchorId: 'commander-femiglow',
  };
}
```

## 8. Override admin singleton (G5 — optionnel)

Pattern miroir `KitPackOverride` :

```ts
// apps/web/src/lib/kit/steps/types.ts
export interface KitStepsOverridePatch {
  header?: ProductFeedStepsHeader | null;
  postCta?: ProductFeedStepsPostCta | null;
  /**
   * Override partiel des 4 steps — clé = numéro 1-4.
   * Champs : duration, isResult, icon (la copy reste pilotée par git).
   */
  stepOverrides?: Record<1 | 2 | 3 | 4, Partial<ProductFeedStep>> | null;
}

export interface KitStepsOverride extends KitStepsOverridePatch {
  id: 'kit:steps';
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  draftedAt: Date | null;
  createdBy: string | null;
}
```

## 9. Helpers purs (lib/kit/steps/)

| Helper | Signature | Rôle |
|---|---|---|
| `computeTotalDuration(steps)` | `(steps: ProductFeedStep[]) => string \| null` | Parse les durées « 30 s », « 1 min », additionne, formate « 5 minutes ». Pour fallback si `stepsHeader.totalDuration` absent. |
| `pickResultStep(steps)` | `(steps) => ProductFeedStep \| null` | Retourne le step `isResult: true` ou le dernier par défaut. |

Tests purs vitest associés.

## 10. Rétro-compatibilité

- Le `ProductFeed` produit par un `buildKitProductFeed` avant la refonte
  (sans `stepsHeader`, sans `duration`, sans `icon`) reste valide ;
- Les tests `feed.xml`, `merchant-xml`, `json-ld` ne lisent jamais les
  nouveaux champs → aucune régression Google Shopping ;
- Le composant public `StepsTimeline` rend gracieusement les états
  partiels (pas de header → on saute le header ; pas de durée → pas de
  badge ; pas de icon → pas de pictogramme).
