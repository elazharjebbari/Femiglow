# F27 — Audit log events

## Importance : 🟠 P1

## Objectif
Tracer toute action publish dans `audit_log` pour audit et debugging.

## Actions loguées

| Action | Quand | Meta |
|--------|-------|------|
| `social.publish.published` | Job → status=published | jobId, provider, platform, remoteId, permalink |
| `social.publish.failed` | Job → status=failed (terminal) | jobId, errorCode, attemptCount |
| `social.publish.scheduled` | Job → mode=schedule créé | jobId, scheduledAt |
| `social.publish.cancelled` | Job → status=cancelled | jobId, reason |
| `social.publish.retried` | Job retry triggered | jobId, attemptCount |
| `social.draft_created` | Mode=draft job succeeded | jobId, provider, remoteId |
| `social.account.synced` | Postiz sync called | count, added, updated |

## Tests
Voir `test-scenarios.yaml`.
