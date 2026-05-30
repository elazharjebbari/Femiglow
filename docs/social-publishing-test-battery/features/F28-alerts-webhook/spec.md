# F28 — Alerts webhook (Slack)

## Importance : 🟡 P2

## Objectif
Notifier ops via webhook Slack-compatible quand une publication échoue (sauf mode=draft).

## Comportement
- À la fin de `executeJob` si status='failed' AND mode != 'draft' :
  - Build payload Slack : title, detail, severity, jobId, postId, accountId, errorCode
  - POST `$SOCIAL_ALERTS_WEBHOOK_URL` (fallback `$CHAT_ALERTS_WEBHOOK_URL`)
  - Timeout 5s, non-blocking (ne fait pas échouer le job)
  - Log error si webhook fail

## Tests
Voir `test-scenarios.yaml`.
