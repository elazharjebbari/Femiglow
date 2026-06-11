# Runbook — Exécution quotidienne

## Pour un dev — Cycle pre-commit

```bash
# 1. Avant tout coding (matin)
pnpm install                              # update deps si lockfile changé
pnpm test:unit -- --run --reporter dot   # smoke sanity check

# 2. Pendant le coding
pnpm test:watch                          # vitest watch en arrière-plan
# (ouvrir un 2e terminal pour pnpm dev si front-end)

# 3. Avant chaque commit
pnpm exec lint-staged                    # lint + format auto
pnpm test:unit                           # full unit + int
pnpm test:components                     # components
# si touché à `app/api/chat/**` :
pnpm test:int

# 4. Avant push
pnpm test:e2e:smoke                      # < 5 min, smoke vital
```

## Pour QA — Routine du matin

```bash
# 1. Pull main + status général
git pull origin main
gh run list --branch main --limit 5      # 5 derniers runs CI

# 2. Coverage du jour
open https://app.codecov.io/gh/<org>/template-femiglow

# 3. Specs en quarantaine
grep -r "@flaky-quarantine" apps/web/e2e --include="*.spec.ts" -l

# 4. Specs slowest top-10 (sur dernier run CI)
pnpm exec playwright show-report
# UI → trier par durée descending

# 5. Stand-up : noter sujets QA
```

## Pour Tech lead — Revue hebdo

```bash
# Coverage trend graph
codecov-cli graph --since "7 days ago"

# Flaky detection rapport
node scripts/flaky-report.mjs --since "7 days ago"

# Specs > 30s top-20
pnpm exec vitest --reporter verbose --logHeapUsage \
  | jq '.testResults[].testResults[] | select(.duration > 30000) | {name, duration}' \
  | head -20
```

## Tests E2E — Local headed (debug)

```bash
# Mode headed : voir le browser
pnpm exec playwright test --headed e2e/visitor/chat-conversation.spec.ts

# Mode debug interactif
PWDEBUG=1 pnpm exec playwright test e2e/visitor/chat-conversation.spec.ts

# Trace generation forced
pnpm exec playwright test --trace=on e2e/visitor/

# Show trace après run
pnpm exec playwright show-trace test-results/.../trace.zip
```

## Tests E2E — Filter par tag

```bash
pnpm exec playwright test --grep @smoke           # tag smoke
pnpm exec playwright test --grep @critical        # tag critical
pnpm exec playwright test --grep @a11y            # tag a11y
pnpm exec playwright test --grep @multilang       # multilingue
pnpm exec playwright test --grep "@a11y|@critical" # OR logique
pnpm exec playwright test --grep "BS0"            # business scenarios
```

## Tests E2E — Filter par project (browser/locale)

```bash
pnpm exec playwright test --project=chromium-mobile
pnpm exec playwright test --project=firefox-desktop
pnpm exec playwright test --project=chromium-rtl-ar
```

## Tests E2E — Repeat pour détecter flaky

```bash
# Repeat 10× un test
pnpm exec playwright test --repeat-each 10 e2e/visitor/chat-streaming.spec.ts

# Si 10/10 passent : OK
# Si 8/10 passent : FLAKY → quarantaine + ticket
```

## Tests load (k6)

```bash
# Local (assume server running on 3001)
k6 run apps/web/k6/chat-message.js --env BASE_URL=http://localhost:3001

# Cloud (CI)
k6 cloud apps/web/k6/chat-message.js  # ou self-hosted endpoint

# Threshold-only (sortir 1 si breach)
k6 run --quiet --no-summary apps/web/k6/chat-message.js
```

## Tests visual regression

```bash
# Première fois : créer baseline
pnpm exec playwright test --update-snapshots e2e/visual/

# Subsequent runs
pnpm exec playwright test e2e/visual/

# Si fail : voir diff dans HTML report
pnpm exec playwright show-report
```

## Reset DB de test (local)

```bash
# Stop testcontainers (cleanup)
docker ps | grep pgvector
docker stop <container-id>

# Recréation propre (au prochain run)
pnpm test:int  # auto-recreate via testcontainers
```
