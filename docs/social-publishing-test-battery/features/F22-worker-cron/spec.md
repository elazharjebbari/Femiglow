# F22 — Worker cron (scheduled jobs)

## Importance : 🔴 P0

## Objectif
Cron handler `runScheduledPublishJobs()` pick les jobs en queue dont scheduledAt est passé, et les exécute jusqu'à un max configurable.

## Comportement
1. Query : `SELECT * FROM social_publish_job WHERE status='queued' AND scheduledAt <= now() AND lockedAt IS NULL ORDER BY scheduledAt ASC LIMIT 5`
2. Pour chaque job : `executeJob(jobId, actorId='system')`
3. Si execute lève → continue (autres jobs)
4. Return count succès / échecs

## Configuration
- `MAX_JOBS_PER_RUN` : 5 par défaut, configurable 1-20
- Cron `/api/cron/content-studio/social-publish-scheduler` toutes les 5min
- Auth bearer CRON_SECRET

## Tests
Voir `test-scenarios.yaml`.
