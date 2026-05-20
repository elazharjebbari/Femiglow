# 03 — Data model

Toutes les extensions sont **rétro-compatibles** : les nouveaux champs sont
optionnels, un `SubProduct` sans ces champs reste valide et rendu en mode
dégradé (sans intro, sans tooltip).

## 1. Extensions sur les schemas existants

### 1.1 `ingredientDetailedSchema` — ajout `inciDefinition`

`apps/web/src/lib/schemas/product.ts` ligne 20.

```ts
export const ingredientDetailedSchema = z.object({
  name: z.string().min(1),
  inci: z.string().min(1),
  function: z.string().min(1),
  origin: z.string().min(1),
  concentrationPct: z.number().min(0).max(100).optional(),
  description: z.string().optional(),

  // NOUVEAU — Phase 1
  /**
   * Définition courte du nom INCI affichée dans le tooltip `InciTooltip`.
   * Voix maison, 1-2 phrases courtes, jamais > 200 caractères.
   *
   * Exemples acceptés :
   *  - « Nom officiel de la cire d'abeille pure. Filme l'ongle sans le sceller. »
   *  - « Forme cosmétique du silicate. Lisse et polit, sans rayer. »
   *
   * Si absent, le composant `InciTooltip` n'expose pas le bouton ⓘ.
   *
   * cf. Kolenda §4.5 (UX §7 Hide unnecessary — tooltip sur termes techniques).
   */
  inciDefinition: z
    .string()
    .trim()
    .min(1)
    .max(200)
    .optional(),
});
```

### 1.2 `subProductSchema` — ajout `narrative` + `usageHint`

`apps/web/src/lib/schemas/product.ts` ligne 48.

```ts
export const subProductSchema = z.object({
  // … champs existants
  sensation, contextualImage, accentColor, // (déjà optionnels)

  // NOUVEAU — Phase 1
  /**
   * Intro narrative (voix maison) affichée en italique Cormorant sous le
   * titre du sous-produit, avant le tableau / les cards d'ingrédients.
   * Compose la « fiche d'atelier » Kolenda §4.5.
   *
   * Contraintes :
   *  - 1-3 phrases (max 320 caractères après trim).
   *  - Termine par une ponctuation finale (`.`, `!`, `?`, `»`).
   *  - Mentionne idéalement origine + sensation gestuelle.
   *
   * Exemple :
   *   « 12 % de cire fondue à basse température par la coopérative
   *     apicole du Moyen Atlas. Une noisette filme dix doigts. »
   *
   * Optionnel — si absent, pas d'intro rendue.
   */
  narrative: z
    .string()
    .trim()
    .min(1)
    .max(320)
    .regex(
      /[.!?»]$/,
      'narrative doit se terminer par une ponctuation finale (. ! ? »)',
    )
    .optional(),

  /**
   * Mention gestuelle Easy-to-imagine (Copywriting §9) qui prolonge le
   * `volume` du sous-produit. Affichée en mode « 1 Paste · 15 g · une
   * noisette filme dix doigts ».
   *
   * Contraintes :
   *  - 1-60 caractères trim.
   *  - Minuscules (formatage CSS uppercase autorisé).
   *  - Pas de ponctuation finale (clausule, pas phrase).
   *
   * Exemples : « une noisette filme dix doigts », « trois minutes de pose », « le polissoir vit 6 mois ».
   *
   * Optionnel — si absent, le titre reste « 1 Paste — 15 g ».
   */
  usageHint: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .optional(),
});
```

### 1.3 Pas de modification sur `certificationSchema`

Conservation actuelle (`label`, `body`, `badgeImage?`). Suffisant pour le
rendu chips champagne actuel.

## 2. Nouveau type côté Front

### 2.1 Tri par % décroissant

Pas un schema, mais un helper pur (utilisé par `IngredientsTable` et par
le nouveau `IngredientCard`).

`apps/web/src/lib/kit/composition/sort.ts` (nouveau) :

```ts
/**
 * Trie les ingrédients par concentration % décroissante. Les ingrédients
 * sans `concentrationPct` sont placés en queue (préserve l'ordre source).
 *
 * Pur — pas de mutation, retourne une nouvelle ref. cf. Kolenda §11
 * Luxury — transparence par ordre décroissant.
 */
export function sortByConcentrationDesc<I extends { concentrationPct?: number }>(
  ingredients: ReadonlyArray<I>,
): I[] {
  const withPct = [];
  const withoutPct = [];
  for (const ing of ingredients) {
    if (typeof ing.concentrationPct === 'number') withPct.push(ing);
    else withoutPct.push(ing);
  }
  withPct.sort((a, b) => (b.concentrationPct ?? 0) - (a.concentrationPct ?? 0));
  return [...withPct, ...withoutPct];
}
```

## 3. Override admin singleton (Phase 5)

Suivre exactement le pattern `KitVideoOverride` (cf. video phase 6.A).

### 3.1 Storage

`apps/web/src/lib/kit/composition/store.ts` (nouveau) :

```ts
export interface KitCompositionOverridePatch {
  // 1 override par sous-produit, indexé par sub.id.
  // Permet à l'admin de modifier individuellement chaque card.
  subProductId: '1-paste' | '2-powder' | '3-polissoir';

  // Champs éditables — tous optionnels.
  narrative?: string | null;
  usageHint?: string | null;
  ingredients?: Array<{
    inci: string;           // clé de matching (immuable)
    name?: string;          // override
    function?: string;
    origin?: string;
    concentrationPct?: number | null;
    inciDefinition?: string | null;
  }>;
  certifications?: Array<{ label: string; body: string }> | null;
}

export interface KitCompositionOverride extends KitCompositionOverridePatch {
  id: string;                          // = `kit-composition:${subProductId}`
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  draftedAt: Date | null;
  createdBy: string | null;
}
```

Indexé par `id` (3 entrées max). Réutilise le pattern `ext()` sur
`memoryStore` (cf. SEO, kit-video).

### 3.2 Zod schema upsert

`apps/web/src/lib/kit/composition/schemas.ts` (nouveau) :

```ts
export const kitCompositionOverrideUpsertSchema = z.object({
  subProductId: z.enum(['1-paste', '2-powder', '3-polissoir']),
  narrative: narrativeSchema.nullable().optional(),
  usageHint: usageHintSchema.nullable().optional(),
  ingredients: z
    .array(
      z.object({
        inci: z.string().min(1).max(100),
        name: z.string().min(1).max(100).optional(),
        function: z.string().min(1).max(120).optional(),
        origin: z.string().min(1).max(120).optional(),
        concentrationPct: z.number().min(0).max(100).nullable().optional(),
        inciDefinition: z.string().min(1).max(200).nullable().optional(),
      }),
    )
    .min(1)
    .max(20)
    .optional(),
  certifications: z
    .array(
      z.object({
        label: z.string().min(1).max(60),
        body: z.string().min(1).max(60),
      }),
    )
    .min(1)
    .max(8)
    .nullable()
    .optional(),
});
```

### 3.3 Cascade resolver

`apps/web/src/lib/kit/composition/resolver.ts` (nouveau) :

```
resolveKitComposition(subProductId)
  ├── 1. Si override publié pour subProductId → merge sur le mock
  ├── 2. Sinon → retourne le mock pur
  └── Meta : { source: 'override-published' | 'override-draft' | 'mock',
              publishedAt, draftedAt, updatedAt }
```

Merge profond : un override `narrative: null` revient au mock pour ce champ
(comportement déjà éprouvé sur `KitVideoOverride`).

## 4. Mock à enrichir

`apps/web/src/data/mock/kit.ts` — pour chaque des 3 sous-produits, ajouter :

```ts
// Sub-product 1 Paste
{
  ...existant,
  usageHint: 'une noisette filme dix doigts',
  narrative:
    '12 % de cire d’abeille fondue à basse température par la coopérative apicole du Moyen Atlas. Trois minutes de pose, le fini est mat.',
  ingredients: [
    {
      ...existant,
      inciDefinition: 'Nom officiel de la cire d’abeille pure. Filme l’ongle sans le sceller.',
    },
    // … (1 inciDefinition par ingrédient)
  ],
}
```

Charge éditoriale : **15 inciDefinitions** (5 par sous-produit en moyenne) +
**3 narrative** + **3 usageHint**.

## 5. Tracking schemas

`apps/web/src/lib/tracking/schemas.ts` — ajout (Phase 4) :

```ts
composition_accordion_open: z
  .object({
    sub_product_id: z.string(),
    sub_product_name: z.string().optional(),
  })
  .strict(),

composition_inci_tooltip_open: z
  .object({
    sub_product_id: z.string(),
    inci_term: z.string(),
  })
  .strict(),

composition_post_cta_click: z
  .object({
    sub_product_id: z.string(),
    cta_target: z.string(),
  })
  .strict(),

composition_narrative_view: z
  .object({
    sub_product_id: z.string(),
  })
  .strict(),
```

Et dans `apps/web/src/lib/tracking/event-catalog.ts`, déclarer les 4 events
avec leur catégorie `engagement` et leur mapping `composition_*` côté
adapters tiers (GA4, Meta CAPI). cf. doc 04.

## 6. Tests de schema

`apps/web/src/lib/schemas/product.composition.test.ts` (nouveau) — ~15 cas :

- ✅ `ingredientDetailedSchema` accepte sans `inciDefinition` (rétro-compat)
- ✅ Avec `inciDefinition` valide (≤ 200 chars)
- ❌ Refuse `inciDefinition` > 200 chars
- ✅ `subProductSchema` accepte sans `narrative` ni `usageHint` (rétro-compat)
- ✅ Accepte `narrative` 1-320 chars terminé par ponctuation
- ❌ Refuse `narrative` sans ponctuation finale
- ❌ Refuse `narrative` > 320 chars
- ✅ Accepte `usageHint` 1-60 chars
- ❌ Refuse `usageHint` > 60 chars
- ✅ Mock `mockKitPageContent.composition` parse sans erreur avec extensions
- ✅ `kitCompositionOverrideUpsertSchema` accepte patch vide `{ subProductId }`
- ✅ Refuse `subProductId` hors enum
- ✅ Refuse override `ingredients[]` vide
- ✅ Refuse certifications avec label > 60 chars
- ✅ Accepte `concentrationPct: null` (reset au mock)

## 7. Migration des données

Aucune migration de prod requise : tous les champs sont optionnels et
ajoutés en mock. Côté admin, la table memoryStore se construit
incrémentalement à chaque save (pas de seed initial nécessaire).

**Backlog Drizzle** : à terme, créer une table `kit_composition_overrides`
(colonnes : `id`, `sub_product_id`, `payload jsonb`, timestamps). Mais
hors-scope de cette refonte — le memoryStore suffit pour valider l'UX
admin avant de payer la migration.

## 8. Récap modèle

```
SubProduct
  ├── id, name, shortDescription, volume, image
  ├── sensation? (existant)
  ├── contextualImage? (existant)
  ├── accentColor? (existant)
  ├── narrative?         ← NOUVEAU (Phase 1)
  ├── usageHint?         ← NOUVEAU (Phase 1)
  ├── ingredients[]
  │     └── Ingredient
  │           ├── name, inci, function, origin
  │           ├── concentrationPct?, description?
  │           └── inciDefinition?  ← NOUVEAU (Phase 1)
  └── certifications[]

KitCompositionOverride (singleton par subProductId)
  ├── id = `kit-composition:${subProductId}`
  ├── narrative?, usageHint?
  ├── ingredients?[] (override par INCI)
  ├── certifications?[]
  └── meta (createdAt, updatedAt, publishedAt, draftedAt, createdBy)
```
