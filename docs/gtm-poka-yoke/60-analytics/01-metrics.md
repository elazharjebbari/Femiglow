# Métriques — Observabilité du Poka-Yoke

## KPIs principaux

| KPI | Définition | Cible | Mesure |
|---|---|---|---|
| **MTTD** | Mean Time To Detect — temps entre publication GTM et alerte affichée | < 5 min | Query sur `gtm_drift_history` |
| **MTTR** | Mean Time To Resolve — temps entre alerte et retour à OK | < 30 min | Idem |
| **Taux de couverture** | % d'imports passés par la couche A | > 80% en 4 sem | Compteur visites validate-pair vs export depuis admin |
| **Faux positifs** | Drifts critical résolus en < 5 min sans intervention | < 5% | Query sur `gtm_drift_history` |
| **Faux négatifs** | Drifts non détectés (mesurés a posteriori) | < 1% | Audit manuel mensuel |
| **Volume pings** | Pings/jour reçus | Stable ±20% | `count(*) FROM pings WHERE day = today` |
| **Silence anormal** | Jours avec < 1000 pings | 0 | Cron alert si chute brutale |

## Dashboard observabilité (Sentry / Grafana)

```yaml
# observability.yaml (intégré au runbook)
metrics:
  - name: gtm_sentinel_pings_received_total
    type: counter
    labels: [container_id, mapping_version, config_version]
    description: Nombre total de pings reçus

  - name: gtm_drift_status
    type: gauge
    labels: [status]
    description: 1 si actif, 0 sinon — facette par statut

  - name: gtm_drift_duration_seconds
    type: histogram
    labels: [status]
    description: Durée de chaque drift (de transition à résolution)

  - name: gtm_validate_pair_runs_total
    type: counter
    labels: [verdict]  # ok / warning / error
    description: Nombre d'exécutions du validate-pair

  - name: gtm_sentinel_endpoint_latency_ms
    type: histogram
    description: Latence du endpoint /api/track/sentinel

alerts:
  - name: gtm_drift_critical_open
    condition: gtm_drift_status{status="critical"} > 0
    duration: 10m  # alert après 10 min sans résolution
    severity: high
    notify: [admin-email, slack-tracking]

  - name: gtm_sentinel_pings_drop
    condition: rate(gtm_sentinel_pings_received_total[1h]) < 0.5 * rate(gtm_sentinel_pings_received_total[24h offset 24h])
    severity: medium
    description: Volume de pings chuté de >50% vs 24h avant
    notify: [admin-email]

  - name: gtm_sentinel_endpoint_5xx
    condition: rate(http_requests_total{route="/api/track/sentinel",status=~"5.."}[5m]) > 0.01
    severity: high
    notify: [admin-email, slack-incidents]
```

## Logs structurés

Tous les logs émis ont un format JSON :

```json
{
  "timestamp": "2026-05-13T19:32:01.234Z",
  "level": "warn",
  "event": "gtm.drift.transition",
  "from": "ok",
  "to": "critical",
  "reasons": [{"code": "mapping_version_drift", "expected": "v17", "got": "v16"}],
  "ping_id": "uuid-of-triggering-ping",
  "admin_snapshot": {...}
}
```

### Events loggés

| Event | Niveau | Quand |
|---|---|---|
| `gtm.sentinel.received` | debug | Chaque ping |
| `gtm.sentinel.invalid_payload` | warn | Payload Zod fail |
| `gtm.sentinel.rate_limited` | info | 429 |
| `gtm.drift.transition` | warn (critical) / info (autres) | Statut change |
| `gtm.drift.resolved` | info | Retour à OK |
| `gtm.validate-pair.executed` | info | Exec validate-pair (incl. verdict) |
| `gtm.cron.cleanup.executed` | info | Cron nightly |

## Rapports periodiques (admin)

### Rapport hebdomadaire (envoyé tous les lundis 9h)
```
GTM Poka-Yoke — semaine S-1
─────────────────────────────
✅ Pings reçus : 21 450 (-3% vs S-2)
🟢 Statut moyen : 99.7% OK, 0.3% warning, 0% critical
🔍 Drifts détectés : 1 (résolu en 14 min)
📋 Validate-pair runs : 3 (3 OK, 0 warning, 0 error)

Détail des drifts :
  • 2026-05-09 14:23 — mapping_version_drift, résolu en 14 min
```

### Rapport mensuel (1er du mois)
Inclut graphiques timeline 30j, comparatif M-1, recommandations.

## Trace IDs

Chaque ping reçu génère un trace ID propagé dans tous les logs :
```
ping_id (uuid) → drift_state.last_ping_id → drift_history.triggered_by_ping_id
```

Permet de tracer un drift de la cause (ping) à la résolution (transition history).
