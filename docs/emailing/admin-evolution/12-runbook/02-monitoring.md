# Monitoring & alertes

## Métriques à suivre

### Performance applicative

| Métrique | Cible | Outil |
|---|---|---|
| p95 page `/admin/emails/transactional` | < 1s | Sentry / NewRelic |
| p95 `/api/admin/emails/transactional/search` | < 500ms | Logs |
| p95 preview audience size | < 3s | Logs |
| p95 snapshot 10k | < 30s | Logs |
| p95 listmonk push 10k | < 5min | Logs |
| Cron tick automation duration | < 5s pour 100 runs | Logs |

### Volume & erreurs

| Métrique | Alerte si... |
|---|---|
| Errors 5xx /api/admin/emails/* | > 10/min |
| Automation runs errored 24h | > 5% du total |
| Snapshot errored 24h | > 1 |
| Listmonk 503 retries 1h | > 50 |
| Outbox bounce rate | > 2% / 24h |
| user_event INSERT rate | < 0.5× moyenne 7j (pipeline coupé ?) |

### Business

| Métrique | Cible |
|---|---|
| Nb audiences actives | n/a (info) |
| Nb automations actives | n/a (info) |
| Sends / jour | trend, alert si baisse > 50% |
| Open rate global | > 15% |
| Click rate global | > 1% |

## Dashboards à créer (Grafana ou équivalent)

### Dashboard "Emailing ops"
- KPI cards : sends 24h, delivered %, bounce %, complaint %
- Chart : sends per hour last 24h
- Top 5 templates par volume
- Top 5 errors

### Dashboard "Automation"
- Automations actives & runs/jour
- Step latency p95 per kind
- Errored runs (raison breakdown)

### Dashboard "Audiences"
- Audiences créées per week
- Snapshot taille distribution
- Listmonk push success rate

## Alertes (Sentry / PagerDuty)

| Alerte | Trigger | Severity |
|---|---|---|
| Listmonk service down | systemctl unit failed | Critical |
| Cron not ticking 30 min | no /api/cron/* run since 30min | High |
| Outbox queue > 1000 pending | `SELECT count(*) WHERE status='pending'` | Medium |
| Snapshot stuck 1h | `WHERE status='running' AND > 1h` | Medium |
| 5xx burst | > 10 / 5min | Medium |

## Logs structurés (à respecter)

Format JSON, fields obligatoires :

```json
{
  "ts": "2026-05-14T22:00:00Z",
  "level": "info|warn|error",
  "event": "audience.preview.completed",
  "context": {
    "audienceId": "...",
    "size": 47,
    "durationMs": 412
  },
  "userId": "elazhar@...",
  "traceId": "abc123"
}
```

Conventions event names :
- `<domain>.<action>` : ex `audience.created`, `snapshot.completed`,
  `automation.run.advanced`
- En passé pour actions terminées
- Pas de PII dans `context` (email ok pour debug — c'est admin)

## Health checks

Endpoint existant `/api/admin/emails/health` :
- Listmonk loopback
- DB connectivity
- Outbox queue size
- Last automation run age

Étendre avec :
- Audience snapshots stuck count
- user_event insert rate (last 1h)

## Métriques applicatives (Prometheus ou équivalent)

À long terme, exposer :
```
# HELP femiglow_emailing_sends_total Total sends
# TYPE femiglow_emailing_sends_total counter
femiglow_emailing_sends_total{status="delivered"} 1243
femiglow_emailing_sends_total{status="failed"} 8

# HELP femiglow_audience_snapshot_duration_ms ...
femiglow_audience_snapshot_duration_ms{audience="vip"} 412
```

V1 : pas obligatoire. V2 : oui.

## Audit logs

Toutes les actions admin emailing → `admin_audit_log`. Conservation
1 an. Dashboard admin pour consulter (déjà existant).

## Backup data

| Table | Fréquence backup | Retention |
|---|---|---|
| email_audience | quotidien | 30j |
| email_audience_snapshot | quotidien | 90j |
| email_automation | quotidien | 30j |
| user_event | quotidien | 30j |
| email_outbox | quotidien | 90j |
| Tous | weekly off-site | 1 an |
