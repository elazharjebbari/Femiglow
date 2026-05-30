# F11 — Cancel running/queued job

## Importance : 🟡 P2

## Objectif
Annuler un job en queue ou en cours de publication depuis JobQueue.

## Comportement attendu

### UI flow
1. Job avec status='queued' ou 'publishing'
2. Click "Cancel" inline
3. Confirmation modale (optionnelle si urgent)
4. POST `/publish-jobs/:id/cancel`
5. Toast "Job annulé"
6. Row passe à status='cancelled' (badge neutre)

### API
- POST `/api/admin/content-studio/publish-jobs/:id/cancel`
- Body : `{ reason?: string }`

### Side effects
- UPDATE `social_publish_job.status='cancelled'`, lockedAt cleared
- Lock release pour worker
- audit_log social.publish.job_cancelled

### États autorisés
- status ∈ {queued, publishing} → 200
- status ∈ {published, failed, cancelled} → 409 already_terminal

### Cas race
- Si le worker est en cours d'execution (status='publishing' + lockedAt récent < 1min), cancel est accepté mais le worker peut tout de même finir → log un warning

## Tests
Voir `test-scenarios.yaml`.
