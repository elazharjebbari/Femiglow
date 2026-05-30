# AI Engine Test Battery -- Master Runbook

**Version:** 1.0
**Last updated:** 2026-05-27
**Scope:** Complete test execution for the AI Engine LangGraph MVP
**Working directory:** `/var/www/femiglow-staging/apps/web`

---

## Prerequisites

### Required tools

| Tool | Minimum version | Check command |
|------|----------------|---------------|
| Node.js | 18.17+ | `node -v` |
| pnpm | 8.0+ | `pnpm -v` |
| Vitest | 2.1+ | `pnpm vitest --version` |
| Playwright | 1.40+ | `pnpm playwright --version` |
| PostgreSQL | 15+ | `psql --version` |
| Next.js | 14+ | `pnpm next --version` |

### Environment verification

Run this preflight check before starting any test phase:

```bash
cd /var/www/femiglow-staging/apps/web

# 1. Confirm Node.js and pnpm are available
node -v && pnpm -v

# 2. Install dependencies (if not already done)
pnpm install

# 3. Verify database connection
pnpm drizzle-kit push 2>&1 | head -5

# 4. Verify .env is populated with required variables
grep -c 'AI_ENGINE_\|OPENAI_API_KEY\|DATABASE_URL\|ENCRYPTION_KEY' .env

# 5. Verify dev server starts (quick smoke)
timeout 15 pnpm dev &
sleep 8
curl -sf http://127.0.0.1:3000/api/admin/ai-engine/health | head -1
kill %1 2>/dev/null

# 6. Install Playwright browsers
pnpm playwright install chromium
```

### Required environment variables

Ensure `.env` contains at minimum:

```
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...               # or AI_ENGINE_OPENAI_API_KEY
AI_ENGINE_ENCRYPTION_KEY=...         # 32+ char hex string for AES-256
AI_ENGINE_ENCRYPTION_IV=...          # 16 byte hex IV
AI_ENGINE_ENABLED=true
ADMIN_BOOTSTRAP_EMAIL=...
ADMIN_BOOTSTRAP_PASSWORD=...
```

---

## Phase 1: Vitest Unit -- Service Layer

**Goal:** Validate all AI Engine service modules, graph nodes, providers, knowledge, trends, and utility functions in isolation.

### Command

```bash
cd /var/www/femiglow-staging/apps/web

pnpm vitest run src/lib/ai-engine/ --reporter=verbose 2>&1 | tee /tmp/ai-engine-unit-results.txt
```

### Expected scope

| Directory | Test files | Approx. test count |
|-----------|-----------|-------------------|
| `nodes/` | 15 files | 163 tests |
| `providers/` | 4 adapters + 4 services | 74 tests |
| `knowledge/` | 4 files | 54 tests |
| `graph/` | 4 files | 46 tests |
| `services/` | 4 files | 115 tests |
| `trends/` | 3 files | 29 tests |
| `integration/` | 8 files | 47 tests |
| `jobs/` | 1 file | 10 tests |
| `bridge/` | 1 file | 12 tests |
| `config/` | 1 file | 8 tests |
| `performance/` | 3 files | 14 tests |
| `types/` | 3 files | 34 tests |
| `utils/` | 1 file | 6 tests |
| Root-level | 5 files (orchestrator, security, concurrent, quality-integrity, retry-convergence) | 43 tests |
| **Total** | **56 files** | **~635 tests** |

### Pass criteria

- Exit code: `0`
- All 635 tests pass
- No `FAIL` lines in output
- Duration: under 60 seconds

### Verification

```bash
grep -E "Tests +[0-9]+ passed" /tmp/ai-engine-unit-results.txt
grep -c "FAIL" /tmp/ai-engine-unit-results.txt  # must be 0
```

---

## Phase 2: Vitest Contract -- API Route Tests

**Goal:** Validate all 24 AI Engine API routes match their contract (request shape, response shape, status codes, error handling) using MSW-mocked HTTP.

### Command

```bash
cd /var/www/femiglow-staging/apps/web

pnpm vitest run src/test/api-contracts/ai-engine --reporter=verbose 2>&1 | tee /tmp/ai-engine-contract-results.txt
```

### Expected scope

| Contract file | Route(s) covered | Approx. test count |
|---------------|-----------------|-------------------|
| `ai-engine-generate.contract.test.ts` | POST /generate | 10 |
| `ai-engine-stream.contract.test.ts` | POST /generate-stream | 6 |
| `ai-engine-health.contract.test.ts` | GET /health | 6 |
| `ai-engine-config.contract.test.ts` | GET /config/providers, workflows, prompts | 8 |
| `ai-engine-api-keys.contract.test.ts` | GET/POST/DELETE /config/api-keys, POST /test | 21 |
| `ai-engine-knowledge.contract.test.ts` | GET /knowledge | 6 |
| `ai-engine-knowledge-deep.contract.test.ts` | POST /knowledge/seed, /embed, GET/documents | 8 |
| `ai-engine-knowledge-edit.contract.test.ts` | PATCH /knowledge/:slug, PATCH/GET documents/:docId | 17 |
| `ai-engine-jobs.contract.test.ts` | GET /jobs, POST /jobs/:id/review | 6 |
| `ai-engine-publish.contract.test.ts` | POST /publish | 6 |
| `ai-engine-publish-schedule.contract.test.ts` | POST /publish (schedule variant) | 6 |
| `ai-engine-analytics-deep.contract.test.ts` | GET /analytics | 6 |
| `ai-engine-integrations.contract.test.ts` | GET /integrations | 4 |
| `ai-engine-trends.contract.test.ts` | GET /trends | 6 |
| **Total** | **14 files** | **~116 tests** |

### Pass criteria

- Exit code: `0`
- All 116 tests pass
- No `FAIL` lines in output
- Duration: under 30 seconds

### Verification

```bash
grep -E "Tests +[0-9]+ passed" /tmp/ai-engine-contract-results.txt
grep -c "FAIL" /tmp/ai-engine-contract-results.txt  # must be 0
```

---

## Phase 3: Vitest Component -- UI Tests

**Goal:** Validate all AI Engine React pages and shared components render correctly, handle user interactions, and manage state transitions.

### Command

```bash
cd /var/www/femiglow-staging/apps/web

# Page-level tests
pnpm vitest run src/app/admin/content-studio-v2/ai-engine --reporter=verbose 2>&1 | tee /tmp/ai-engine-component-pages.txt

# Shared component tests
pnpm vitest run src/components/admin/content-studio-v2/ai-engine --reporter=verbose 2>&1 | tee /tmp/ai-engine-component-shared.txt
```

### Expected scope

| Component file | Approx. test count |
|---------------|-------------------|
| `dashboard.test.tsx` | 12 |
| `config-page.test.tsx` | 21 |
| `create-page.test.tsx` | 18 |
| `knowledge-page.test.tsx` | 12 |
| `analytics-page.test.tsx` | 10 |
| `trends-page.test.tsx` | 10 |
| `graph-page.test.tsx` | 8 |
| `loading-states.test.tsx` | 7 |
| `GenerationResult.test.tsx` | 15 |
| `GenerationProgress.test.tsx` | 12 |
| `ReviewPanel.test.tsx` | 12 |
| `PublishSection.test.tsx` | 10 |
| `ErrorBanners.test.tsx` | 8 |
| `ClipboardCopy.test.tsx` | 6 |
| **Total** | **14 files, ~161 tests** |

### Pass criteria

- Exit code: `0` for both commands
- All 161 tests pass (98 page + 63 shared)
- No `FAIL` lines in output
- Duration: under 45 seconds

### Verification

```bash
grep -E "Tests +[0-9]+ passed" /tmp/ai-engine-component-pages.txt /tmp/ai-engine-component-shared.txt
grep -c "FAIL" /tmp/ai-engine-component-pages.txt /tmp/ai-engine-component-shared.txt  # must both be 0
```

---

## Phase 4: Build Verification

**Goal:** Confirm the full Next.js build passes with zero TypeScript errors and zero build warnings related to AI Engine modules.

### Command

```bash
cd /var/www/femiglow-staging/apps/web

pnpm build 2>&1 | tee /tmp/ai-engine-build.txt
```

### Pass criteria

- Exit code: `0`
- Zero lines matching `Type error:` in output
- Zero lines matching `Error:` in the build output (excluding informational Next.js messages)
- Build completes in under 5 minutes

### Verification

```bash
echo "Exit code: $?"
grep -c "Type error:" /tmp/ai-engine-build.txt    # must be 0
grep -ic "error" /tmp/ai-engine-build.txt          # review any matches manually
grep "Route (app)" /tmp/ai-engine-build.txt | head -5  # confirm routes were built
```

---

## Phase 5: E2E Playwright

**Goal:** Run the full Playwright suite for all AI Engine end-to-end scenarios against a running Next.js server.

### Pre-requisite

```bash
cd /var/www/femiglow-staging/apps/web

# Ensure Playwright browsers are installed
pnpm playwright install chromium

# Start dev server in background (if not using CI webServer config)
pnpm dev &
DEV_PID=$!
sleep 10
curl -sf http://127.0.0.1:3000/api/admin/ai-engine/health
```

### Command

```bash
cd /var/www/femiglow-staging/apps/web

pnpm playwright test e2e/content-studio-v2/ai-engine --reporter=list,html 2>&1 | tee /tmp/ai-engine-e2e-results.txt
```

### Expected scope

| Spec file | Focus | Approx. test count |
|-----------|-------|-------------------|
| `ai-engine-scenario-golden-path.spec.ts` | S01: Full happy path brief-to-library | 15 |
| `ai-engine-scenario-error-recovery.spec.ts` | S02: Fail, retry, succeed | 10 |
| `ai-engine-dashboard.spec.ts` | Dashboard widgets | 4 |
| `ai-engine-navigation.spec.ts` | Sidebar + routing | 8 |
| `ai-engine-sidebar-subnav.spec.ts` | Sub-navigation | 4 |
| `ai-engine-config.spec.ts` | Provider/workflow/prompt config | 8 |
| `ai-engine-api-keys.spec.ts` | API key CRUD | 17 |
| `ai-engine-create.spec.ts` | Content creation form | 12 |
| `ai-engine-knowledge.spec.ts` | Knowledge collections list | 8 |
| `ai-engine-knowledge-edit.spec.ts` | Knowledge CRUD edit | 15 |
| `ai-engine-knowledge-flow.spec.ts` | Knowledge seed + embed flow | 6 |
| `ai-engine-hitl-review.spec.ts` | Human-in-the-loop review | 10 |
| `ai-engine-review-edit-cycle.spec.ts` | Edit/regenerate cycle | 8 |
| `ai-engine-brief-edit-regen.spec.ts` | Brief modification + regen | 6 |
| `ai-engine-publish.spec.ts` | Publish to platform | 8 |
| `ai-engine-analytics.spec.ts` | Analytics dashboard | 6 |
| `ai-engine-trends.spec.ts` | Trends discovery | 8 |
| `ai-engine-graph.spec.ts` | Graph visualization | 8 |
| `ai-engine-sse-streaming.spec.ts` | SSE streaming progress | 8 |
| `ai-engine-provider-fallback.spec.ts` | Provider fallback chain | 6 |
| `ai-engine-budget-guard.spec.ts` | Budget limit enforcement | 6 |
| `ai-engine-concurrent.spec.ts` | Concurrent generation safety | 4 |
| `ai-engine-session-expired.spec.ts` | Session expiry handling | 6 |
| `ai-engine-refresh-recovery.spec.ts` | Page refresh recovery | 6 |
| `ai-engine-multi-format.spec.ts` | Multi-format generation | 6 |
| `ai-engine-responsive.spec.ts` | Responsive layout | 8 |
| `ai-engine-dark-mode.spec.ts` | Dark mode rendering | 6 |
| `ai-engine-keyboard.spec.ts` | Keyboard navigation | 6 |
| `ai-engine-a11y.spec.ts` | Accessibility audit | 1 |
| **Total** | **29 spec files** | **~224 tests** |

### Pass criteria

- Exit code: `0`
- All 224 tests pass
- Zero flaky tests (retried and failed)
- HTML report generated at `playwright-report/index.html`
- Duration: under 10 minutes (parallel, single worker in CI)

### Verification

```bash
grep -E "[0-9]+ passed" /tmp/ai-engine-e2e-results.txt
grep -c "failed" /tmp/ai-engine-e2e-results.txt  # must be 0

# Open HTML report for visual inspection
# npx playwright show-report
```

### Cleanup

```bash
kill $DEV_PID 2>/dev/null
```

---

## Phase 6: Correction Loop

When any phase reports failures, follow this structured correction loop:

### Step 6.1: Identify

```bash
# Extract failing test names
grep -E "FAIL|failed|Error" /tmp/ai-engine-*-results.txt | sort -u
```

### Step 6.2: Classify the failure

| Category | Symptom | Typical fix |
|----------|---------|-------------|
| **MSW handler missing** | `fetch failed`, `Network error`, `Expected 200 got undefined` | Add or update handler in `src/test/msw/ai-engine-handlers.ts` |
| **Type mismatch** | `Property X does not exist on type Y` | Update type definition or mock data to match schema |
| **Selector changed** | `Unable to find element`, `locator.click: Error` | Update test selector to match current DOM structure |
| **Race condition** | Intermittent `timeout`, passes on retry | Add `waitFor` / `waitForResponse` / `expect.poll` |
| **Auth expired** | `401 Unauthorized`, `Session expired` | Re-run `global.setup.ts`, check `ADMIN_BOOTSTRAP_*` env vars |
| **DB connection** | `Connection refused`, `ECONNREFUSED` | Start PostgreSQL, verify `DATABASE_URL` |
| **Port in use** | `EADDRINUSE: address already in use :3000` | `lsof -ti:3000 \| xargs kill -9` |
| **Import error** | `Cannot find module`, `Module not found` | Check alias `@/` resolution, run `pnpm install` |

### Step 6.3: Fix

1. Make the minimal change to fix the failure
2. Do not change production code to fix test issues unless it is a genuine bug
3. Commit test fixes separately from production code fixes

### Step 6.4: Re-run the failing phase

```bash
# Re-run only the failing test file for fast iteration
pnpm vitest run path/to/failing.test.ts --reporter=verbose

# Or for E2E
pnpm playwright test e2e/content-studio-v2/ai-engine-failing.spec.ts
```

### Step 6.5: Iterate

Repeat steps 6.1-6.4 until all tests in the failing phase pass, then proceed to re-run the full phase command to confirm no regressions.

### Step 6.6: Cross-phase regression check

After fixing failures in any phase, re-run all previous phases to ensure fixes did not introduce regressions:

```bash
cd /var/www/femiglow-staging/apps/web

# Quick full re-run (unit + contract + component)
pnpm vitest run src/lib/ai-engine/ src/test/api-contracts/ai-engine src/app/admin/content-studio-v2/ai-engine src/components/admin/content-studio-v2/ai-engine --reporter=verbose
```

---

## Phase 7: Coverage Report

**Goal:** Generate a coverage report for AI Engine modules and verify thresholds.

### Command

```bash
cd /var/www/femiglow-staging/apps/web

pnpm vitest run src/lib/ai-engine/ \
  --coverage \
  --coverage.include='src/lib/ai-engine/**/*.ts' \
  --coverage.include='src/lib/ai-engine/**/*.tsx' \
  --coverage.exclude='**/*.test.ts' \
  --coverage.exclude='**/*.test.tsx' \
  --coverage.exclude='**/index.ts' \
  --coverage.exclude='**/types.ts' \
  --reporter=verbose 2>&1 | tee /tmp/ai-engine-coverage.txt
```

### Threshold targets

| Metric | Target | Rationale |
|--------|--------|-----------|
| Statements | >= 80% | Core logic must be exercised |
| Lines | >= 80% | Aligns with statements |
| Functions | >= 80% | All public functions must be tested |
| Branches | >= 70% | Defensive guards and feature flags create hard-to-reach branches |

### Pass criteria

- Coverage report generates without errors
- All four metrics meet or exceed targets
- HTML report available at `coverage/index.html`

### Verification

```bash
# Check thresholds from text output
grep -A4 "Statements" /tmp/ai-engine-coverage.txt
grep -A4 "Branches" /tmp/ai-engine-coverage.txt

# Or inspect the JSON summary
cat coverage/coverage-summary.json | grep -A1 '"pct"' | head -8
```

---

## Phase 8: Final Validation Checklist

Complete each item before declaring the test battery green:

| # | Check | Command / Action | Status |
|---|-------|-----------------|--------|
| 1 | Unit tests: 635/635 pass | `pnpm vitest run src/lib/ai-engine/` | [ ] |
| 2 | Contract tests: 116/116 pass | `pnpm vitest run src/test/api-contracts/ai-engine` | [ ] |
| 3 | Component tests: 161/161 pass | Vitest on pages + shared components | [ ] |
| 4 | Build: 0 TS errors | `pnpm build` | [ ] |
| 5 | E2E tests: 224/224 pass | `pnpm playwright test e2e/content-studio-v2/ai-engine` | [ ] |
| 6 | Coverage: 80%+ stmts, 70%+ branches | Coverage report | [ ] |
| 7 | No skipped tests | `grep -c 'skip\|todo' **/*.test.ts` shows 0 | [ ] |
| 8 | No `.only` left in test files | `grep -rn '\.only' src/lib/ai-engine/ src/test/api-contracts/ e2e/` shows 0 | [ ] |
| 9 | Playwright HTML report archived | `playwright-report/index.html` exists | [ ] |
| 10 | Coverage HTML report archived | `coverage/index.html` exists | [ ] |

### Sign-off

```
Date:       ____________________
Executed by: ____________________
All 8 phases: PASS / FAIL
Total tests: ______ / ______
Notes:      ____________________
```

---

## Appendix A: Troubleshooting Common Failures

### A.1 Auth expired / 401 Unauthorized

**Symptom:** E2E tests fail with `401`, `Session expired`, or redirect to `/login`.

**Root cause:** The Playwright `global.setup.ts` wrote a stale auth session to `.auth/admin.json`.

**Fix:**

```bash
# Remove stale auth state
rm -f .auth/admin.json

# Re-run setup project explicitly
pnpm playwright test --project=setup

# Verify credentials are correct
grep 'ADMIN_BOOTSTRAP_EMAIL\|ADMIN_BOOTSTRAP_PASSWORD' .env
```

### A.2 Database connection refused

**Symptom:** `ECONNREFUSED`, `Connection terminated unexpectedly`, or `relation "ai_engine_*" does not exist`.

**Fix:**

```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# If not running
sudo systemctl start postgresql
# or
brew services start postgresql@15

# Push schema
pnpm drizzle-kit push

# Verify tables exist
psql "$DATABASE_URL" -c "\dt ai_engine_*"
```

### A.3 Port 3000 already in use

**Symptom:** `Error: listen EADDRINUSE: address already in use :::3000`

**Fix:**

```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9

# Or use a different port
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3001 PORT=3001 pnpm dev &
```

### A.4 MSW handler missing

**Symptom:** `TypeError: fetch failed`, `request handler not found`, or unexpected `undefined` response body in contract/component tests.

**Fix:**

1. Identify the route being called from the test error output
2. Check if a handler exists in `src/test/msw/ai-engine-handlers.ts`
3. If missing, add the handler following the existing pattern
4. If present but returning wrong shape, update mock data to match current schema

```bash
# Search for existing handler
grep -n "the/missing/route" src/test/msw/ai-engine-handlers.ts
```

### A.5 Playwright locator timeout

**Symptom:** `locator.click: Timeout 30000ms exceeded. Waiting for selector...`

**Fix:**

1. Run the failing test in headed mode to observe the DOM state:
   ```bash
   pnpm playwright test --headed e2e/content-studio-v2/ai-engine-failing.spec.ts
   ```
2. Check if the selector has changed (component refactor)
3. Check if the element requires scrolling or a preceding interaction
4. Increase specificity: prefer `getByRole`, `getByTestId` over generic CSS selectors

### A.6 Vitest environment mismatch

**Symptom:** `ReferenceError: document is not defined` or `window is not defined`

**Fix:** Ensure the test file is included in the jsdom environment. Check `vitest.config.ts` -- the `environment: 'jsdom'` applies to all tests matching `src/**/*.test.{ts,tsx}`. If a server-side test needs Node environment, add a comment at the top:

```ts
// @vitest-environment node
```

### A.7 Encryption key not configured

**Symptom:** API key tests fail with `Le chiffrement n'est pas configure` or `Encryption service unavailable`.

**Fix:**

```bash
# Generate a valid encryption key pair
node -e "console.log('AI_ENGINE_ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log('AI_ENGINE_ENCRYPTION_IV=' + require('crypto').randomBytes(16).toString('hex'))"

# Add to .env
```

### A.8 Module resolution / alias failure

**Symptom:** `Error: Cannot find module '@/lib/ai-engine/...'`

**Fix:**

```bash
# Verify vitest.config.ts has the alias
grep -A2 'alias' vitest.config.ts

# Rebuild node_modules if needed
rm -rf node_modules/.vitest
pnpm install
```

---

## Appendix B: Quick Reference -- Run All Phases Sequentially

```bash
cd /var/www/femiglow-staging/apps/web

echo "=== Phase 1: Unit ===" && \
pnpm vitest run src/lib/ai-engine/ && \
echo "=== Phase 2: Contract ===" && \
pnpm vitest run src/test/api-contracts/ai-engine && \
echo "=== Phase 3: Component ===" && \
pnpm vitest run src/app/admin/content-studio-v2/ai-engine src/components/admin/content-studio-v2/ai-engine && \
echo "=== Phase 4: Build ===" && \
pnpm build && \
echo "=== Phase 5: E2E ===" && \
pnpm playwright test e2e/content-studio-v2/ai-engine && \
echo "=== ALL PHASES PASSED ==="
```

---

## Appendix C: CI Pipeline Integration

For CI (GitHub Actions), the recommended matrix:

```yaml
jobs:
  ai-engine-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        phase: [unit, contract, component, build, e2e]
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install
      - name: Unit
        if: matrix.phase == 'unit'
        run: pnpm vitest run src/lib/ai-engine/
      - name: Contract
        if: matrix.phase == 'contract'
        run: pnpm vitest run src/test/api-contracts/ai-engine
      - name: Component
        if: matrix.phase == 'component'
        run: pnpm vitest run src/app/admin/content-studio-v2/ai-engine src/components/admin/content-studio-v2/ai-engine
      - name: Build
        if: matrix.phase == 'build'
        run: pnpm build
      - name: E2E
        if: matrix.phase == 'e2e'
        run: |
          pnpm playwright install chromium
          pnpm playwright test e2e/content-studio-v2/ai-engine
```
