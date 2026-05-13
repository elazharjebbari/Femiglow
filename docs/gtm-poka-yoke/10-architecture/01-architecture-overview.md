# Architecture — vue d'ensemble (3 couches)

## Schéma global

```
┌────────────────────────────────────────────────────────────────────────────┐
│                            FRONT ADMIN FEMIGLOW                            │
│                                                                            │
│   ┌──────────────────────────┐   ┌────────────────────────────────────┐   │
│   │ /admin/tracking/         │   │ /admin/tracking/gtm/sync-status    │   │
│   │  events/mappings         │   │   ─ État live (versions + drift)   │   │
│   │   ─ Export bundle        │   │   ─ Historique pings 30 jours      │   │
│   │   ─ Bouton "Valider"  ─┐ │   │   ─ Liste drifts ouverts/résolus   │   │
│   └──────────────────────│─┘   └──────────▲─────────────────────────────┘   │
│                          │                │                                │
│                          ▼                │ banner global drift critical   │
│   ┌──────────────────────────┐   ┌────────┴───────────────────────────┐   │
│   │ /admin/tracking/gtm/     │   │ Layout admin (TrackingShell)       │   │
│   │  validate-pair           │   │  ─ DriftBanner (server side)       │   │
│   │ (Couche A — wizard)      │   └────────────────────────────────────┘   │
│   │  1. Drop config.json     │                                            │
│   │  2. Drop mapping.json    │                                            │
│   │  3. Diff statique + ✅   │                                            │
│   └──────────────────────────┘                                            │
└────────────────────────────────────────────────────────────────────────────┘
                                                          ▲
                                                          │ POST sentinel ping
                                                          │ (premier pageview)
                                                          │
┌──────────────────────────────────────────────────────────┴─────────────────┐
│                            BACKEND FEMIGLOW                                │
│                                                                            │
│   ┌────────────────────────────────────────────────────────────────────┐   │
│   │ /api/track/sentinel               PUBLIC, no-auth (rate-limited)   │   │
│   │   POST { mapping_v, config_v, bundle_id, container_id, ts, ua }    │   │
│   │   → Persiste dans gtm_sentinel_pings + recompute drift             │   │
│   └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│   ┌────────────────────────────────────────────────────────────────────┐   │
│   │ /api/admin/tracking/gtm/sync-status   GET (admin)                  │   │
│   │   → renvoie { activeVersions, lastPing, drifts, history }          │   │
│   └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│   ┌────────────────────────────────────────────────────────────────────┐   │
│   │ /api/admin/tracking/gtm/validate-pair  POST (admin)                │   │
│   │   body: { configJson, mappingJson }                                │   │
│   │   → renvoie diff { ok, errors[], warnings[], recommendations[] }   │   │
│   └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
│   ┌────────────────────────────────────────────────────────────────────┐   │
│   │ lib/tracking/gtm/                                                  │   │
│   │   ─ bundle-id.ts           — calcul hash partagé                   │   │
│   │   ─ drift-detector.ts      — règles drift critical / warning      │   │
│   │   ─ pair-validator.ts      — diff config × mapping                 │   │
│   │   ─ sentinel-aggregator.ts — agrégation pings → status             │   │
│   └────────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────────┘
                                                          ▲
                                                          │
                                                          │ 1 ping / session
                                                          │
┌──────────────────────────────────────────────────────────┴─────────────────┐
│                              CONTAINER GTM                                 │
│                                                                            │
│   ┌────────────────────┐   ┌──────────────────────────────────────────┐   │
│   │ Config principale  │   │ Tag custom HTML "FG Sentinel Ping"       │   │
│   │  (config-v4.json)  │   │   ─ Fired on First Pageview              │   │
│   │   ─ Tags Meta/GA4  │──▶│   ─ Lit {{FG Bundle Id}} + versions      │   │
│   │   ─ Triggers       │   │   ─ POST → /api/track/sentinel           │   │
│   │   ─ Variables      │   └──────────────────────────────────────────┘   │
│   │   ─ Var FG Bundle  │                                                  │
│   │     Id (constante) │   ┌──────────────────────────────────────────┐   │
│   │   ─ Var FG Config  │   │ Tag custom HTML "FG Manifest Check"      │   │
│   │     Version        │   │  (Couche C, gratuit)                     │   │
│   │   ─ Var FG Mapping │   │   ─ Fired on First Pageview              │   │
│   │     Required Conf  │   │   ─ Compare {{FG Bundle Id (config)}}    │   │
│   └────────────────────┘   │                vs {{FG Bundle Id (map)}} │   │
│   ┌────────────────────┐   │   ─ Si mismatch → dataLayer.push warning │   │
│   │ Mapping            │──▶│     + envoi sentinel avec flag mismatch  │   │
│   │  (mapping-v17.json)│   └──────────────────────────────────────────┘   │
│   │   ─ Var FG Bundle  │                                                  │
│   │     Id (constante) │                                                  │
│   │   ─ Var FG Mapping │                                                  │
│   │     Version        │                                                  │
│   └────────────────────┘                                                  │
└────────────────────────────────────────────────────────────────────────────┘
```

## Les 3 couches en détail

### Couche A — Prévention pré-import

- Page `/admin/tracking/gtm/validate-pair`
- Wizard 3 étapes : upload config, upload mapping, voir diff
- Validations couvertes :
  - **Bundle ID match** : les 2 fichiers déclarent le même `bundleId`
  - **Events couverts** : tous les events listés dans la config ont un mapping côté mapping (et vice-versa)
  - **Variables résolvables** : chaque `{{FG Xxx}}` du mapping existe côté config
  - **Versions compatibles** : `mapping.requiredConfigVersion` ≤ `config.version`
  - **Container ID match** (si déclaré) : les 2 fichiers ciblent le même `containerId`
- Sortie : verdict OK/KO avec liste actionnable des corrections

### Couche B — Détection runtime continue

- Sentinel ping POST `/api/track/sentinel` au premier pageview d'une session.
- Backend persiste, recalcule l'état drift (`ok`/`warning`/`critical`) et expose via `/api/admin/tracking/gtm/sync-status`.
- Page admin `/admin/tracking/gtm/sync-status` polls toutes les 30s.
- Banner global drift critical injecté en SSR via `TrackingShell`.
- Email digest 1x/jour si drift `warning`, immédiat si drift `critical`.

### Couche C — Filet de sécurité bundleId

- Au moment de l'export, on calcule `bundleId = SHA-256(events × mapping_v × config_v)[0..12]`.
- Cette constante est injectée comme variable GTM `FG Bundle Id` dans **les 2 fichiers**.
- Si un seul fichier est importé, l'autre variable est `undefined` côté GTM.
- Le tag "FG Manifest Check" (custom HTML) compare les 2 ; si mismatch → sentinel envoyé avec flag.

## Dépendances et invariants

| Invariant | Garant |
|---|---|
| Un ping = un Container GTM unique (via `containerId`) | Frontend GTM tag |
| Drift detection est idempotente (rejouer les pings = même état) | `drift-detector.ts` |
| Aucun PII dans les pings | Validateur Zod côté API |
| Pings > 90j supprimés automatiquement | Cron `nightly-cleanup` |
| Sync status reste lisible même DB down (fallback gracieux) | Service `gtm-sync-service` |
