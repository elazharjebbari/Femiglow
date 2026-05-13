# Diagrammes de flux

## Flow 1 — Export bundle depuis l'admin

```
Admin (Sara)
  │
  │ 1. Édite mapping v17, click "Exporter pour GTM"
  ▼
┌─────────────────────────────────────────────────┐
│ /api/admin/tracking/events/mappings/<id>/export │
│                                                 │
│ 1. Charge mapping v17                           │
│ 2. Charge config courante (v4)                  │
│ 3. computeBundleId({mapping, config, events})   │
│ 4. Injecte bundleId dans:                       │
│    - config.variables[FG Bundle Id]             │
│    - mapping.manifest.bundleId                  │
│ 5. Renvoie ZIP { config-v4.json, mapping-v17.json }
└─────────────────────────────────────────────────┘
  │
  ▼
2 fichiers téléchargés
```

## Flow 2 — Couche A : Validation pré-import

```
Admin
  │
  │ 1. Va sur /admin/tracking/gtm/validate-pair
  ▼
┌──────────────────────────────────────────────────┐
│ Wizard step 1: Drop config.json                  │
│ Wizard step 2: Drop mapping.json                 │
│ Wizard step 3: Click "Valider"                   │
└──────────────────────────────────────────────────┘
  │
  │ POST /api/admin/tracking/gtm/validate-pair
  │ body: { configJson, mappingJson }
  ▼
┌──────────────────────────────────────────────────┐
│ pairValidator.validate(config, mapping):         │
│   - bundleId match?      ──┐                     │
│   - events covered?        ├── erreurs[] / warns │
│   - vars resolvable?       │                     │
│   - versions compat?     ──┘                     │
└──────────────────────────────────────────────────┘
  │
  ▼
Affiche diff dans l'UI:
  ┌──────────────────────────────────────────────┐
  │ ✅ Bundle ID cohérent (a7c4f2e9b81d)         │
  │ ✅ 12 events couverts des 2 côtés            │
  │ ⚠ Variable FG Locale absente côté config     │
  │    → ajouter dans GTM avant import           │
  │ ───────────────────────────────────────────  │
  │ VERDICT: ⚠ 1 warning, importable mais risqué │
  │ Recommandation: importer config d'abord      │
  └──────────────────────────────────────────────┘
```

## Flow 3 — Couche B : Sentinel ping runtime

```
User end visite femiglow.ma
  │
  │ 1. Premier pageview → GTM se charge
  ▼
┌──────────────────────────────────────────────────┐
│ Tag GTM "FG Sentinel Ping"                       │
│ Trigger: All Pages (once per session)            │
│                                                  │
│ <script>                                         │
│   navigator.sendBeacon(                          │
│     '/api/track/sentinel',                       │
│     JSON.stringify({                             │
│       bundleId: {{FG Bundle Id}},                │
│       mappingVersion: {{FG Mapping Version}},    │
│       configVersion: {{FG Config Version}},      │
│       containerId: {{Container ID}},             │
│       gtmId: {{GTM Container ID}},               │
│       sentAt: new Date().toISOString(),          │
│     })                                           │
│   );                                             │
│ </script>                                        │
└──────────────────────────────────────────────────┘
  │
  ▼
POST /api/track/sentinel  (anonyme, rate-limited)
  │
  ▼
┌──────────────────────────────────────────────────┐
│ Backend                                          │
│ 1. Zod validate payload                          │
│ 2. INSERT INTO gtm_sentinel_pings                │
│ 3. driftDetector.recompute(ping):                │
│    - charge active mapping (v17) + config (v4)   │
│    - compare avec ping.{mappingV, configV, bundle│
│    - classifie: ok | warning | critical          │
│ 4. UPDATE gtm_drift_state SET status, since      │
└──────────────────────────────────────────────────┘
```

## Flow 4 — Affichage sync-status (admin)

```
Admin ouvre /admin/tracking/gtm/sync-status
  │
  ▼
Page server-side:
  │
  │ GET /api/admin/tracking/gtm/sync-status (interne)
  ▼
┌──────────────────────────────────────────────────┐
│ {                                                │
│   activeAdmin: {                                 │
│     mappingVersion: "v17",                       │
│     configVersion: "v4",                         │
│     bundleId: "a7c4f2e9b81d"                     │
│   },                                             │
│   lastPing: {                                    │
│     receivedAt: "2026-05-13T19:32:01Z",          │
│     mappingVersion: "v17",                       │
│     configVersion: "v4",                         │
│     bundleId: "a7c4f2e9b81d"                     │
│   },                                             │
│   drift: { status: "ok", since: null },          │
│   silence: { ok: true, lastPingAgo: "12min" },   │
│   history: [...30 derniers jours]                │
│ }                                                │
└──────────────────────────────────────────────────┘
  │
  ▼
React renders SyncStatusView
  - Cards (Mapping / Config / Bundle)
  - Timeline 30 jours
  - Liste drifts ouverts/résolus
  - Auto-refresh 30s
```

## Flow 5 — Banner global drift

```
Admin charge n'importe quelle page /admin/*
  │
  ▼
TrackingShell (server component)
  │
  │ getDriftStatusForBanner() — léger, cache 60s
  ▼
Si drift.status === 'critical':
  inject <DriftBanner severity="critical" message="..." />
Si drift.status === 'warning':
  inject <DriftBanner severity="warning" />
Sinon: rien
```
