# 02 — Vision architecture

## Principe directeur

> **L'attribution doit être résolue côté SERVEUR à l'ingest et stockée de manière atomique. Le client est une source d'indices (cookies, referrer), pas la source de vérité.**

## Flow cible

```
[1] Visiteur arrive /?utm_source=meta&fbclid=ABC
[2] middleware.ts (A2)
    • Capture 5 UTM + 8 click IDs en cookies _fg_*
    • Reconstruit _fbc Meta = "fb.1.<ts>.ABC"
    • Set cookie _fg_landing (90j) avec snapshot first-touch
[3] AttributionCaptureBridge (existant)
    • detectChannel + mergeTouch + upsert visitor_attribution DB
[4] TrackingClient.emit() (existant)
    • Annote entry.attribution = { channel, utm, ... }
    • POST /api/track
[5] /api/track route (A4)
    • Extrait requestSignals (UTM, click IDs, fbp, fbc, referrer, geo)
    • enrichEvent({ anonymousId, clientHint: event.attribution, requestSignals })
       → { trafficSource, trafficMedium, utm, referrer, fbp, fbc, classification }
    • logEvent({ ...event, ...enriched }) — INSERT atomique
[6] /admin/analytics (A6)
    • SELECT traffic_source, COUNT(*) FROM tracking_events_log
      GROUP BY traffic_source
    • BUCKET_LABELS du taxonomy module pour l'affichage
```

## Responsabilités par module

| Module | Responsabilité |
|---|---|
| `lib/tracking/taxonomy.ts` | **Source de vérité unique** de `TrafficBucket` + `classifyTraffic` + `BUCKET_LABELS` |
| `middleware.ts` | Capture UTM + click IDs au premier hit, set cookies persistants |
| `lib/tracking/server/request-signals.ts` | Extraire les signaux depuis `NextRequest` + cookies |
| `lib/tracking/server/enrich-event.ts` | **Résolution authoritative** côté serveur (DB > request > client hint) |
| `lib/tracking/attribution/repository.ts` | findAttributionByVisitor (existant, OK) |
| `lib/tracking/attribution/strategy.ts` | applyStrategy(touch, 'last_paid_touch') (existant, OK) |
| `lib/db/queries/tracking/events-log.ts` | `logEvent()` étendu — persiste toutes les colonnes attribution |
| `app/api/track/route.ts` | Glue : signals + enrich + logEvent |
| `app/admin/analytics/...` | Reporting authoritative, plus de fallback classifyTraffic |

## Diagramme dépendances

```
                          ┌──────────────┐
                          │  taxonomy.ts │  ← source de vérité unique
                          │  (canaux)    │
                          └──────┬───────┘
                                 │
            ┌────────────────────┼────────────────────┐
            │                    │                    │
            ▼                    ▼                    ▼
   ┌──────────────┐     ┌────────────────┐    ┌──────────────────┐
   │ middleware   │     │ enrich-event   │    │ OverviewTopSources│
   │ (acquisition)│     │ (résolution)   │    │ (reporting)       │
   └──────────────┘     └────────┬───────┘    └──────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │ logEvent (insert)│
                        └──────────────────┘
```

## Garanties

- **Pas de breaking change** sur API externe `/api/track`
- **Backward-compat** : si flag `ATTRIBUTION_V2=false`, comportement identique à aujourd'hui
- **Atomique** : `trafficSource` est écrit dans le même INSERT que l'event (pas de race condition)
- **Authoritative** : reporting lit la valeur DB, plus de re-calcul à la query time
- **Backfillable** : `visitor_attribution` permet de rattraper les events NULL existants
