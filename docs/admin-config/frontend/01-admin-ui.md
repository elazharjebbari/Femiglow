# Frontend — UI admin

## Vues

- `/admin/settings` (racine, 4 cartes)
- `/admin/settings/navigation` (nav editor)
- `/admin/settings/flags` (toggles)
- `/admin/settings/rbac` (matrice)
- `/admin/settings/branding` (couleurs + polices + logo)
- Onglet **Historique** par section

Toutes héritent d'`AdminShell` (NAV item « Réglages »).

## `/admin/settings` — Racine

Layout 4 cartes, une par section :

```
┌────────────────────────────────────────────────────────────────┐
│  Réglages                                                       │
│  ┌──────────────────┐  ┌──────────────────┐                   │
│  │ Navigation       │  │ Feature Flags     │                   │
│  │ 6 items          │  │ 12 flags          │                   │
│  │ [valeur défaut]  │  │ [3 modifiés]      │                   │
│  └──────────────────┘  └──────────────────┘                   │
│  ┌──────────────────┐  ┌──────────────────┐                   │
│  │ RBAC             │  │ Branding          │                   │
│  │ 4 rôles          │  │ 4 couleurs custom │                   │
│  │ [par défaut]     │  │ [modifié]         │                   │
│  └──────────────────┘  └──────────────────┘                   │
└────────────────────────────────────────────────────────────────┘
```

Chaque carte indique :

- Nombre d'items
- Badge **Modifié** ou **Par défaut**
- Date de dernière modification + actor

## Pattern partagé : `<SectionEditorShell>`

Toutes les sous-pages utilisent ce shell qui gère :

- Sticky header avec titre, badge, bouton **Enregistrer**
- Onglets **Édition** / **Historique**
- Détection dirty state
- Confirmation avant navigation si dirty
- Toast après save

```tsx
<SectionEditorShell
  section="nav"
  title="Navigation"
  description="Items affichés dans la sidebar admin."
>
  <NavEditor initialValue={initialValue} />
</SectionEditorShell>
```

## Save flow

Pas de save optimiste ici (à l'inverse des autres CMS). La
configuration impacte tout le site → on préfère :

1. **Édition locale** dans un useReducer
2. **Validation Zod côté client** au submit
3. **PATCH** explicite avec `If-Match: <version>` (optimistic lock)
4. Si 409 → toast « Quelqu'un d'autre a modifié, recharge »
5. Si 422 → erreurs inline par champ
6. Si 200 → toast succès + `version` mise à jour

## Confirmation avant action critique

Pour `rbac` et `flags` (sections sensibles) :

- Modale de confirmation avec récap des changements (diff visuel)
- Bouton **Confirmer** désactivé pendant 2 sec (anti-misclick)
- Note obligatoire (textarea) → sauvée dans `app_config_snapshots.note`

## Historique

Onglet partagé sous chaque section :

```
┌────────────────────────────────────────────────────────────────┐
│  Historique                                                     │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ il y a 2 h    elazhar@…     v3                            │  │
│  │   « Ajout du bouton SEO »                                 │  │
│  │   [Voir le diff] [Restaurer]                              │  │
│  ├──────────────────────────────────────────────────────────┤  │
│  │ il y a 3 j    fondatrice@…   v2                           │  │
│  │   « Renommage Composants → Pages »                        │  │
│  │   [Voir le diff] [Restaurer]                              │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## Composants partagés

| Composant            | Fichier                                                 | Rôle |
|----------------------|---------------------------------------------------------|------|
| `SectionEditorShell` | `components/admin/settings/SectionEditorShell.tsx`      | layout commun |
| `SectionCard`        | `components/admin/settings/SectionCard.tsx`             | carte racine |
| `ConfigDiff`         | `components/admin/settings/ConfigDiff.tsx`              | diff visuel JSON |
| `RestoreConfirmModal`| `components/admin/settings/RestoreConfirmModal.tsx`     | modal restore |
| `IfMatchHeader`      | `lib/admin-config/clientHelpers.ts`                     | helper PATCH avec version |

## A11y

- Sticky header : `role="banner"` avec aria-label « Réglages section X »
- Onglets : `role="tablist"` + `role="tab"` + `aria-selected`
- Form : labels explicites, `aria-invalid`, `aria-describedby`
- Modale confirm : focus trap + `aria-modal=true` + close on Escape
- Live region `role="status"` pour annonces save/restore/error

## Permissions UI

Chaque page `/admin/settings/[section]` est protégée RSC :

```tsx
export default async function NavSettingsPage() {
  const session = await getAdminSession();
  if (!hasPermission(session, 'app-config', 'write')) {
    redirect('/admin/settings');
  }
  // ...
}
```

Les boutons **Enregistrer** / **Restaurer** sont aussi désactivés
côté client si lecture seule.
