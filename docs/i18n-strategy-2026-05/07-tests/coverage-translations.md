# Coverage translations — Stratégie de coverage des clés i18n

> Comment mesurer, monitorer et garantir la couverture des traductions FemiGlow.
> Endpoint `GET /api/i18n/coverage`, dashboard admin, gates CI, alerts, reporting.

## 1. Pourquoi mesurer la coverage

Sans mesure, on ne peut pas garantir :
- Que la locale AR est utilisable en prod (95% de clés traduites min)
- Qu'on ne déploie pas une régression où 30 clés sont passées en `[key.brut]`
- Qu'une nouvelle locale (ES, IT) est prête à être activée
- Que les translateurs sont productifs (vélocité)

**Coverage = nombre de clés `(key, locale)` ayant une valeur valide / nombre total de clés actives.**

## 2. Définition formelle

### 2.1 Coverage par locale

```
coverage(locale) = COUNT(values WHERE locale = X AND value IS NOT NULL AND value != '')
                   / COUNT(keys WHERE active = true)
```

Exemple :
- Total clés actives : 542
- AR : 423 traduites → 78%
- EN : 245 traduites → 45%
- FR : 542 traduites → 100% (source of truth)

### 2.2 Coverage par namespace

```
coverage(locale, namespace) = COUNT(values WHERE locale = X AND key LIKE 'NS.%')
                              / COUNT(keys WHERE active = true AND key LIKE 'NS.%')
```

Pour identifier les namespaces les moins traduits.

### 2.3 Coverage "reviewed"

Une valeur traduite mais non reviewée par un humain reste suspecte (IA-traduit, par exemple).

```
reviewed_coverage(locale) = COUNT(values WHERE locale = X AND reviewed = true AND value IS NOT NULL)
                            / COUNT(keys WHERE active = true)
```

→ Permet de distinguer "automatique" vs "validé humain".

## 3. Endpoint `GET /api/i18n/coverage`

Spec dans [`../03-backend/api-routes.md`](../03-backend/api-routes.md).

### 3.1 Payload référence

```json
{
  "data": {
    "locales": [
      { "code": "fr", "total": 542, "translated": 542, "percentage": 100, "lastReviewedAt": "2026-05-27T10:00:00Z" },
      { "code": "ar", "total": 542, "translated": 423, "percentage": 78, "lastReviewedAt": "2026-05-15T10:00:00Z" },
      { "code": "en", "total": 542, "translated": 245, "percentage": 45, "lastReviewedAt": "2026-05-10T08:30:00Z" }
    ],
    "byNamespace": [
      { "namespace": "common", "fr": 100, "ar": 100, "en": 95 },
      { "namespace": "navigation", "fr": 100, "ar": 100, "en": 100 },
      { "namespace": "marketing", "fr": 100, "ar": 80, "en": 50 },
      { "namespace": "wizard", "fr": 100, "ar": 95, "en": 60 },
      { "namespace": "legal", "fr": 100, "ar": 30, "en": 20 },
      { "namespace": "errors", "fr": 100, "ar": 90, "en": 70 }
    ],
    "missingKeys": [
      { "key": "marketing.hero.cta_v2", "locales": ["ar", "en"] },
      { "key": "legal.cgv.section_5.body", "locales": ["en"] }
    ]
  },
  "meta": { "timestamp": "2026-05-27T15:00:00Z", "version": "v1" }
}
```

### 3.2 Tests intégration

Cf. `integration-msw.md` section 3.1.

## 4. Dashboard admin

### 4.1 Page `/admin/i18n/coverage`

```tsx
// src/app/[locale]/admin/i18n/coverage/page.tsx (preview)
import { Suspense } from 'react';
import { CoverageDashboard } from '@/components/admin/i18n/CoverageDashboard';

export const dynamic = 'force-dynamic';

export default function CoveragePage() {
  return (
    <main className="container py-8">
      <h1 className="text-3xl font-display">Coverage i18n</h1>
      <p className="text-rose-700 mt-2">Suivi de la complétude des traductions par locale.</p>
      <Suspense fallback={<div>Chargement...</div>}>
        <CoverageDashboard />
      </Suspense>
    </main>
  );
}
```

### 4.2 Composants UI

| Composant | Description |
|---|---|
| `<CoverageGauge locale="ar" percentage={78} />` | Donut chart par locale |
| `<NamespaceCoverageTable />` | Tableau coverage par namespace |
| `<MissingKeysList />` | Liste clés manquantes avec filtres |
| `<CoverageHistory />` | Graph d'évolution sur 30 jours |
| `<ExportMissingButton locale="ar" />` | Export CSV des manquantes |

### 4.3 Wireframe textuel

```
┌────────────────────────────────────────────────────────────┐
│ Coverage i18n FemiGlow            ⌐ Refresh   📥 Export   │
├────────────────────────────────────────────────────────────┤
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                       │
│  │   FR    │ │   AR    │ │   EN    │                       │
│  │ 100% ✓  │ │  78% ⚠  │ │  45% ⚠  │                       │
│  │ 542/542 │ │ 423/542 │ │ 245/542 │                       │
│  └─────────┘ └─────────┘ └─────────┘                       │
├────────────────────────────────────────────────────────────┤
│  Coverage par namespace                                    │
│                                                            │
│  Namespace      FR        AR        EN                     │
│  common         100% ✓    100% ✓    95% ⚠                  │
│  navigation     100% ✓    100% ✓    100% ✓                 │
│  marketing      100% ✓    80% ⚠     50% ⚠                  │
│  wizard         100% ✓    95% ✓     60% ⚠                  │
│  legal          100% ✓    30% ✗     20% ✗                  │
│  errors         100% ✓    90% ✓     70% ⚠                  │
├────────────────────────────────────────────────────────────┤
│  Clés manquantes (12 visible / 119)                        │
│                                                            │
│  • marketing.hero.cta_v2                  [ar][en]         │
│  • legal.cgv.section_5.body               [en]             │
│  • wizard.shipping.fields.zipcode.help    [ar][en]         │
│  ...                                                       │
│                                                            │
│  [ Filtrer par namespace ▾ ] [ Afficher tout ]             │
└────────────────────────────────────────────────────────────┘
```

## 5. Gates CI

### 5.1 Script de check

```js
// scripts/coverage-translations.mjs
import fs from 'node:fs';

const THRESHOLDS = {
  fr: { min: 100, blocking: true },
  ar: { min: 90, blocking: false, warn: true },
  en: { min: 90, blocking: false, warn: true },
};

const LOCALES = Object.keys(THRESHOLDS);

function collectKeys(obj, prefix = '') {
  if (typeof obj !== 'object' || obj === null) return [];
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) keys.push(...collectKeys(v, path));
    else keys.push(path);
  }
  return keys;
}

const fr = JSON.parse(fs.readFileSync('messages/fr.json', 'utf8'));
const frKeys = new Set(collectKeys(fr));

const results = {};
let failed = false;

for (const loc of LOCALES) {
  const messages = JSON.parse(fs.readFileSync(`messages/${loc}.json`, 'utf8'));
  const locKeys = new Set(collectKeys(messages));
  const translated = [...frKeys].filter(k => locKeys.has(k)).length;
  const percentage = Math.round((translated / frKeys.size) * 100);

  results[loc] = { translated, total: frKeys.size, percentage };

  const threshold = THRESHOLDS[loc];
  const passes = percentage >= threshold.min;

  if (!passes && threshold.blocking) {
    console.error(`✗ ${loc}: ${percentage}% < ${threshold.min}% (BLOCKING)`);
    failed = true;
  } else if (!passes && threshold.warn) {
    console.warn(`⚠ ${loc}: ${percentage}% < ${threshold.min}% (WARN)`);
  } else {
    console.log(`✓ ${loc}: ${percentage}%`);
  }
}

fs.writeFileSync('coverage-translations.json', JSON.stringify(results, null, 2));

if (failed) {
  console.error('\nCoverage gates FAILED. Blocking merge.');
  process.exit(1);
}

console.log('\nCoverage gates PASSED.');
```

### 5.2 GitHub Action

```yaml
# .github/workflows/coverage-translations.yml
name: Coverage translations
on:
  pull_request:
    paths:
      - 'apps/web/messages/**'
  push:
    branches: [main]

jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: node scripts/coverage-translations.mjs
      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const coverage = JSON.parse(fs.readFileSync('coverage-translations.json', 'utf8'));
            let body = '## Coverage translations\n\n';
            body += '| Locale | Translated | Total | % |\n';
            body += '|---|---|---|---|\n';
            for (const [loc, data] of Object.entries(coverage)) {
              const icon = data.percentage === 100 ? '✓' : (data.percentage >= 90 ? '⚠' : '✗');
              body += `| ${loc} ${icon} | ${data.translated} | ${data.total} | ${data.percentage}% |\n`;
            }
            await github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body,
            });
```

### 5.3 Gate matrix

| Locale | Threshold | CI Action |
|---|---|---|
| FR | 100% | Fail merge si < 100% |
| AR | ≥ 90% | Warn (no fail), Slack alert |
| EN | ≥ 90% | Warn (no fail), Slack alert |
| Nouvelle locale (avant enabled=true) | ≥ 95% | Fail enable si < 95% |

## 6. Reporting JSON pour observabilité

### 6.1 Format `coverage-translations.json`

```json
{
  "fr": { "translated": 542, "total": 542, "percentage": 100 },
  "ar": { "translated": 423, "total": 542, "percentage": 78 },
  "en": { "translated": 245, "total": 542, "percentage": 45 }
}
```

### 6.2 Envoi vers Sentry

```ts
// scripts/report-coverage-sentry.mjs
import fs from 'node:fs';
import * as Sentry from '@sentry/node';

Sentry.init({ dsn: process.env.SENTRY_DSN });

const coverage = JSON.parse(fs.readFileSync('coverage-translations.json', 'utf8'));

for (const [loc, data] of Object.entries(coverage)) {
  Sentry.metrics.gauge('i18n.coverage_percentage', data.percentage, {
    tags: { locale: loc },
  });
  Sentry.metrics.gauge('i18n.translated_keys', data.translated, {
    tags: { locale: loc },
  });
}

await Sentry.close(2000);
```

### 6.3 Envoi vers Datadog

```ts
// scripts/report-coverage-datadog.mjs
import fs from 'node:fs';

const coverage = JSON.parse(fs.readFileSync('coverage-translations.json', 'utf8'));
const series = Object.entries(coverage).map(([loc, data]) => ({
  metric: 'femiglow.i18n.coverage',
  points: [[Math.floor(Date.now() / 1000), data.percentage]],
  tags: [`locale:${loc}`, 'env:production'],
}));

const response = await fetch('https://api.datadoghq.com/api/v1/series', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'DD-API-KEY': process.env.DATADOG_API_KEY,
  },
  body: JSON.stringify({ series }),
});

if (!response.ok) {
  console.error('Failed to send to Datadog');
  process.exit(1);
}

console.log('Coverage sent to Datadog');
```

## 7. Alerts

### 7.1 Slack notification sur drop

```ts
// scripts/coverage-alert.mjs
import fs from 'node:fs';

const ALERT_DROP = 5; // % drop trigger alert

const current = JSON.parse(fs.readFileSync('coverage-translations.json', 'utf8'));
const previous = JSON.parse(fs.readFileSync('coverage-translations-prev.json', 'utf8'));

const alerts = [];
for (const [loc, curr] of Object.entries(current)) {
  const prev = previous[loc];
  if (!prev) continue;
  const drop = prev.percentage - curr.percentage;
  if (drop >= ALERT_DROP) {
    alerts.push({ locale: loc, from: prev.percentage, to: curr.percentage, drop });
  }
}

if (alerts.length === 0) {
  console.log('No coverage drop');
  process.exit(0);
}

const message = {
  text: `:warning: i18n coverage drop detected`,
  blocks: [
    {
      type: 'section',
      text: { type: 'mrkdwn', text: '*Coverage i18n FemiGlow — DROP detected*' },
    },
    ...alerts.map(a => ({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `• *${a.locale}*: ${a.from}% → ${a.to}% (drop ${a.drop}%)`,
      },
    })),
    {
      type: 'actions',
      elements: [
        { type: 'button', text: { type: 'plain_text', text: 'View dashboard' }, url: 'https://femiglow.ma/admin/i18n/coverage' },
      ],
    },
  ],
};

await fetch(process.env.SLACK_WEBHOOK_URL, {
  method: 'POST',
  body: JSON.stringify(message),
  headers: { 'Content-Type': 'application/json' },
});
```

### 7.2 Email digest hebdo

```ts
// scripts/coverage-email-digest.mjs
import { Resend } from 'resend';
import fs from 'node:fs';

const resend = new Resend(process.env.RESEND_API_KEY);
const coverage = JSON.parse(fs.readFileSync('coverage-translations.json', 'utf8'));

const html = `
<h1>Coverage i18n — Hebdo</h1>
<table>
  <tr><th>Locale</th><th>Translated</th><th>%</th></tr>
  ${Object.entries(coverage).map(([loc, d]) =>
    `<tr><td>${loc}</td><td>${d.translated}/${d.total}</td><td>${d.percentage}%</td></tr>`
  ).join('')}
</table>
<p><a href="https://femiglow.ma/admin/i18n/coverage">Voir le dashboard</a></p>
`;

await resend.emails.send({
  from: 'noreply@femiglow.ma',
  to: ['founder@femiglow.ma', 'lead@femiglow.ma'],
  subject: 'Coverage i18n FemiGlow — semaine du ' + new Date().toISOString().slice(0, 10),
  html,
});
```

## 8. Cron `/api/cron/coverage-snapshot`

### 8.1 Snapshot quotidien

```ts
// src/app/api/cron/coverage-snapshot/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { i18nCoverageSnapshots } from '@/lib/db/schema';

export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization');
  if (token !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const coverageResponse = await fetch('http://localhost:3000/api/i18n/coverage', {
    headers: { Cookie: `admin_session=${process.env.CRON_ADMIN_SESSION}` },
  });
  const { data } = await coverageResponse.json();

  for (const loc of data.locales) {
    await db.insert(i18nCoverageSnapshots).values({
      locale: loc.code,
      total: loc.total,
      translated: loc.translated,
      percentage: loc.percentage,
      snapshotAt: new Date(),
    });
  }

  return NextResponse.json({ ok: true, snapshotsCreated: data.locales.length });
}
```

### 8.2 Vercel cron

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/coverage-snapshot",
      "schedule": "0 8 * * *"
    }
  ]
}
```

## 9. Dashboard de tendances

### 9.1 Query SQL pour history

```sql
-- src/lib/db/migrations/0XXX-i18n-coverage-snapshots.sql
CREATE TABLE i18n_coverage_snapshots (
  id SERIAL PRIMARY KEY,
  locale VARCHAR(8) NOT NULL,
  total INTEGER NOT NULL,
  translated INTEGER NOT NULL,
  percentage SMALLINT NOT NULL,
  snapshot_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_i18n_coverage_snapshots_locale_date
  ON i18n_coverage_snapshots (locale, snapshot_at DESC);
```

### 9.2 Query tendance 30 jours

```sql
SELECT
  locale,
  DATE_TRUNC('day', snapshot_at) as day,
  AVG(percentage)::INTEGER as percentage
FROM i18n_coverage_snapshots
WHERE snapshot_at >= NOW() - INTERVAL '30 days'
GROUP BY locale, DATE_TRUNC('day', snapshot_at)
ORDER BY day, locale;
```

## 10. Activation d'une nouvelle locale

### 10.1 Gate avant `enabled=true`

```ts
// src/app/api/admin/i18n/locales/route.ts (extrait pour update enable)
if (parsed.action === 'update' && parsed.enabled === true) {
  const coverageResponse = await fetch('http://localhost:3000/api/i18n/coverage', {
    headers: { Cookie: req.headers.get('cookie') ?? '' },
  });
  const { data } = await coverageResponse.json();
  const localeData = data.locales.find((l: { code: string }) => l.code === parsed.code);

  if (!localeData || localeData.percentage < 95) {
    throw new ApiError(
      'CONFLICT',
      `Cannot enable locale '${parsed.code}': coverage ${localeData?.percentage ?? 0}% < 95%`,
    );
  }
}
```

### 10.2 Workflow d'activation

1. Ajouter la locale (`POST /api/admin/i18n/locales` avec `enabled=false`)
2. Importer les traductions (CSV/JSON)
3. Vérifier coverage `/admin/i18n/coverage` → doit atteindre 95% min
4. Reviewer humain valide (set `reviewed=true` sur clés critiques)
5. Activer la locale (`enabled=true`)
6. Visual test baseline créé via `pnpm test:visual -- --project=chromium-<locale> --update-snapshots`
7. Smoke test E2E

## 11. Stratégie de priorisation des traductions manquantes

### 11.1 Priorité par namespace

| Namespace | Priorité | Justification |
|---|---|---|
| `errors` | P0 | Visible si bug, doit être traduit |
| `common` | P0 | Utilisé partout |
| `navigation` | P0 | Sur toutes les pages |
| `marketing` | P1 | Pages publiques primaires |
| `wizard` | P1 | Conversion critique |
| `seo` | P1 | Metadata, indexation |
| `legal` | P2 | Lecture obligatoire mais moins fréquente |
| `admin` | P3 | Interne, FR suffit pour V1 |
| `email` | P2 | Transactionnel client |

### 11.2 Filtre dashboard

```tsx
// <MissingKeysList />
const SORT_BY_PRIORITY = ['errors', 'common', 'navigation', 'marketing', 'wizard', 'seo', 'legal', 'email', 'admin'];

function sortMissingByPriority(missing: Array<{ key: string }>): typeof missing {
  return [...missing].sort((a, b) => {
    const nsA = a.key.split('.')[0];
    const nsB = b.key.split('.')[0];
    return SORT_BY_PRIORITY.indexOf(nsA) - SORT_BY_PRIORITY.indexOf(nsB);
  });
}
```

## 12. Anti-patterns

1. **Considérer "value non-null" comme "traduit"** : il faut aussi reviewed = true pour les clés critiques.
2. **Pas exclure les clés inactives** : `active = false` doit être ignoré du total.
3. **Pas distinguer auto-trad vs reviewée** : risque de prod IA non vérifiée.
4. **Threshold à 100% partout** : impossible à maintenir, vise 90% AR/EN.
5. **Alerts sur chaque drop 1%** : noise, viser drop ≥ 5%.
6. **Coverage 1x/mois** : trop tardif, viser quotidien.
7. **Pas snapshot DB** : impossible de retracer historique.
8. **Reporting CSV manuel** : auto via cron + API.

## 13. Commandes

```bash
# Run check local
node scripts/coverage-translations.mjs

# Strict mode
STRICT=1 node scripts/coverage-translations.mjs

# Snapshot DB
node scripts/coverage-snapshot.mjs

# Alert si drop
node scripts/coverage-alert.mjs

# Send to Sentry
node scripts/report-coverage-sentry.mjs

# Send to Datadog
node scripts/report-coverage-datadog.mjs
```

## 14. Checklist coverage translations

- [ ] Endpoint `GET /api/i18n/coverage` testé (cf. integration-msw.md)
- [ ] Page `/admin/i18n/coverage` créée avec dashboard
- [ ] Composant `<CoverageGauge />` par locale
- [ ] Composant `<MissingKeysList />` avec sort by priority
- [ ] Script `scripts/coverage-translations.mjs` créé
- [ ] CI workflow `.github/workflows/coverage-translations.yml`
- [ ] Gate FR=100% bloquant
- [ ] Gate AR≥90% warn + Slack
- [ ] Gate EN≥90% warn + Slack
- [ ] Reporting Sentry actif
- [ ] Reporting Datadog actif (si dispo)
- [ ] Cron `/api/cron/coverage-snapshot` actif (quotidien)
- [ ] Table DB `i18n_coverage_snapshots` créée
- [ ] Slack alert sur drop ≥ 5%
- [ ] Email digest hebdo
- [ ] Pre-merge comment PR avec coverage
- [ ] Gate activation locale ≥ 95% bloquant
