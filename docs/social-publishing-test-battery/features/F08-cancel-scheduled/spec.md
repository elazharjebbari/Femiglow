# F08 — Cancel scheduled / queued

## Importance : 🟠 P1

## Objectif
Annuler une publication programmée ou en queue avant son exécution.

## Comportement attendu

### UI flow (QuickEditDrawer)
1. Double-click CalendarCard
2. Drawer ouvre
3. Click "Annuler la publication"
4. Confirmation modale "Êtes-vous sûr ?"
5. Click "Confirmer" → POST `/posts/:id/cancel`
6. Toast "Publication annulée"
7. Drawer ferme, card disparaît du calendar

### API
- POST `/api/admin/content-studio/posts/:id/cancel`
- Body : `{ reason?: string }`

### Side effects
- UPDATE `content_post.status='cancelled'`, cancelledAt, cancelReason
- UPDATE `social_publish_job.status='cancelled'`, lockedAt cleared
- INSERT `audit_log` action='social.publish.cancelled'

### États autorisés
- post.status ∈ {approved, scheduled} → 200
- post.status ∈ {published, failed, cancelled, archived} → 409 invalid_state

## Tests
Voir `test-scenarios.yaml`.
