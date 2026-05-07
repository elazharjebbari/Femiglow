# Frontend — Sous-form variantes

L'éditeur de variantes est l'un des composants les plus denses de
l'admin produits : grille tabulaire éditable, ré-ordonnancement,
calcul promo, validation par ligne.

Fichier : `apps/web/src/components/admin/products/VariantsEditor.tsx`.

## Layout

```
┌────────────────────────────────────────────────────────────────────┐
│  Variantes                                          [+ Ajouter]    │
│  ┌──────┬───────────┬──────────┬────────┬────────┬──────────┬────┐ │
│  │ ↕    │ SKU       │ Label    │ Prix   │ Promo  │ Stock    │ ✕  │ │
│  ├──────┼───────────┼──────────┼────────┼────────┼──────────┼────┤ │
│  │ ⠿    │ KIT-50    │ 50 ml    │ 49,00  │  —     │ Stock    │ 🗑 │ │
│  │ ⠿    │ KIT-100   │ 100 ml   │ 79,00  │ 69,00  │ Stock    │ 🗑 │ │
│  │ ⠿    │ KIT-LMT   │ Édition…│ 99,00  │  —     │ Pré-cmd  │ 🗑 │ │
│  └──────┴───────────┴──────────┴────────┴────────┴──────────┴────┘ │
└────────────────────────────────────────────────────────────────────┘
```

## Comportements

### Ajouter une variante

Click **+ Ajouter** → ligne vide en édition immédiate, focus sur le
SKU. Auto-suggest SKU à partir du slug + label (ex: `RITUEL-50`).

POST `/api/admin/products/[slug]/variants` au blur du dernier champ
required ou au click hors-ligne.

### Modifier une variante

Édition inline ; PATCH `/variants/[id]` débouncé à 800 ms par champ.

Validation par ligne :

- SKU unique côté client (vérif locale dans la liste)
- Prix > 0
- Promo < prix (si fourni)
- Devise = 3 chars upper

### Supprimer

Click 🗑 → confirmation inline (« Supprimer cette variante ? »).
DELETE `/variants/[id]`.

### Réordonner (drag & drop)

`@dnd-kit/core` + `@dnd-kit/sortable` (déjà utilisés dans le projet).

Au drop : POST `/variants/reorder` avec `orderedVariantIds: string[]`.
Mise à jour optimiste de `position` côté client ; rollback si erreur.

## Composants

```ts
<VariantsEditor productSlug={slug} initialVariants={variants}>
  <VariantsHeader />
  <VariantsList>
    {variants.map(v =>
      <VariantRow key={v.id} variant={v} />
    )}
  </VariantsList>
  <VariantAddButton />
</VariantsEditor>
```

## Champs spéciaux

### `<PriceField>`

Input contrôlé masqué : l'utilisateur tape `49,00` ou `49.00`,
stockage en cents.

```ts
function parsePrice(input: string): number | null {
  const cleaned = input.trim().replace(',', '.').replace(/[^\d.]/g, '');
  const value = parseFloat(cleaned);
  if (Number.isNaN(value)) return null;
  return Math.round(value * 100);
}

function formatPrice(cents: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}
```

### `<InventoryStatusField>`

Select 4 options avec icône :

- `available` ✓ vert
- `low_stock` ⚠ ambre
- `out_of_stock` ✕ rouge
- `preorder` ⏳ bleu

### `<AttributesField>` (avancé)

Key-value editor pour `attributes` (taille, parfum, etc.). Affiché
collapsed par défaut, expandable par variante.

## State management

`useReducer` local au composant `VariantsEditor` :

```ts
type State = {
  variants: ProductVariant[];
  pending: Record<string, 'patching' | 'deleting' | null>;
  errors: Record<string, ZodIssue[]>;
};

type Action =
  | { type: 'patch'; id: string; patch: Partial<ProductVariant> }
  | { type: 'add'; variant: ProductVariant }
  | { type: 'remove'; id: string }
  | { type: 'reorder'; orderedIds: string[] }
  | { type: 'commit-error'; id: string; issues: ZodIssue[] };
```

Pas de Zustand global. Le parent (`ProductEditorShell`) reçoit le
nombre de variantes via un callback `onVariantsCountChange` pour
piloter le bouton publish.

## Calcul promo (display)

Helper `computeDiscount({ priceCents, promoPriceCents })` :

```ts
function computeDiscount(p: { priceCents: number; promoPriceCents: number | null }) {
  if (!p.promoPriceCents) return null;
  const saved = p.priceCents - p.promoPriceCents;
  const percentage = Math.round((saved / p.priceCents) * 100);
  return { savedCents: saved, percentage };
}
```

Affichage : `-15%` à droite du prix promo.

## A11y

- Grille : `role="grid"`, `role="row"`, `role="gridcell"`
- Drag handle : `aria-roledescription="poignée de tri"` + flèches
  ↑/↓ (navigation clavier alternative)
- Erreurs inline : `aria-invalid` + `aria-describedby` pointant
  vers un `<div role="alert">`
- Focus management : après ajout, focus sur le SKU de la nouvelle
  ligne ; après suppression, focus sur la ligne suivante (ou la
  précédente si dernière)

## Tests RTL

Fixtures : 3 variantes typiques.

Cas testés :

- Ajout avec auto-SKU
- Édition d'un prix → debounce → PATCH
- Promo > prix → erreur inline
- Drop avec reorder → POST reorder
- Suppression → confirmation → DELETE
- Échec PATCH → rollback + toast
