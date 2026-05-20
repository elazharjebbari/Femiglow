# 06 — Admin UI/UX design

## 1. Vue d'ensemble

1 éditeur singleton (`/admin/kit/pack`). Pattern mirroir strict des
éditeurs `KitVideoEditor` et `KitCompositionEditor` déjà livrés.

## 2. Route

```
app/admin/kit/pack/page.tsx          ← RSC éditeur singleton (auth + load)
```

Sidebar `AdminShell` : ajout entrée `kit-pack` label « Pack /kit ».

## 3. Layout

```
┌──────────────────────────────────────────────────────────────┐
│  [← Retour console] Bloc Pack — /kit                          │
│  Statut : Mock par défaut · Dernière modif : —                │
├─────────────────────────────────┬────────────────────────────┤
│  Colonne édition (gauche)       │  Aperçu live (droite)      │
│                                  │                            │
│  ▾ Hero copy                     │  ╭──────────────────────╮ │
│     Kicker [Le pack]              │  │ LE PACK              │ │
│     Titre [Le rituel s'installe…]│  │ Le rituel…           │ │
│     Lead [Trois objets…]          │  │                      │ │
│     Pricing prefix [Tout compris :]│  │ [packshot]          │ │
│                                   │  │ Valeur séparée 320 MAD│
│  ▾ CTA                            │  │                      │ │
│     Label [Commander le rituel]   │  │ Tout compris : 199…  │ │
│     Couleur o sauge o encre o cham│  │ Économie 191 MAD     │ │
│     Microcopy [Paste · Powder…]   │  │ ≈ 1,5 MAD/manucure   │ │
│                                   │  │ [Commander le rituel]│ │
│  ▾ Valeur séparée                 │  │                      │ │
│     #1 Paste [110] MAD       ✕    │  │ … claims, social…    │ │
│     #2 Powder [90] MAD       ✕    │  ╰──────────────────────╯ │
│     #3 Polissoir Step 4 [120] ✕   │                            │
│     [+ Ajouter item]               │                            │
│     Label total [Valeur séparée]   │                            │
│                                   │                            │
│  ▾ Reframing valeur d'usage       │                            │
│     [≈ 1,5 MAD par manucure …]    │                            │
│                                   │                            │
│  ▾ Social proof                   │                            │
│     Libellé géographique           │                            │
│     [287 femmes · Rabat, Casa…]   │                            │
│                                   │                            │
├─────────────────────────────────┴────────────────────────────┤
│  [Annuler] [Enregistrer] [Publier sur /kit] [Reset au mock]   │
└──────────────────────────────────────────────────────────────┘
```

## 4. Composants admin nouveaux

### 4.1 `KitPackEditor` (éditeur principal)

`components/admin/kit-pack/KitPackEditor.tsx`. Pattern identique au
`KitVideoEditor` (cf. video phase 6.C).

**Props** :
```ts
interface Props {
  initial: KitPackOverride | null;
  baseFeed: ProductFeed;          // pour fallback aperçu
  source: 'mock' | 'override-draft' | 'override-published';
}
```

**State local** :
```ts
interface FormState {
  kicker: string;
  title: string;
  lead: string;
  pricePrefix: string;
  ctaLabel: string;
  ctaMicrocopy: string;
  ctaAccent: 'encre' | 'sauge-dark' | 'champagne-dark' | '';
  perUsageHint: string;
  valueBreakdown: { label: string; priceCents: number }[];
  totalLabel: string;
  countLabelGeo: string;
}
```

**Buttons** :
- **Enregistrer le brouillon** (PATCH) — disabled si !dirty || !valid
- **Publier sur /kit** (POST /publish) — disabled si dirty || mock
- **Reset au mock** (modale + saisie `RESET-PACK`)

### 4.2 `ValueBreakdownEditor` (sub-form)

`components/admin/kit-pack/ValueBreakdownEditor.tsx`.

Liste éditable d'items :
- Label (text, max 40)
- Prix unitaire en MAD (number → conversion cents)
- Bouton ✕ par item
- « + Ajouter item » (max 8)
- Field `totalLabel` (text, max 40)

Total auto-calculé visible en lecture seule.

Validation Zod live → erreurs sous champs concernés.

### 4.3 `KitPackPreviewCard` (aperçu live)

`components/admin/kit-pack/KitPackPreviewCard.tsx`.

Construit un `ProductFeed` synthétique à partir du `baseFeed` mergé avec
le `FormState`. Délègue à `<ProductFeedSection>` en mode preview
(read-only, pas de tracking). Debounce 200 ms.

### 4.4 `KitPackResetDialog` (modale)

Pattern identique à `KitVideoResetDialog`. Demande la saisie de
`RESET-PACK` pour confirmer.

## 5. Validation côté UI

À chaque keystroke :

```ts
const validation = kitPackOverrideUpsertSchema.safeParse(toPatch(state));
const fieldError = (path: string) =>
  validation.success ? null
    : validation.error.issues.find(i => i.path.join('.') === path)?.message;
```

**Bouton Save désactivé** si `!validation.success || !dirty`.

## 6. UX patterns

### 6.1 Statut visible

Header de l'éditeur :
- `Mock par défaut` (gris)
- `Brouillon · {date}` (jaune)
- `Publié · {date}` (vert)

`data-testid="kit-pack-status"`.

### 6.2 Feedback Save / Publish / Reset

Pas de toast lib. State local `success` / `error` affiché en pied de formulaire :
- Success : `<div role="status" data-testid="kit-pack-success">Brouillon enregistré</div>`
- Error : `<div role="alert" data-testid="kit-pack-error">{message}</div>`

### 6.3 Confirmation Reset

Modale inline :
- Bouton « Reset au mock » ouvre la modale
- Input avec `data-testid="kit-pack-reset-input"`
- Bouton « Confirmer » désactivé tant que `value !== "RESET-PACK"`
- Au clic Confirmer : `POST /reset` → reset state, ferme modale

### 6.4 Dirty tracking + beforeunload

```ts
const dirty = useMemo(
  () => JSON.stringify(state) !== JSON.stringify(fromOverride(initial, baseFeed)),
  [state, initial, baseFeed],
);
```

Si dirty + navigation → confirm popup natif `beforeunload`.

## 7. Sidebar admin

Ajouter entrée dans `AdminShell` :

```ts
{ href: '/admin/kit/pack', key: 'kit-pack', label: 'Pack /kit' },
```

Active sur `/admin/kit/pack/*`.

## 8. Accessibilité admin

| Élément | Standard |
|---|---|
| Tous les boutons Save/Publish/Reset/Add/Remove | `<button type="button">` sauf submit |
| Formulaire `<form>` natif avec submit handler | `onSubmit={e => { e.preventDefault(); save(); }}` |
| Inputs avec `<label>` associés | `htmlFor` + `id` |
| Erreurs Zod | `aria-describedby={errorId}` + `<span id={errorId}>` |
| Radios couleur CTA | `<fieldset>` + `<legend>` |
| Modale reset | `role="dialog"`, `aria-modal="true"`, focus trap |
| Touche Esc | Ferme la modale reset |

## 9. Tests admin (résumé)

Cibles vitest (Phase 4) :
- `KitPackEditor.test.tsx` (~15 cas) : rendu, validation, save, publish, reset, radios couleur CTA
- `ValueBreakdownEditor.test.tsx` (~8 cas) : add/remove items, validation min/max, total auto
- `KitPackPreviewCard.test.tsx` (~4 cas) : aperçu sync avec form state

Cibles API routes (Phase 4) :
- `route.test.ts` GET/PATCH (~10 cas)
- `publish/route.test.ts` (~4 cas)
- `reset/route.test.ts` (~3 cas)

## 10. Conventions partagées

- Style boutons : `bg-encre text-creme` primary, `bg-emerald-700` publish, `border-rose-300` reset
- Aperçu live à droite, formulaire à gauche (split 60/40)
- Pas de toast lib — feedback inline
- Aucune mention nominale de la fondatrice (voix maison neutre)

## 11. Hors-scope (backlog)

- Édition multi-langue (fr / ar) des champs
- Audit log dédié visible dans l'UI admin
- Drag-drop pour réordonner les items `valueBreakdown` (l'ordre source suffit)
- Upload d'image custom packshot (utilise `/products/kit-principale.svg` par défaut)
- Édition simultanée multi-onglets (lock optimiste = backlog)
