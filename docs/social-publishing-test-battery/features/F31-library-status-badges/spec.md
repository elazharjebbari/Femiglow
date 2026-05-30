# F31 — Library status badges

## Importance : 🟡 P2

## Objectif
Liste filtrable des drafts + posts avec badges de statut visibles. Permet à l'opérateur de retrouver rapidement un post publié, en cours, ou échoué.

## Comportement
- Filtres URL-synced : search, status, pillar, platform
- Badge par status :
  - approved → success
  - scheduled → accent
  - published → success + checkmark
  - failed → danger
  - cancelled → neutral
  - draft (idée/brief sans post) → neutral
- Click card → ouvre détail ou redirect /create

## Tests
Voir `test-scenarios.yaml`.
