# Runbook — Pipeline CI

## Architecture cible

```
PR opened
   │
   ▼
┌──────────────────────────────────────┐
│  GitHub Actions — main workflow         │
└──────────────────────────────────────┘
   │
   ├─► [job: lint]         pnpm lint    (~30s)
   ├─► [job: type-check]   pnpm typecheck (~1min)
   ├─► [job: unit-int]     pnpm test:unit + test:int  (~2 min)
   ├─► [job: components]   pnpm test:components       (~3 min)
   ├─► [job: e2e-smoke]    pnpm test:e2e:smoke        (~5 min)
   ├─► [job: a11y]         pnpm test:a11y critical    (~3 min)
   └─► [job: bundle-size]  bundle-analyzer            (~1 min)

   Wait all green ▼

   PR mergeable ✅

   On main push ▼

┌──────────────────────────────────────┐
│  GitHub Actions — release workflow      │
└──────────────────────────────────────┘
   ├─► [job: e2e-full]     pnpm test:e2e             (~20 min)
   ├─► [job: visual]       playwright visual         (~5 min)
   ├─► [job: lighthouse]   lighthouse-ci             (~3 min)
   └─► [job: load]         k6 cloud                  (~15 min, hebdo only)
```

## Fichier `.github/workflows/test.yml`

```yaml
name: Tests
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9.15.9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  unit-int:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env: { POSTGRES_PASSWORD: test, POSTGRES_USER: test, POSTGRES_DB: femiglow_test }
        ports: ['5432:5432']
        options: --health-cmd pg_isready
      redis:
        image: redis:7
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9.15.9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:unit -- --coverage
      - run: pnpm test:int -- --coverage
      - uses: codecov/codecov-action@v4
        with: { token: ${{ secrets.CODECOV_TOKEN }}, fail_ci_if_error: true }

  components:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9.15.9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:components -- --coverage
      - uses: codecov/codecov-action@v4
        with: { token: ${{ secrets.CODECOV_TOKEN }}, flags: components }

  e2e-smoke:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        # ... idem
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
        with: { version: 9.15.9 }
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm db:migrate-safe
      - run: pnpm seed:test  # script seed initial DB
      - run: pnpm test:e2e:smoke
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-traces
          path: apps/web/test-results/

  a11y:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # ... idem setup
      - run: pnpm test:a11y -- --reporter json --outputFile a11y-report.json
      - run: node scripts/check-a11y-critical.mjs a11y-report.json

  bundle-size:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      # ... idem setup
      - run: pnpm build
      - run: node scripts/check-bundle-size.mjs apps/web/.next/analyze/client.html
```

## Workflow release (`.github/workflows/release.yml`)

```yaml
name: Release tests
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *'  # 02:00 UTC daily for e2e-full
    - cron: '0 3 * * 0'  # 03:00 UTC Sunday for load

jobs:
  e2e-full:
    runs-on: ubuntu-latest-4-cores
    timeout-minutes: 30
    steps:
      # ... setup
      - run: pnpm test:e2e
      - uses: actions/upload-artifact@v4
        with: { name: playwright-html-report, path: apps/web/playwright-report/ }

  visual:
    runs-on: ubuntu-latest
    steps:
      # ... setup
      - run: pnpm test:visual

  lighthouse:
    runs-on: ubuntu-latest
    steps:
      # ... setup + build
      - run: pnpm exec lhci autorun
        env: { LHCI_GITHUB_APP_TOKEN: ${{ secrets.LHCI_GITHUB_APP_TOKEN }} }

  load:
    if: github.event.schedule == '0 3 * * 0'
    runs-on: ubuntu-latest
    steps:
      # ... setup + start server
      - run: k6 run apps/web/k6/chat-message.js
```

## Stratégie de cache

| Cache | Quoi | Clé |
|-------|------|-----|
| pnpm | `node_modules` + `.pnpm-store` | hash de `pnpm-lock.yaml` |
| Playwright browsers | `~/.cache/ms-playwright` | version Playwright |
| Vitest cache | `apps/web/.vitest-cache` | hash sources + deps |
| Build Next.js | `apps/web/.next/cache` | hash sources |

## Notifications

```yaml
on-failure:
  - slack: #qa-chat (job, branch, PR URL)
  - github: PR comment avec lien rapport
```

## Politique branch protection

| Branch | Required checks |
|--------|-----------------|
| `main` | lint, type-check, unit-int, components, e2e-smoke, a11y |
| `release/*` | + e2e-full, visual, lighthouse |

Tous les checks bloquants → merge impossible si fail.

## Métriques CI à monitorer

- Durée moyenne pipeline (cible < 20 min)
- Pass rate (cible 100 %)
- Retry rate (cible < 5 %)
- Cost / build (si runner self-hosted)

## Debug d'un échec CI

```bash
# 1. Reproduire localement
gh run download <run-id> -n playwright-traces
pnpm exec playwright show-trace trace.zip

# 2. Si reproductible localement
fix locally, push, retry CI

# 3. Si pas reproductible
flaky probable → quarantaine + ticket
```
