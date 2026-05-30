# F09 — Job Queue UI

## Importance : 🔴 P0

## Objectif
Affichage temps-réel des jobs en queue / en cours / récents. Permet retry / cancel inline. Polling 30s.

## Comportement attendu

### Rendu (composant JobQueue)
- En-tête : "Jobs récents" + filtres (status, accountId)
- Liste paginée des 50 derniers jobs (default 7j)
- Pour chaque row :
  - Badge status (queued accent / publishing warning / published success / failed danger / cancelled neutral)
  - Métadata : platform · format · provider
  - Timestamp scheduledAt ou "Immédiat" si null
  - Attempt count
  - Actions inline : Retry (si failed) / Cancel (si queued/publishing) / Voir le post
  - lastError affiché si failed

### Polling
- Re-fetch toutes les 30s
- Pas de re-fetch quand onglet hors focus (Page Visibility API)
- Refetch immédiat après retry/cancel

### API
- GET `/api/admin/content-studio/publish-jobs?status=&accountId=&limit=`

## Tests
Voir `test-scenarios.yaml`.
