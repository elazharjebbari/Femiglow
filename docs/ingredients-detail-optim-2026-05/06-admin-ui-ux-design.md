# 06 — Admin UI/UX design

## 1. Vue d'ensemble

3 éditeurs singleton dédiés (un par sous-produit), accessibles via :

```
/admin/kit/composition          → liste 3 cards (1-paste, 2-powder, 3-polissoir)
/admin/kit/composition/1-paste  → éditeur sous-produit
/admin/kit/composition/2-powder → éditeur sous-produit
/admin/kit/composition/3-polissoir → éditeur sous-produit
```

Réutilise **strictement** le pattern `/admin/kit/video` livré.

## 2. Routes Next.js

```
app/admin/kit/composition/page.tsx               ← RSC liste
app/admin/kit/composition/[id]/page.tsx          ← RSC éditeur (auth + load)
```

Toutes les routes sont **server-side rendered**, auth `requireAdmin()`.

## 3. Page liste `/admin/kit/composition`

```
┌──────────────────────────────────────────────────────────┐
│  Composition `/kit`                                       │
│  Cascade : override publié → mock.                        │
│  Reset par sous-produit = retour au mock du repo.         │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │  ⓪① Paste    │  │  ⓪② Powder   │  │  ⓪③ Step 4   │    │
│  │  15 g        │  │  8 g          │  │  1 pièce      │    │
│  │              │  │               │  │              │    │
│  │  Mock /      │  │  Brouillon /  │  │  Publié /    │    │
│  │  default     │  │  3 mai 26     │  │  1 mai 26    │    │
│  │              │  │               │  │              │    │
│  │  [Éditer →]  │  │  [Éditer →]   │  │  [Éditer →]  │    │
│  └──────────────┘  └──────────────┘  └──────────────┘    │
└──────────────────────────────────────────────────────────┘
```

Statut affiché : `Mock par défaut` / `Brouillon` (date) / `Publié` (date).

## 4. Page éditeur `/admin/kit/composition/[id]`

Layout 2 colonnes desktop, accordéon mobile.

```
┌──────────────────────────────────────────────────────────────┐
│  [← Retour liste] 1 Paste                                     │
│  Statut : Brouillon · 3 mai 2026 14:32                       │
├─────────────────────────────────┬────────────────────────────┤
│  Colonne édition (gauche)       │  Aperçu live (droite)      │
│                                  │                            │
│  ▾ Identité éditoriale            │  ╭──────────────────────╮ │
│     ──                            │  │ ⓪① 1 Paste — 15 g   │ │
│     Mention gestuelle (usageHint) │  │ · une noisette…      │ │
│     [une noisette filme dix doigts]│  │                      │ │
│                                   │  │ « 12 % de cire…    » │ │
│     Intro narrative                │  │                      │ │
│     [textarea 3-4 lignes]          │  │ ╭──────────────────╮ │ │
│     ↳ ponctuation finale obligatoire│  │ │ Cire d'abeille  12% │ │
│                                   │  │ │ Cera Alba ⓘ      │ │ │
│  ▾ Ingrédients (×3)               │  │ │ Filme · Atlas    │ │ │
│     ──                            │  │ ╰──────────────────╯ │ │
│     #01 Cire d'abeille  [Modifier]│  │ …                    │ │
│       ↳ Cera Alba                  │  │                      │ │
│       ↳ Filmogène · Atlas · 12 %  │  │ [Certifications]     │ │
│       ↳ Définition INCI            │  │ Voir le pack ↓       │ │
│       [Nom officiel de la cire…]   │  ╰──────────────────────╯ │
│                                   │                            │
│     #02 Huile de jojoba [Modifier]│                            │
│     …                              │                            │
│                                   │                            │
│     [+ Ajouter un ingrédient]     │                            │
│                                   │                            │
│  ▾ Certifications (×2)            │                            │
│     ──                            │                            │
│     [Cosmos Organic — Ecocert]  ✕ │                            │
│     [Vegan — EVE Vegan]         ✕ │                            │
│     [+ Ajouter]                    │                            │
│                                   │                            │
├─────────────────────────────────┴────────────────────────────┤
│  [Annuler]  [Enregistrer]  [Publier sur /kit]  [Reset au mock]│
└──────────────────────────────────────────────────────────────┘
```

## 5. Composants admin nouveaux

### 5.1 `KitCompositionListPage` (page liste)

`app/admin/kit/composition/page.tsx`. RSC qui charge les 3 overrides via
`listKitCompositionOverrides()` + 3 mock subproducts.

### 5.2 `KitCompositionEditor` (éditeur unique)

`components/admin/kit-composition/KitCompositionEditor.tsx`. Pattern
identique au `KitVideoEditor` (cf. video phase 6.C).

**Props** :
```ts
interface Props {
  subProductId: '1-paste' | '2-powder' | '3-polissoir';
  initial: KitCompositionOverride | null;
  baseSubProduct: SubProduct;          // pour aperçu de fallback
  source: 'mock' | 'override-draft' | 'override-published';
}
```

**State local** :
```ts
interface FormState {
  narrative: string;
  usageHint: string;
  ingredients: IngredientFormItem[];
  certifications: Array<{ label: string; body: string }>;
}
```

**Buttons** :
- **Enregistrer le brouillon** (PATCH) — disabled si !dirty || !valid
- **Publier sur /kit** (POST /publish) — disabled si dirty || mock
- **Reset au mock** (modale + saisie `RESET-COMPOSITION-{id}`)

### 5.3 `IngredientsArrayEditor` (sub-form)

`components/admin/kit-composition/IngredientsArrayEditor.tsx`.

Liste accordéon des ingrédients, chacun éditable :
- Nom (text)
- INCI (text, clé immuable affichée mais éditable avec warning)
- Fonction (text)
- Origine (text)
- Concentration % (number, optionnel)
- Définition INCI (textarea max 200)

Bouton « + Ajouter un ingrédient » crée un nouvel item vide.
Bouton « ✕ Supprimer » sur chaque item.
Tri auto par % décroissant (visible côté aperçu live).

Validation Zod live → erreurs sous champs concernés.

### 5.4 `CertificationsEditor` (sub-form)

`components/admin/kit-composition/CertificationsEditor.tsx`.

Simple liste de 2 inputs (label / body) par certification. Max 8.

### 5.5 `CompositionPreviewCard` (aperçu live)

`components/admin/kit-composition/CompositionPreviewCard.tsx`.

Réutilise `SubProductBlock` en lecture seule. Construit un `SubProduct`
synthétique à partir du `baseSubProduct` mergé avec le `FormState` actuel.
Re-rendu à chaque keystroke (debounce 200 ms si lag perçu).

### 5.6 `KitCompositionResetDialog` (modale)

`components/admin/kit-composition/KitCompositionResetDialog.tsx`.

Pattern identique à `KitVideoResetDialog`. Demande la saisie de
`RESET-COMPOSITION-{id}` (ex. `RESET-COMPOSITION-1-PASTE`) pour confirmer.

## 6. Validation côté UI

À chaque keystroke :

```ts
const validation = kitCompositionOverrideUpsertSchema.safeParse(toPatch(state));
const fieldError = (path: string) =>
  validation.success ? null
    : validation.error.issues.find(i => i.path.join('.') === path)?.message;
```

Erreurs affichées sous chaque champ via `<span data-testid="error-{field}">`.

**Bouton Save désactivé** si `!validation.success || !dirty`.

## 7. UX patterns

### 7.1 Statut visible en permanence

Header de l'éditeur affiche le statut courant :
- `Mock par défaut` (gris)
- `Brouillon · {date}` (jaune)
- `Publié · {date}` (vert)

`data-testid="kit-composition-status"`.

### 7.2 Feedback Save / Publish / Reset

Pas de toast lib. State local `success` / `error` affiché en pied de
formulaire :
- Success : `<div role="status" data-testid="kit-composition-success">Brouillon enregistré</div>`
- Error : `<div role="alert" data-testid="kit-composition-error">{message}</div>`

### 7.3 Confirmation Reset

Modale inline (pas Portal) :
- Bouton « Reset au mock » ouvre la modale
- Input `<input type="text" data-testid="kit-composition-reset-input">`
- Bouton « Confirmer » désactivé tant que `value !== "RESET-COMPOSITION-{ID}"`
- Au clic Confirmer : `POST /reset` → reset state, ferme modale

### 7.4 Dirty tracking

```ts
const dirty = useMemo(
  () => JSON.stringify(state) !== JSON.stringify(fromOverride(initial, baseSubProduct)),
  [state, initial, baseSubProduct],
);
```

Si dirty + navigation vers liste → confirm popup browser natif (`beforeunload`).

## 8. Sidebar admin

Ajouter une entrée dans `AdminShell` :

```ts
{ href: '/admin/kit/composition', key: 'kit-composition', label: 'Composition /kit' },
```

Active sur tous les sous-paths `/admin/kit/composition/*`.

## 9. Accessibilité admin

| Élément | Standard |
|---|---|
| Tous les boutons Save/Publish/Reset/Add/Remove | `<button type="button">` sauf submit |
| Formulaire `<form>` natif avec submit handler | `onSubmit={e => { e.preventDefault(); save(); }}` |
| Inputs avec `<label>` associés | `htmlFor` + `id` |
| Erreurs Zod | `aria-describedby={errorId}` + `<span id={errorId}>` |
| Modale reset | `role="dialog"`, `aria-modal="true"`, focus trap |
| Touche Esc | Ferme la modale reset |

## 10. Tests admin (résumé)

Cibles vitest (Phase 5) :
- `KitCompositionEditor.test.tsx` (~20 cas) : rendu, validation, save, publish, reset
- `IngredientsArrayEditor.test.tsx` (~10 cas) : add/remove, tri %, validation INCI
- `CertificationsEditor.test.tsx` (~5 cas) : add/remove, validation

Cibles API routes (Phase 5) :
- `route.test.ts` GET/PATCH (~10 cas)
- `publish/route.test.ts` (~5 cas)
- `reset/route.test.ts` (~3 cas)

## 11. Conventions partagées avec `/admin/kit/video`

- Style boutons : `bg-encre text-creme` primary, `bg-emerald-700` publish, `border-rose-300` reset
- Section header sticky en haut (à terme — backlog)
- Aperçu live à droite, formulaire à gauche (split 60/40)
- Pas de toast lib — feedback inline

## 12. Hors-scope (backlog)

- Édition multi-langue (fr / ar) des `narrative` / `inciDefinition`
- Audit log dédié visible dans l'UI admin (utiliser l'audit existant)
- Drag-drop pour réordonner les ingrédients (le tri auto par % décroissant suffit)
- Upload d'image custom par ingrédient (l'image vient déjà du `SubProduct`)
- Édition simultanée multi-onglets (lock optimiste = backlog)
