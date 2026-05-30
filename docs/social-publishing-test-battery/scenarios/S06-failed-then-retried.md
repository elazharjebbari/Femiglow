# S06 — Failed then retried

## Pré-conditions
- 1 post + 1 compte ; Postiz initial 503

## Étapes
1. publish-now → adapter retry 3× → all 503 → status='failed', lastError={code:'provider_unavailable'}
2. Toast "Publication : Provider indisponible."
3. JobQueue affiche row failed avec lastError visible
4. (Backend recovers) Postiz back online
5. Click "Retry" sur la row
6. Toast "Reprise demandée"
7. Job → status='queued' → 'publishing' → 'published'
8. JobQueue update : status='published'

## Critères
- 1 INSERT job, ~3 social_publish_attempt rows
- 1 social_publish_publication après retry succès
- audit_log : retried + published

## Spec
`e2e/social-publishing/failed-then-retried.spec.ts`
