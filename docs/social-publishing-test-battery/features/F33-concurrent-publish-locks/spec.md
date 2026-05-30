# F33 — Concurrent publish locks

## Importance : 🟠 P1

## Objectif
Empêcher 2 workers d'exécuter le même job simultanément via lock atomique (UPDATE … WHERE lockedAt IS NULL).

## Comportement
- `tryAcquirePublishJobLock(jobId)` :
  - UPDATE WHERE id=jobId AND lockedAt IS NULL SET status='publishing', lockedAt=now()
  - Si 0 rows affected → lock conflict, retourne false
- Worker skips si lock déjà tenu
- Lock TTL (orphan) : si lockedAt > 5min sans update → libéré automatiquement

## Tests
Voir `test-scenarios.yaml`.
