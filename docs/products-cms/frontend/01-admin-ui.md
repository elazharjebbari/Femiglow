# Frontend — UI admin

3 vues principales :

- `/admin/products` (liste + filtres)
- `/admin/products/[slug]` (détail / éditeur, plusieurs onglets)
- `/admin/products/[slug]/variants` (sous-page dédiée variantes)

Toutes héritent d'`AdminShell` avec NAV item « Produits ».

## `/admin/products` — Liste

### Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  Produits                                       [+ Nouveau]      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ [statut ▼] [catégorie ▼] [recherche ____________________]  │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌──────────┬─────────────┬──────────┬───────┬─────────┬──────┐  │
│  │ Visuel   │ Titre / slug│ Catégorie│ Prix  │ Variantes│ Statut│ │
│  ├──────────┼─────────────┼──────────┼───────┼─────────┼──────┤  │
│  │  [thumb] │ Le Kit      │ kit      │ 49 €  │ 2       │ Publ.│  │
│  │  [thumb] │ Le Rituel   │ rituel   │ 29 €  │ 1       │ Draft│  │
│  └──────────┴─────────────┴──────────┴───────┴─────────┴──────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Comportements

- Tri par `updated_at` desc par défaut, click sur un header pour changer
- Ligne cliquable → page détail
- Badge statut coloré (vert publish, ambre draft, gris archived)
- Bouton **+ Nouveau** ouvre une modale :
  - `slug` (texte, validation regex, vérification dispo serveur-side)
  - `title`
  - `category` (autocomplete sur les catégories existantes)
  - **Créer le brouillon** → redirige vers détail

### Vue archived

Toggle « Inclure archivés » dans les filtres. Affiche les fiches
archivées avec opacity 60% et un bouton **Restaurer** (passe en
draft, status=draft).

## `/admin/products/[slug]` — Détail

### Onglets

```
┌──────────────────────────────────────────────────────────────────┐
│  [Général] [Médias] [Variantes] [Historique]   [Statut: Draft]   │
│                                                  [Publier]       │
│  ──────────────────────────────────────────────────────────────  │
│  Onglet actif                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### Onglet Général

Champs (form RHF léger ou useReducer + dirty tracking) :

- `title` (text 120)
- `tagline` (text 180)
- `description` (rich-text, MDX-light editor)
- `category` (autocomplete)
- `tags` (chips)
- `featured` (toggle)
- `position` (number, optionnel — sinon auto)

### Onglet Médias

Réutilise `SlotCard` + `MediaPicker` avec les 3 slots produit :

- `packshot` (1:1, requis)
- `lifestyle` (4:3, optionnel)
- `gallery` (multi, 0..N)

### Onglet Variantes

Cf. [`02-variants-editor.md`](./02-variants-editor.md).

### Onglet Historique

- Liste 50 derniers snapshots
- Pour chaque : date, actor, note
- Action **Voir le diff** + **Restaurer le draft**

### Bouton Publier

- Désactivé si :
  - validation Zod échoue
  - aucune variante
  - aucun packshot
- Click → modale de confirmation avec récap des changements
- Après publish : toast + rafraîchissement de l'historique

## Save flow (optimiste)

```
Champ modifié
  ↓ debounce 800 ms
PATCH /api/admin/products/[slug]
  ↓
Optimistic state update (state remplacé immédiatement)
  ↓ (si erreur) rollback + toast
```

Les variantes ont leur propre flow (CRUD ligne par ligne, pas de
batch).

## Composants partagés

| Composant            | Fichier                                               | Rôle |
|----------------------|-------------------------------------------------------|------|
| `ProductEditorShell` | `components/admin/products/ProductEditorShell.tsx`    | layout onglets + sticky header |
| `ProductGeneralForm` | `components/admin/products/ProductGeneralForm.tsx`    | onglet général |
| `ProductMediaPanel`  | `components/admin/products/ProductMediaPanel.tsx`     | onglet médias |
| `VariantsEditor`     | `components/admin/products/VariantsEditor.tsx`        | onglet variantes |
| `ProductHistoryPanel`| `components/admin/products/ProductHistoryPanel.tsx`   | onglet historique |
| `PriceField`         | `components/admin/products/fields/PriceField.tsx`     | input cents → display formaté |
| `TagsField`          | `components/admin/products/fields/TagsField.tsx`      | chips input |
| `RichTextField`      | `components/admin/products/fields/RichTextField.tsx`  | éditeur description |
| `CategoryField`      | `components/admin/products/fields/CategoryField.tsx`  | autocomplete |

## A11y

- Onglets : `role="tablist"` + `role="tab"` + `aria-selected`
- Form : `aria-invalid`, `aria-describedby` pour erreurs
- Live region pour annonces save/publish
- Focus trap dans modales (création produit, confirm publish)
- Tab order logique : champs > variantes > médias > publier
