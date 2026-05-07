# Frontend — Éditeur RBAC

L'éditeur de la matrice rôles × ressources × actions. La section la
plus sensible : on bloque très précisément qui peut faire quoi.

Fichier : `apps/web/src/components/admin/settings/RbacEditor.tsx`.

## Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  RBAC                                                [+ Ajouter rôle]│
│  ┌────────────┬───────┬───────┬──────────┬─────────┐                │
│  │ Rôle       │ Comp. │ SEO   │ Produits │ Médias  │  ...           │
│  ├────────────┼───────┼───────┼──────────┼─────────┤                │
│  │ superadmin │ ✓ all │ ✓ all │ ✓ all    │ ✓ all   │  (lock)        │
│  │ admin      │ rwpd  │ rwpd  │ rwpd     │ rwpd    │                │
│  │ editor     │ rw__  │ rw__  │ rw__     │ rw__    │                │
│  │ viewer     │ r___  │ r___  │ r___     │ r___    │                │
│  └────────────┴───────┴───────┴──────────┴─────────┘                │
│  Légende : r=read · w=write · p=publish · d=delete                  │
└─────────────────────────────────────────────────────────────────────┘
```

Chaque cellule contient 4 mini-toggles (rwpd) que l'on coche
indépendamment.

## Comportements

### Ajouter un rôle

Click **+ Ajouter rôle** → modale :

- **Key** : kebab-case (`content-manager`)
- **Hérite de** : select existant (`viewer`, `editor`, `admin`,
  ou `aucun`)

Validation : key unique, regex `^[a-z][a-z0-9-]*$`.

### Modifier une cellule

Click sur un toggle (r/w/p/d) → le toggle bascule, le state local
update. Pas de PATCH par cellule, save global.

### Garde-fous

- **superadmin** est verrouillé : les 4 actions sur toutes les
  ressources sont activées et non-modifiables.
- **Self-lock** : impossible de retirer ses propres permissions
  d'écriture sur `app-config` si on n'est pas `superadmin`. Toast
  préventif si tentative.

### Supprimer un rôle

Action **…** → **Supprimer** → modal de confirmation avec :

- Récap : « Ce rôle est attribué à 3 utilisateur·trice·s. Ils
  perdront leurs permissions. »
- Note obligatoire (audit trail)

Le delete ne fait pas vraiment d'orphelinage : si un user a un rôle
inexistant, le système traite ça comme « aucune permission ».

## Composants

```tsx
<RbacEditor initialMatrix={matrix}>
  <RbacToolbar />
  <RbacGrid>
    {roles.map(role =>
      <RbacRow key={role} role={role} permissions={matrix[role]} />,
    )}
  </RbacGrid>
  <RbacLegend />
</RbacEditor>
```

### `<RbacCell>`

Composant cellule unique :

```tsx
<RbacCell
  role={role}
  resource={resource}
  actions={['read', 'write']}
  locked={role === 'superadmin'}
  onChange={(next) => dispatch({ type: 'update', role, resource, actions: next })}
/>
```

Rend 4 mini-toggles avec lettre. Hover = tooltip explicite (« read :
peut consulter les composants »).

## Validation

Avant save, on `safeParse` contre `rbacSchema`. En cas d'erreur :

- Surlignage rouge des cellules / lignes problématiques
- Message en haut de page : « N erreurs à corriger »

Erreurs typiques :

- `superadmin` sans toutes les perms (ne devrait jamais arriver vu
  le verrou UI, mais double check)
- Key de rôle invalide (rejetée à la création modale)

## Save flow

```ts
async function handleSave() {
  const parsed = rbacSchema.safeParse({ matrix: state.matrix });
  if (!parsed.success) {
    dispatch({ type: 'set-errors', errors: parsed.error.issues });
    return;
  }

  // Modal de confirmation obligatoire pour rbac
  const confirmed = await openConfirmModal({
    title: 'Confirmer les changements RBAC',
    diff: <ConfigDiff before={initialMatrix} after={parsed.data.matrix} />,
    requireNote: true,
  });
  if (!confirmed) return;

  await fetch(`/api/admin/settings/rbac`, {
    method: 'PATCH',
    headers: { 'If-Match': String(currentVersion) },
    body: JSON.stringify({ ...parsed.data, note: confirmed.note }),
  });
}
```

## A11y

- Tableau : `role="grid"` avec headers `role="columnheader"`
- Cellules : `role="gridcell"` + `aria-label` complet (« editor,
  composants, write, activé »)
- Toggles : `role="checkbox"` + `aria-checked`
- Navigation clavier : flèches dans la grille, Espace pour toggle
- Légende : `<dl>` sémantique avec `<dt>r</dt><dd>read</dd>...`

## Tests RTL

- Click toggle bascule l'état local
- superadmin row : tous les toggles disabled
- Self-lock : tentative retirer write → toast + pas de changement
- Save fail Zod → erreurs visibles
- Save success → toast + version mise à jour

## Tests e2e

- Modifier un rôle test → save → vérifier dans une page protégée
  que les permissions ont changé (autre user avec ce rôle)
- 409 conflict (deux admins en même temps)
- Audit log : vérifier `app-config.update` avec section=rbac et diff
