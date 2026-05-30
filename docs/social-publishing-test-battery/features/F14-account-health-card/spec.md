# F14 — AccountHealthCard

## Importance : 🟡 P2

## Objectif
Tableau de bord home : liste des comptes sociaux connectés avec leur santé (dernière publication, dernière erreur).

## Comportement attendu

### Rendu
- En-tête : "Comptes sociaux" + count "X connectés"
- Pour chaque compte :
  - Nom + platform icon (Instagram, Facebook…)
  - Badge status (active / token_expired / disabled)
  - Dernière publication (timestamp + status)
  - Dernière erreur (si présente, dans les 7j)
- Bouton "Sync" qui appelle `/postiz/integrations/sync`
- Empty state si pas de compte

### Données
- Fetch `/api/admin/content-studio/postiz/integrations` (ou réutilise SWR)
- Fetch `/api/admin/content-studio/publish-jobs?status=failed&limit=10` pour les erreurs récentes

## Tests
Voir `test-scenarios.yaml`.
