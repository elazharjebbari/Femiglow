# Runbook — Monitoring coverage

## Sources de données

| Source | Données | Fréquence |
|--------|---------|-----------|
| Codecov | Coverage line/branch/function par fichier | À chaque CI |
| GitHub Actions metrics | Pass rate, durée, retry rate | À chaque CI |
| Vitest reporter JSON | Performance par spec | À chaque CI |
| Playwright HTML report | Pass/fail/duration E2E | À chaque CI |
| Lighthouse CI | Scores a11y/perf/seo | Sur main + release |

## Métriques quotidiennes (alerts auto)

```yaml
# scripts/coverage-monitor.mjs (cron quotidien)
ALERTS:
  - coverage_global_drop:
      condition: yesterday > today + 1%
      severity: WARN
      channel: #qa-chat
  - coverage_critical_below:
      condition: orchestrator < 95% OR intent < 95%
      severity: CRITICAL
      channel: #qa-chat + tech-lead DM
  - flaky_count:
      condition: count(@flaky-quarantine) > 2% of total specs
      severity: WARN
      channel: #qa-chat
  - ci_duration:
      condition: 7day avg > 25 min
      severity: WARN
      channel: #qa-chat
```

## Dashboard recommandé

Codecov + GitHub Actions metrics + Grafana custom.

### Graph 1 — Coverage trend (90 days)

```
Coverage %
  ▲
95├──────────/──\─────────── critical (orchestrator, intent, charter)
  │         ╱    ╲
  │        ╱      ╲___
85├──────╱           ────── moyen global
  │   __╱
  │__╱
75├───────────────────────── components (cible)
  │
  ├────────────────────────►
  Day -90    -60    -30    Now
```

### Graph 2 — Specs slowest top-10 (par couche)

| Spec | Couche | Durée P95 | Trend 7d |
|------|--------|-----------|----------|
| BS04-panne-provider.spec.ts | E2E | 32 s | ↑ +5 s |
| chat-admin-faq-publish.spec.ts | E2E | 28 s | → |
| ... | | | |

### Graph 3 — Quarantine list

| Spec | Quarantine since | Owner | Deadline |
|------|------------------|-------|----------|
| chat-streaming.spec.ts | 2026-05-15 | @yasmine | 2026-05-29 |
| ... | | | |

Plus de 5 specs en quarantaine simultanées → escalade tech-lead.

## Commandes manuelles

### Voir coverage local

```bash
pnpm test:coverage
open apps/web/coverage/index.html
```

### Coverage par fichier (CLI)

```bash
pnpm exec vitest run --coverage --reporter json
node scripts/coverage-by-file.mjs apps/web/coverage/coverage-final.json
```

### Trend coverage (codecov CLI)

```bash
codecov-cli get-coverage --branch main --since "30 days ago" --format json
```

### Spec slowest top-10

```bash
pnpm test --reporter json --outputFile test-results.json
jq '.testResults | map(.testResults | .[]) | sort_by(-.duration) | .[0:10] | .[] | {name: .fullName, duration: .duration}' test-results.json
```

### Flaky detection

```bash
node scripts/detect-flaky.mjs --runs 100 --since "7 days ago"
```

## Politique d'évolution des gates

Une fois la batterie stable (≥ 3 mois consistent green) :
- Augmenter seuils coverage : +1 % par trimestre jusqu'à 95 % global
- Ajouter gates plus stricts (branch coverage par fichier, fonction)
- Réduire tolérance flaky → 0 % strict

## Tableau de bord opérateur

Affiché en background office (TV) :

```
┌─────────────────────────────────────────────────┐
│  CHAT QA DASHBOARD                                │
│                                                   │
│  Coverage global   :  88,5 %  ✅                 │
│  Coverage P0       :  96,2 %  ✅                 │
│  Pass rate (24h)   : 100 %    ✅                 │
│  Flaky in quarantine: 1 spec   🟡                │
│  CI duration avg   : 17 min    ✅                │
│  A11y critical     : 0         ✅                │
│  Last incident     : 2026-05-12 (13 days ago)    │
└─────────────────────────────────────────────────┘
```

## Réagir aux alerts

| Alert | Action immédiate |
|-------|------------------|
| Coverage drop 1 % | Voir lcov diff, identifier lignes non couvertes |
| Coverage drop 5 % | Bloquer merge, investigate cause |
| Flaky > 2 % | Stand-up dédié + plan |
| CI > 25 min | Profiler specs lentes |
| A11y critical apparaît | Ticket immédiat, bloquer release |
| Bundle size > +5 % | Bundle analyzer, identifier le diff |
