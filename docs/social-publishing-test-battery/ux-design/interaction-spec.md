# UX Interaction spec — Social Publishing

## Principes
- **Aucune action publish ne doit être déclenchable sans confirmation**
- **Toujours afficher un toast** (success ou erreur) après une action
- **Mock mode badge** omniprésent quand activé
- **Étapes irréversibles** signalées clairement (icône warning, texte explicite)

## Patterns interaction

### Publish dropdown
1. Click trigger → Radix Menu ouvre
2. 3 menuitems : description sous chaque label
3. Click menuitem → ouvre Dialog correspondant
4. Esc / click outside → ferme dropdown

### Confirm dialog
1. Body : ConfirmPreview (G12) + texte explicatif
2. Footer : Annuler (ghost) + Confirmer (primary)
3. Esc → ferme
4. Loading state sur Confirmer pendant API call
5. Auto-close on success

### Schedule presets
1. 3 boutons avant l'input datetime-local
2. Click preset → input s'auto-remplit
3. Input modifiable manuellement
4. Validation HTML5 min=now+5min

### Job retry / cancel
- Inline buttons sur les rows JobQueue
- Retry : confirmation modale optionnelle
- Cancel : confirmation obligatoire si publishing (urgent)

### QuickEditDrawer
- Slide-in droite
- Esc close
- Click outside close
- Focus trap

## States loading

| Action | Loading UI |
|--------|-----------|
| publish-now | Spinner sur Confirmer button |
| schedule | Spinner sur Programmer button |
| retry | Spinner sur Retry button row |
| cancel | Spinner sur Cancel button row |
| sync | Spinner sur Sync button + skeleton sur AccountHealthCard |

## States empty

| Composant | Empty state |
|-----------|-------------|
| JobQueue | "Aucun job récent" + illustration |
| Calendar | "Pas de posts ce {period}" |
| AccountHealthCard | "Aucun compte connecté — connectez-vous via Postiz" |
| LibraryClient | "Aucun contenu" + CTA "Créer" |

## States error

| Type | UI |
|------|----|
| Pre-flight (avant publish) | Toast mapped FR (Phase 6 / formatError) |
| Provider (Postiz down) | Toast + JobQueue row failed avec lastError |
| Network | Toast "Connexion perdue, réessayez" |
| Auth | Banner persistant + redirect login |

## A11y

- Tous les boutons : aria-label si icon-only
- Dialogs : role=dialog, aria-labelledby
- Combobox (account selector) : role=combobox, aria-expanded
- Status changes : role=status, aria-live=polite
- Loading : aria-busy=true
