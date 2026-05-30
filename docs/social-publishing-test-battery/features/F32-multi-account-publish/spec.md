# F32 — Multi-account publish

## Importance : 🟠 P1

## Objectif
Quand un post doit être publié sur plusieurs comptes (ex: IG + FB), créer 1 job par compte avec idempotency keys distinctes.

## Comportement
- Si UI sélectionne 1 seul accountId : 1 job
- Si "publish to all connected" : N jobs (1 par compte actif)
- Chaque job a sa propre idempotencyKey
- Jobs exécutés en parallèle (ou sérialisés selon limite)

## Tests
Voir `test-scenarios.yaml`.
