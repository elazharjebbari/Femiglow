# F30 — Calendar view (plan page)

## Importance : 🟠 P1

## Objectif
Vue calendrier des posts scheduled/published avec filtres + drag-drop.

## Vues
- **Week** : 7 colonnes jour, lines = heures
- **Month** : grille 7×N (semaines)
- **List** : liste chronologique avec sticky day headers
- URL-synced via `?view=week|month|list`

## Filtres
- Status : approved/scheduled/published/failed/cancelled (multi-select)
- Platform : instagram/facebook
- Pillar : rituel/produit/...

## Interactions
- Click card → ouvre détail (modal ou redirect /create?draft=)
- Double-click → QuickEditDrawer
- Drag → preview ghost + drop target highlight → reschedule API

## Tests
Voir `test-scenarios.yaml`.
