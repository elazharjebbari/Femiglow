# 80.6 — Monitoring & alertes

## Métriques techniques

### Côté backend (Sentry / OpenTelemetry)

| Métrique | Source | Seuil alerte |
|---|---|---|
| API `/api/legal/*` p95 latency | OTel | > 500ms |
| API `/api/admin/legal/*` p95 latency | OTel | > 1000ms |
| API error rate `/api/legal/*` | Sentry | > 1% |
| API error rate `/api/admin/legal/*` | Sentry | > 2% |
| `renderLegalMarkdown` p95 duration | OTel | > 200ms |
| Cron `legal-link-health` failure | Sentry | toute erreur |
| Git sync `legal.git.failed` | DB | > 3/jour |

### Côté frontend (PostHog / Sentry)

| Métrique | Source | Seuil alerte |
|---|---|---|
| Public page LCP (legal) | PostHog | > 2.5s |
| Public page error rate | Sentry | > 0.5% |
| Cookie banner display rate | PostHog | < 95% (devrait être 100% nouveaux visiteurs) |
| Footer legal link click rate | PostHog | (baseline pour anomaly detection) |

## Métriques métier

### Compliance health

| Métrique | Source | Seuil alerte |
|---|---|---|
| Pages legal `published` | DB | < 5 (devrait être 9 minimum) |
| Variables obligatoires non-remplies | DB | > 0 |
| Liens cassés en footer | `legal_link_health_snapshot` | > 0 |
| Pages avec variables manquantes | DB query | > 0 |
| Cron health snapshot age | DB | > 25h (job daily) |
| Pages avec dernière publication > 1 an | DB | > 0 |
| Audit events `legal.git.failed` (7j) | DB | > 5 |

### Usage admin

| Métrique | Source | Seuil alerte |
|---|---|---|
| Auto-save échecs / heure | Sentry | > 10 |
| Conflicts d'édition (409) | Sentry | > 5 / jour |
| Tentatives publish rejetées (missing vars) | Sentry | > 3 / jour |

## Dashboards

### Dashboard 1 — Legal Health (admin)

`/admin/legal/health` (built-in) :

```
┌─────────────────────────────────────────────┐
│ Legal Health · Dernière analyse il y a 2h   │
│                                             │
│ Pages publiées    9 / 9   ✓                 │
│ Variables OK      21 / 21  ✓                │
│ Liens footer      18 / 18  ✓                │
│ Cron last run     OK (il y a 2h)           │
│ Git sync          OK (il y a 5 min)         │
│                                             │
│ ⚠ Alertes actives : 0                        │
│ ✓ Tous les indicateurs au vert.             │
└─────────────────────────────────────────────┘
```

### Dashboard 2 — Sentry custom dashboard

Bookmark : `https://sentry.io/organizations/femiglow/dashboards/legal-pages`

Widgets :
- API latency p50/p95/p99 par endpoint legal
- Error rate par endpoint
- Top errors (avec stack trace)
- Deploys avec marqueurs

### Dashboard 3 — PostHog

Bookmark : `https://us.posthog.com/insights/legal-pages`

Widgets :
- Visiteurs uniques sur pages /legal/*
- Top pages consultées (helps content prioritization)
- Bounce rate par page légale
- Conversion : cookie banner accept vs reject vs personnalize
- Click-through rate des liens footer légaux

## Alertes Slack

### Channel `#alerts-legal`

Configuré dans Sentry :

```yaml
# sentry-config.yaml
alerts:
  - name: "Legal API error rate spike"
    metric: "issue:event.api.error.legal.*"
    condition: "rate > 1% over 5min"
    severity: high
    channel: "#alerts-legal"

  - name: "Public legal page 500"
    metric: "issue:exception in /app/legal/*"
    condition: "any"
    severity: critical
    channel: "#alerts-legal"

  - name: "Cron health failed"
    metric: "issue:cron.legal-link-health.failed"
    condition: "any"
    severity: medium
    channel: "#alerts-legal"

  - name: "Cookie banner display rate low"
    metric: "posthog:cookie_banner_shown"
    condition: "rate < 95% over 1h"
    severity: critical
    channel: "#alerts-legal"
```

### Channel `#legal-updates` (information)

Notifications informationnelles :
- Publication d'une page (auto)
- Modification d'une variable (auto)
- Archivage d'une page (auto)

Hook dans `publishPage` :
```typescript
await postToSlack('#legal-updates', {
  text: `📜 Page **${page.title}** publiée — v${page.version} par ${adminName}`,
});
```

## Healthcheck endpoint

`GET /api/health/legal`

```typescript
export async function GET() {
  const checks = {
    db_connected: await checkDb(),
    pages_count: await countPublished(),
    cron_last_run_age_minutes: await cronLastRunAge(),
    broken_links: await countBrokenLinks(),
  };

  const isHealthy =
    checks.db_connected &&
    checks.pages_count >= 5 &&
    checks.cron_last_run_age_minutes < 1500 && // 25h
    checks.broken_links === 0;

  return Response.json(checks, { status: isHealthy ? 200 : 503 });
}
```

Pingé toutes les 5 min par Uptime Robot / Better Stack.

## Tests synthétiques

### Quotidien (Better Stack / Checkly)

- `GET /legal/cgv` → 200 + contient "Conditions Générales"
- `GET /legal/mentions-legales` → 200
- `GET /sitemap.xml` → 200 + ne contient PAS `/legal/cgv`
- `GET /api/legal/placements/footer-main` → 200 + ≥ 5 items

### Hebdo (run e2e:smoke en CI scheduled)

```yaml
on:
  schedule:
    - cron: '0 6 * * *'  # tous les jours 6h
jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install
      - run: pnpm test:e2e:smoke -- --grep legal
```

## SLO / SLI

### SLO Public

- Disponibilité `/legal/*` : **99.95%** mensuel
- Latence p95 `/legal/cgv` : **< 1s**
- Erreur rate public : **< 0.5%**

### SLO Admin

- Disponibilité `/admin/legal/*` : **99.5%** mensuel
- Latence p95 éditeur : **< 2s**
- Sauvegarde auto-save success rate : **> 99.9%**

### Error budget

Si erreur rate > seuil 2 jours d'affilée : freeze des nouvelles features, focus stabilité.

## Coûts de monitoring

- Sentry : déjà inclus dans plan FemiGlow
- PostHog : déjà inclus
- Better Stack : ~10 USD/mois (optionnel)
- Total additionnel : ~10 USD / mois
