# Frontend — Éditeur NAV

L'éditeur de navigation admin est l'écran le plus visible du module
admin-config : modification du sidebar admin.

Fichier : `apps/web/src/components/admin/settings/NavEditor.tsx`.

## Layout

```
┌────────────────────────────────────────────────────────────────────┐
│  Navigation                                       [+ Ajouter item]  │
│  ┌──────┬─────────┬───────────┬──────────┬──────────────┬────────┐ │
│  │ ⠿    │ Key     │ Label     │ Href     │ Icon / Rôle  │ Actions│ │
│  ├──────┼─────────┼───────────┼──────────┼──────────────┼────────┤ │
│  │ ⠿    │ home    │ Accueil   │ /admin   │ home / —     │ [✎] [🗑] │ │
│  │ ⠿    │ comp    │ Composants│ /admin/co│ component/ed │ [✎] [🗑] │ │
│  │ ⠿    │ seo     │ SEO       │ /admin/se│ search / ed  │ [✎] [🗑] │ │
│  │ ⠿    │ prod    │ Produits  │ /admin/pr│ box / ed     │ [✎] [🗑] │ │
│  │ ⠿    │ media   │ Médias    │ /admin/me│ image / ed   │ [✎] [🗑] │ │
│  │ ⠿    │ settings│ Réglages  │ /admin/se│ gear / sa    │ [✎] [🗑] │ │
│  └──────┴─────────┴───────────┴──────────┴──────────────┴────────┘ │
│                                                                     │
│  Aperçu sidebar :                                                   │
│  ┌──────────┐                                                       │
│  │ 🏠 Accueil│                                                       │
│  │ 🧩 Composants │                                                   │
│  │ 🔍 SEO    │                                                       │
│  │ ...      │                                                       │
│  └──────────┘                                                       │
└────────────────────────────────────────────────────────────────────┘
```

## Comportements

### Ajouter un item

Click **+ Ajouter** → ligne vide en édition, focus sur **Key**.

Validation :

- `key` regex `^[a-z][a-z0-9-]*$`, unique
- `label` 1..40 chars
- `href` doit commencer par `/`
- `icon` doit exister dans le registre d'icônes (`searchIcons`)
- `requiresRole` ∈ {`admin`, `editor`, `superadmin`} optionnel

### Éditer un item

Click ✎ → la ligne devient éditable inline. Tab navigue les champs.
Échap annule, Entrée valide.

Erreurs : surlignage rouge + message sous le champ.

### Supprimer

Click 🗑 → confirmation inline « Supprimer ? » avec timeout 5s.
Pas de DELETE API direct : on supprime en mémoire, le PATCH global
écrira le nouvel array.

### Réordonner

`@dnd-kit/core` + sortable. Drop met à jour `position` localement.
Re-numérote 0..N pour éviter les trous.

### Aperçu sidebar

Sous-composant `<NavPreview items={localItems} />` rend une simulation
de la sidebar admin avec les changements en cours, sans persistance.

## Composants

```tsx
<NavEditor initialItems={items}>
  <NavTable items={items}>
    {items.map(i => <NavRow key={i.key} item={i} />)}
  </NavTable>
  <NavAddButton />
  <NavPreview items={items} />
</NavEditor>
```

## State management

```ts
type State = {
  items: NavItem[];
  errors: Record<string, ZodIssue[]>;
  editingKey: string | null;
  pendingDeletes: Set<string>;
};

type Action =
  | { type: 'add' }
  | { type: 'update'; key: string; patch: Partial<NavItem> }
  | { type: 'remove'; key: string }
  | { type: 'reorder'; orderedKeys: string[] }
  | { type: 'set-errors'; errors: Record<string, ZodIssue[]> }
  | { type: 'set-editing'; key: string | null };
```

## Save flow

Pas de save par ligne : un seul **Enregistrer** global qui PATCH
toute la section :

```ts
async function handleSave() {
  const parsed = navSchema.safeParse({ items: state.items });
  if (!parsed.success) {
    dispatch({ type: 'set-errors', errors: groupByKey(parsed.error.issues) });
    return;
  }

  await fetch(`/api/admin/settings/nav`, {
    method: 'PATCH',
    headers: { 'If-Match': String(currentVersion) },
    body: JSON.stringify(parsed.data),
  });
}
```

Toast de succès + nouvelle version dans le state.

## Champs spéciaux

### `<IconPickerField>`

Réutilise `IconEditor` du composants-CMS (cf
`components/admin/components/fields/editors/IconEditor.tsx`). Picker
modal avec recherche fuzzy.

### `<RoleSelectField>`

Select 4 options (`'-' | 'editor' | 'admin' | 'superadmin'`). Affiche
un badge coloré pour reconnaissance.

### `<HrefField>`

Input texte avec validation regex live. Suggère les routes admin
existantes (autocomplete sur la liste statique
`KNOWN_ADMIN_ROUTES`).

## A11y

- Grille : `role="grid"`, navigation flèches
- Drag handle : `aria-roledescription="poignée de tri"` + flèches
  ↑/↓ alternative
- Erreurs inline : `aria-invalid` + `aria-describedby`
- Live region `role="status"` pour annonces (« Item ajouté », « Item
  déplacé en position 3 »)
- Focus management : après ajout, focus sur **Key** ; après
  suppression, focus sur la ligne suivante

## Tests RTL

Cas testés :

- Ajout item valide
- Validation : key dup, href sans /, icon invalide
- Drop reorder met à jour positions
- Save → PATCH avec If-Match
- 409 conflict → toast « concurrent change »
- Annuler avant save → état initial restauré
