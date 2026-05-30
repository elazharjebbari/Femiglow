# F04 — PublishActionGroup UI

## Importance : 🔴 P0

## Objectif
Composant footer central qui regroupe : indicateur autosave + badge mock mode + dropdown Publier (3 modes). Tout l'orchestration UI publish part de là.

## Comportement attendu

### Rendu
- Footer `<footer aria-label="Publier">`
- Côté gauche : `AutosaveIndicator` + `MockModeBadge` (si mockMode) + hint "Validez le draft…" si postId null
- Côté droit : bouton dropdown "Publier" (aria-label="Options de publication") + ChevronDown icon
- Bouton dropdown `disabled` si `postId` null OU `disabled` prop true

### Interaction
- Click dropdown → Radix Menu Portal ouvre avec 3 items + descriptions
- Click menuitem → ouvre Dialog correspondant
- Esc / click outside → ferme dropdown ou dialog

### Props clés
- `postId: string | null` — postId, drives `canPublish`
- `mockMode: boolean` — affiche MockModeBadge inline
- `preview: PublishConfirmPreview | null` — G12 dialog enrichi (thumbnail + caption)
- `autosave: { status, isDirty, lastSavedAt, error, flush }`
- `disabled?: boolean`
- `onPublished?: (mode) => void`

## Tests
Voir `test-scenarios.yaml`. Couvre rendu, états dropdown, props edge cases, callbacks, a11y.
