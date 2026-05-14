# 60.1 — KPIs et observabilité

## KPIs métier (à monitorer post-launch)

| KPI | Cible | Source | Fréquence |
|---|---|---|---|
| **Nombre de versions créées par mois** | ≥ 2 (preuve d'usage marketing) | COUNT(*) FROM event_mapping_versions WHERE created_at >= NOW() - INTERVAL '30 days' AND is_default = false | Hebdo |
| **Nombre d'activations / mois** | ≥ 1 | COUNT FROM audit WHERE action='activate' AND created_at >= ... | Hebdo |
| **% mappings dispatch réussis** | ≥ 99% | tracking_events_log providers_dispatched success | Quotidien |
| **Cache hit ratio resolveEventMapping** | ≥ 95% | Logs (cache hits / total calls) | Quotidien |
| **Export GTM utilisé / mois** | ≥ 1 (workflow complet adopté) | COUNT FROM audit WHERE action='export_gtm' | Hebdo |
| **Reset au default / trimestre** | 0-1 (signal de rollback) | COUNT FROM audit WHERE action='reset_to_default' | Mensuel |
| **Erreurs validation Zod / semaine** | < 5 (UX préventive) | COUNT FROM logs WHERE event='tracking.event_mapping.validation_failed' | Hebdo |
| **Temps moyen entre create et activate** | < 1h (workflow rapide) | AVG(activated_at - created_at) | Mensuel |

## KPIs techniques

| Indicateur | SLO | Mesure | Action si dépassé |
|---|---|---|---|
| `/api/admin/tracking/events/mappings` p95 | < 150ms | Server logs | Investiguer DB / N+1 |
| `/api/admin/tracking/events/mappings/[id]` p95 | < 100ms | Server logs | Investiguer JSONB size |
| `resolveEventMapping` p99 | < 5ms | Logs cache | Augmenter TTL ou pre-warm |
| Cache miss rate | < 5% | Logs | Investiguer invalidations excessives |
| LCP page admin | < 200ms | Lighthouse CI | Optimiser composants client |
| Build size addition | < 30 KB gzipped | `pnpm build --stats` | Code splitting / lazy load |

## Logs structurés

Chaque action admin émet un log JSONL :
```json
{
  "ts": "2026-05-13T...",
  "level": "info",
  "event": "tracking.event_mapping.activate",
  "actor_id": "u_xxx",
  "version_id": "emv_yyy",
  "version_name": "v3 — édition Sara",
  "duration_ms": 23,
  "meta": { "archived_id": "emv_zzz" }
}
```

Events à logger :
- `tracking.event_mapping.create`
- `tracking.event_mapping.edit`
- `tracking.event_mapping.activate`
- `tracking.event_mapping.archive`
- `tracking.event_mapping.delete`
- `tracking.event_mapping.restore`
- `tracking.event_mapping.reset_to_default`
- `tracking.event_mapping.export_gtm` (avec sha256 dans meta)
- `tracking.event_mapping.test_event` (avec eventName)
- `tracking.event_mapping.validation_failed` (warn)
- `tracking.event_mapping.cache_hit` (debug only — désactivable)
- `tracking.event_mapping.cache_miss`

## Alerts

| Trigger | Sévérité | Action |
|---|---|---|
| 0 mapping_versions actif depuis 5 min | P0 | Page on-call, fallback resolver au code |
| `cache_miss_rate` > 30% sur 1h | P1 | Investiguer, peut indiquer activate trop fréquent |
| `validation_failed` > 20/heure | P2 | Email admin (probable user struggling) |
| Export GTM p95 > 2s | P3 | Investiguer perf |

## Dashboard suggéré (admin natif)

Section dans `/admin/tracking/events/mappings` (ou onglet séparé) :

```
┌──────────────────────────────────────────────────────────┐
│ Insights mappings (30 derniers jours)                   │
├──────────────────────────────────────────────────────────┤
│ Versions créées : 4                                       │
│ Activations    : 3                                        │
│ Exports GTM    : 2                                        │
│ Reset default  : 0                                        │
│                                                            │
│ Cache hit rate  : 98.4%   ✅                              │
│ Validation fail : 1       ✅                              │
│                                                            │
│ Top events dispatched aujourd'hui :                       │
│   purchase    : 47 dispatches × 6 providers = 282        │
│   form_start  : 320 dispatches × 1 provider = 320        │
│   ...                                                      │
└──────────────────────────────────────────────────────────┘
```

(V2 — pas indispensable V1)
