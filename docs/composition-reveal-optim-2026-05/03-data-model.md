# 03 — Modèle de données

État existant et extensions à apporter pour la refonte.

## 1. Schema existant — à conserver

`apps/web/src/lib/schemas/product.ts:30-39` :

```ts
export const subProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortDescription: z.string(),
  volume: z.string(),
  image: imageSchema,
  ingredients: z.array(ingredientDetailedSchema).min(1),
  certifications: z.array(certificationSchema),
});
```

Schemas dépendants (à ne pas casser) :

- `kitPageContentSchema.composition = z.array(subProductSchema).min(3).max(4)` — contrat CMS.
- `imageSchema` — partagé avec Hero, journal, etc.
- `ingredientDetailedSchema` — utilisé par `IngredientsTable`.
- `certificationSchema` — partagé.

## 2. Extensions (Phase 1)

Champs **additifs et optionnels** pour préserver la rétrocompatibilité.

```ts
export const subProductSchema = z.object({
  // existant
  id: z.string(),
  name: z.string(),
  shortDescription: z.string(),
  volume: z.string(),
  image: imageSchema,
  ingredients: z.array(ingredientDetailedSchema).min(1),
  certifications: z.array(certificationSchema),

  // extensions Kolenda phase 1
  /**
   * Phrase de sensation physique (italique Cormorant sous la description).
   * 1-80 chars, ponctuation finale obligatoire. Si vide ou absent, la
   * mention n'est pas rendue (rétrocompat mock pre-refonte).
   */
  sensation: z
    .string()
    .min(1)
    .max(80)
    .regex(/[.!?»]$/, 'sensation must end with a punctuation mark')
    .optional(),

  /**
   * Image contextuelle (main qui prend, table de chevet). Affichée au
   * hover/tap par-dessus l'image isolated. Schema identique à `image`.
   */
  contextualImage: imageSchema.optional(),

  /**
   * Couleur d'accent du sous-produit, exprimée en token de la palette
   * FemiGlow. Sert à teinter discrètement la pastille numérotée et
   * éventuellement la bordure au hover.
   *
   * `null` ou absent → fallback `champagne` (or poudré `#B8956B`).
   */
  accentColor: z
    .enum(['sauge', 'petale', 'ciel', 'champagne'])
    .optional(),
});
```

## 3. Types dérivés

Le type TS suit l'inférence Zod :

```ts
export type SubProduct = z.infer<typeof subProductSchema>;
// Donne automatiquement :
// interface SubProduct {
//   id: string;
//   name: string;
//   shortDescription: string;
//   volume: string;
//   image: Image;
//   ingredients: IngredientDetailed[];
//   certifications: Certification[];
//   sensation?: string;
//   contextualImage?: Image;
//   accentColor?: 'sauge' | 'petale' | 'ciel' | 'champagne';
// }
```

## 4. Mock — mise à jour

`apps/web/src/data/mock/kit.ts:14-126` à enrichir :

| Sous-produit | `sensation` (proposé) | `accentColor` |
|---|---|---|
| Paste (id `1-paste`) | `« Tiède au contact. »` | `sauge` |
| Powder (id `2-powder`) | `« Glisse, ne grise pas. »` | `petale` |
| Polissoir (id `polissoir-step-4`) | `« La lumière revient à la surface. »` | `ciel` |

Le champ `contextualImage` reste **vide en phase 1**. Il est rempli en phase 3 quand les visuels contextuels seront produits (direction artistique).

## 5. Conventions

### 5.1 Format `sensation`

- 1-80 caractères.
- Phrase complète avec ponctuation finale (point, point d'exclamation, point d'interrogation, ou guillemet fermant français `»`).
- Voix maison : pas de superlatif, pas de tutoiement, pas de marqueur d'émotion (« waw », « ohh »).
- Préférer la **forme passive ou descriptive** : « Glisse, ne grise pas » plutôt que « Vous sentez qu'elle glisse ».
- Encadrement en guillemets français `« »` géré côté **rendu**, pas dans la donnée (la donnée porte le texte sans guillemets, le composant les ajoute).

Tests Zod à écrire (cf. `07-tests-strategy.md`) :

```ts
expect(subProductSchema.parse({ ...valid, sensation: 'Tiède.' })).toBeDefined();
expect(() => subProductSchema.parse({ ...valid, sensation: 'Tiède' })).toThrow(/ponctuation/);
expect(() => subProductSchema.parse({ ...valid, sensation: '' })).toThrow(/min/);
expect(() => subProductSchema.parse({ ...valid, sensation: 'x'.repeat(81) })).toThrow(/max/);
```

### 5.2 Choix `accentColor`

Mapping vers les tokens Annexe A du playbook :

| Token | Hex | Usage |
|---|---|---|
| `sauge` | `#A8B89E` | Paste — verte sauge naturelle |
| `petale` | `#F2CECC` | Powder — rose poudré packshot |
| `ciel` | `#C5DBE5` | Polissoir — bleu ciel pierre |
| `champagne` | `#B8956B` | Fallback / numéro générique |

Le composant rendra la **pastille numérotée** dans la couleur correspondante. La couleur est purement décorative (jamais utilisée seule comme indicateur d'état).

### 5.3 Format `contextualImage`

Même schema que `image` :

```ts
{
  src: string;         // /uploads/... ou URL média
  alt: string;         // descriptif obligatoire
  width: number;
  height: number;
  blurDataURL?: string;
}
```

Convention : photo cadrée main/produit, fond identique à `image` (cohérence visuelle au crossfade), même ratio (idéalement 4:5 ou 1:1).

## 6. Component-Media — extension

Le système actuel pose une `componentKey: 'kit-comparatif'` avec 3 slots. Pour les images **contextuelles**, deux options :

### Option A — Nouveaux slots dédiés (retenue)

Ajouter 3 slots au composant `kit-comparatif` :

| Slot | Cible | Type |
|---|---|---|
| `kit-base-contextual` | Paste — main qui prend | image |
| `kit-fortifiant-contextual` | Powder — pinceau / saupoudrage | image |
| `kit-lime-contextual` | Polissoir — passage sur ongle | image |

Pourquoi : aligné sur la convention existante, pas de migration DB, l'admin Component-Media gère déjà la complexité.

### Option B — Field `contextualMediaId` dans SubProduct (rejetée)

Ajouter un champ DB direct dans une nouvelle table `kit_sub_products`. Plus invasif, demande migration. Reporté à phase 6 (admin).

## 7. Migration des données

### 7.1 Phase 1 (schema + mock)

Pas de migration DB. Mise à jour mock TS + schema Zod. Tests Vitest verrouillent.

### 7.2 Phase 3 (images contextuelles)

Reseed Component-Media :

```bash
pnpm seed:components-fields:reconcile
```

Ajoute les 3 nouveaux slots si absents.

### 7.3 Phase 6 (admin)

Si l'admin éditeur stocke en DB (au-delà des images), nouvelle table :

```ts
// HORS PÉRIMÈTRE COURT TERME — documentation seulement
export const kitSubProductsOverrides = pgTable('kit_sub_products_overrides', {
  id: text('id').primaryKey(),                       // ex: '1-paste'
  name: text('name').notNull(),
  shortDescription: text('short_description').notNull(),
  volume: text('volume').notNull(),
  sensation: text('sensation'),
  accentColor: text('accent_color'),
  ingredients: jsonb('ingredients').notNull(),
  certifications: jsonb('certifications').notNull(),
  publishedAt: timestamp('published_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
  updatedBy: text('updated_by'),
});
```

Cascade : override DB > mock TS > schema defaults.

## 8. Invariants à préserver

1. **`composition.length ∈ {3, 4}`** au schema parent (`kitPageContentSchema`). Pas de modification.
2. **Aucun champ obligatoire ajouté.** Tous les nouveaux champs sont `optional()`.
3. **`image` reste obligatoire.** Le hero card affiche au moins l'image isolated.
4. **Schema rétrocompatible**. Un appelant qui ne connaît pas `sensation` continue de fonctionner.
5. **Aucun champ supprimé.** Évite la rupture côté `IngredientsTable`, `feed.xml`, et les tests existants.

## 9. Tests data layer

| Fichier | Sujet |
|---|---|
| `apps/web/src/lib/schemas/product.test.ts` (nouveau) | Validation `subProductSchema` étendu (12 cas) |
| `apps/web/src/data/mock/kit.test.ts` (nouveau) | Le mock satisfait `kitPageContentSchema` |
| `apps/web/src/lib/cms/mock/index.test.ts` (étendre) | `getKitPageContent()` retourne 3 sous-produits avec `sensation` set |

Détails complets dans `07-tests-strategy.md`.

## 10. Risques

| Risque | Mitigation |
|---|---|
| Ajout `sensation` rend les composants tiers (feed, JSON-LD) instables | Champ optionnel — aucun consommateur n'est forcé de l'utiliser |
| Photo contextuelle absente côté admin → crossfade vide | Fallback : si `contextualImage` ∅, on désactive le crossfade et reste sur isolated |
| `accentColor` enum verrouillé à 4 valeurs | Ajout futur d'une 5ᵉ couleur : extension simple du `z.enum`, pas de breaking |
| Test schema oublie un cas | Coverage threshold ≥ 95 % sur `product.ts` (vitest config) |
