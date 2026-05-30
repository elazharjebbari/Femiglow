# F35 — Mock mode badge

## Importance : 🟢 P3

## Objectif
Indicateur visuel "Mode mock" affiché partout où des actions publish peuvent être simulées (dropdown, dialog, toast).

## Comportement
- Source : `/health.mockMode` (déjà implémenté Phase 1)
- Composant `MockModeBadge` réutilisable
- Affiché dans :
  - Stepper header (create page)
  - PublishActionGroup footer
  - ConfirmPreview dans dialogs
  - Toast success ("Publication lancée (mock)")

## Tests
Voir `test-scenarios.yaml`.
