# S07 — Programmé puis annulé

## Étapes
1. Schedule post (cf S02) → post.status='scheduled'
2. Plan → Calendar → double-click la card
3. QuickEditDrawer ouvre
4. Click "Annuler la publication"
5. Confirmation modale → Confirmer
6. Toast "Publication annulée"
7. Card disparaît du calendar
8. JobQueue : job status='cancelled'

## Critères
- POST /posts/:id/cancel appelé
- post.status='cancelled'
- job.status='cancelled', lockedAt cleared
- audit_log social.publish.cancelled
- Worker cron qui run après ne pick pas le job (status != queued)

## Spec
`e2e/social-publishing/scheduled-cancelled.spec.ts`
