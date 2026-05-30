# F26 — Postiz analytics fetch

## Importance : 🟢 P3

## Objectif
Récupérer les métriques d'un post publié via Postiz : impressions, likes, comments, engagement, sur 7 jours.

## Flow
- GET Postiz `/api/public/v1/analytics/post/:postId?date=7`
- Parse + return shape standardisée
- Cache 1h optionnel

## Usage
- Affiché dans LibraryClient (post détail)
- Pas critique pour publish, mais important pour reporting

## Tests
Voir `test-scenarios.yaml`.
