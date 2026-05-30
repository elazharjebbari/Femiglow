# F10 — Retry failed job

## Importance : 🟠 P1

## Objectif
Relancer un job en échec depuis JobQueue, sans recréer un post.

## Comportement attendu

### UI flow
1. Job avec status='failed' visible dans JobQueue
2. Click bouton "Retry" inline
3. Toast "Reprise demandée"
4. Le job change de status → 'queued' → 'publishing' → 'published' (ou 'failed' à nouveau)

### API
- POST `/api/admin/content-studio/publish-jobs/:id/retry`
- Aucun body

### Side effects
- UPDATE `social_publish_job.status='queued'`, lockedAt=null, attemptCount++
- executeJob lancé synchrone (ou async via worker)

### États autorisés
- job.status='failed' uniquement → 200
- Autre → 409 invalid_state

## Tests
Voir `test-scenarios.yaml`.
