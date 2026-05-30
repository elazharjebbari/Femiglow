# F19 — Cross-cutting (a11y, dark mode, responsive, keyboard, mock badge)

## Objectif
Garantir les exigences transverses sur l'ensemble de la page.

## A11y

- Tous les boutons ont un libellé accessible
- Tous les inputs ont un `<label>` associé
- Focus visible (outline accent)
- Tab order naturel (top→bottom, left→right par défaut)
- Dialogs : focus trap + escape close
- Status (toast, autosave) : `role="status"`
- Combobox (ModelPicker) : `role="combobox"`, `aria-expanded`, `aria-controls`
- Audit axe-core : 0 violation critical, 0 serious

## Dark mode

- Toutes les couleurs via `var(--cs-*)`
- Test : snapshot `prefers-color-scheme: dark`
- Pas de texte invisible (contraste ≥ 4.5:1)

## Responsive

- Desktop ≥ 1280px : 3 colonnes
- Tablet 1024-1280px : 2 colonnes (preview en pile sous le reste)
- Mobile < 1024px : 1 colonne (ordre : Stepper → IntentionForm → Variants → Media → Caption → Preview → Publish)

## Keyboard

- Cmd/Ctrl + S : flush autosave
- Cmd/Ctrl + Enter dans Caption : déclenche Valider (si conditions OK)
- Cmd/Ctrl + K : ouvre ModelPicker focus (optionnel)
- Esc dans Dialog : ferme

## Mock badge

Composant `MockModeBadge` rendu dans Stepper header et PublishActionGroup, source `/health`.

## Tests
Voir `test-scenarios.yaml`.
