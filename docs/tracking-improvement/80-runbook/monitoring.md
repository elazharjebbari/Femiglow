# 80.4 — Monitoring & alerting

## Métriques à surveiller

| Métrique | Source | Seuil warn | Seuil critical | Action |
|---|---|---|---|---|
| `/api/track` p95 latency | server logs | > 300ms | > 1000ms | Investiguer DB / dispatch slow |
| `/api/track` 5xx rate | server logs | > 1% | > 5% | Page on-call |
| Provider success rate (google_ads) | tracking_events_log | < 95% | < 70% | Email admin |
| Provider success rate (meta) | tracking_events_log | < 95% | < 70% | Email admin |
| Conversion count 1h (vs avg 7j) | tracking_events_log | -30% | -80% | Page on-call (anomaly) |
| OAuth Google Ads token errors | tracking_events_log | > 5/h | > 20/h | Email admin (refresh token) |
| Service uptime | systemctl + monitor | < 99.5% | < 99% | Page on-call |
| DB disk usage | df -h | > 80% | > 95% | Email admin (cleanup) |

## Dashboard cible (Grafana ou natif)

Si Grafana :
```
Row 1 — Traffic
  Panel A: /api/track requests/sec
  Panel B: /api/track p95 latency

Row 2 — Conversions
  Panel C: Conversions par catégorie (1h)
  Panel D: Conversion rate / form_start → purchase

Row 3 — Providers health
  Panel E: Success rate par provider (24h)
  Panel F: P95 latency par provider (24h)
  Panel G: Errors par provider (24h)

Row 4 — Business
  Panel H: Revenue 7j
  Panel I: ROAS Google Ads
```

Si natif : `/admin/tracking/analytics/providers` (cf. 50-ui-ux-design).

## Alerting

### Via email (basique)

```typescript
// Background job (cron) qui scan tracking_events_log
async function checkProviderHealth() {
  const last1h = await db.query(`
    SELECT
      kind,
      count(*) FILTER (WHERE (providers_results->kind->>'status') = 'success') as ok,
      count(*) FILTER (WHERE (providers_results->kind->>'status') = 'failed') as failed
    FROM tracking_events_log, unnest(providers_dispatched) as kind
    WHERE received_at >= now() - interval '1 hour'
    GROUP BY kind
  `);

  for (const row of last1h) {
    const total = row.ok + row.failed;
    if (total === 0) continue;
    const successRate = row.ok / total;
    if (successRate < 0.70) {
      await sendEmail({
        to: 'admin@femiglow-maroc.com',
        subject: `🚨 Provider ${row.kind} success rate ${(successRate*100).toFixed(1)}%`,
        body: `Last 1h: ${row.ok} OK / ${row.failed} failed. Investiguer.`,
      });
    }
  }
}
```

### Via Sentry (si configuré)

Auto-capture des exceptions dans `lib/tracking/*`. Filter pour éviter le bruit :
```typescript
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  beforeSend(event) {
    // Skip provider transient errors (déjà loggés en DB)
    if (event.tags?.kind === 'tracking_dispatch_failed') {
      return null;
    }
    return event;
  },
});
```

## Logs structurés

Format JSONL pour grep facile :
```json
{
  "ts": "2026-05-13T12:00:00.000Z",
  "level": "info",
  "component": "tracking.dispatcher",
  "event_id": "uuid",
  "event_name": "purchase",
  "provider_kind": "google_ads",
  "status": "success",
  "latency_ms": 380,
  "http_status": 200
}
```

Requêtes utiles :

```bash
# Erreurs Google Ads sur 24h
journalctl -u femiglow.service --since '24h ago' \
  | jq -r 'select(.component=="tracking.dispatcher" and .provider_kind=="google_ads" and .status=="failed")'

# Latence moyenne par provider
journalctl -u femiglow.service --since '1h ago' \
  | jq -r 'select(.component=="tracking.dispatcher") | "\(.provider_kind) \(.latency_ms)"' \
  | awk '{ sum[$1] += $2; count[$1] += 1 } END { for (k in sum) print k, sum[k]/count[k] }'
```

## SLO/SLI

Cibles de Service Level :
- **SLO `/api/track` availability** : 99.9% sur 30 jours
- **SLO `/api/track` p95 latency** : 95% des req < 200ms
- **SLO Google Ads CAPI success rate** : 95% sur 7 jours
- **SLO Conversion deduplication** : 99% (les conversions Google Ads correctement dédupliquées entre client/server)

## Healthcheck endpoint

`/api/health` doit retourner :
```json
{
  "status": "ok",
  "uptime": 7200,
  "components": {
    "db": "ok",
    "tracking_providers_enabled": 5,
    "last_event_received_at": "2026-05-13T12:00:00Z",
    "google_ads_oauth_valid": true
  }
}
```

Si un component est en error : status='degraded' avec détail.
