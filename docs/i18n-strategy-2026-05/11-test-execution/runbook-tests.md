# Runbook tests i18n — Exécution pas-à-pas

> **Cœur opérationnel** du sous-dossier `11-test-execution/`.
> Runbook copy-pastable pour **exécuter, debugger, rapporter** la batterie de tests i18n FemiGlow.
>
> Audience : dev qui pilote la batterie au jour le jour, QA, on-call.

## Sommaire

- [Section 1 — Setup environnement local](#section-1--setup-environnement-local)
- [Section 2 — Exécution wave par wave](#section-2--exécution-wave-par-wave)
- [Section 3 — Commandes utilitaires](#section-3--commandes-utilitaires)
- [Section 4 — Lecture des résultats](#section-4--lecture-des-résultats)
- [Section 5 — Debug d'un test qui fail](#section-5--debug-dun-test-qui-fail)
- [Section 6 — Snapshots et coverage](#section-6--snapshots-et-coverage)
- [Section 7 — Reporting et exports](#section-7--reporting-et-exports)
- [Section 8 — CI GitHub Actions](#section-8--ci-github-actions)
- [Section 9 — Communication résultats](#section-9--communication-résultats)
- [Section 10 — On-call et escalade](#section-10--on-call-et-escalade)
- [Annexes](#annexes)

---

## Section 1 — Setup environnement local

### 1.1 Prérequis machine

| Outil | Version cible | Vérification |
|---|---|---|
| Node.js | 20.18.x | `node --version` |
| pnpm | 9.x | `pnpm --version` |
| Postgres (local) | 16.x | `psql --version` |
| Git | 2.40+ | `git --version` |
| Chromium (via Playwright) | latest | `pnpm exec playwright --version` |

#### Installation Node via fnm (recommandé)

```bash
# Si fnm pas installé
curl -fsSL https://fnm.vercel.app/install | bash

# Le projet a un .nvmrc
fnm use
node --version  # devrait afficher 20.18.x
```

#### Installation pnpm

```bash
corepack enable
corepack prepare pnpm@9 --activate
pnpm --version
```

#### Installation Postgres local

```bash
# macOS via Homebrew
brew install postgresql@16
brew services start postgresql@16

# Vérifier
psql -d postgres -c "SELECT version();"
```

### 1.2 Setup du projet

```bash
# Clone (si pas déjà fait)
git clone git@github.com:femiglow/template-femiglow.git
cd template-femiglow

# Install deps (monorepo)
pnpm install

# Build wasm helpers si projet en utilise
pnpm --filter @femiglow/web codegen
```

### 1.3 Setup base de données

#### Option A : DB locale dev

```bash
# Créer la DB dev
createdb femiglow_dev

# Variables d'env
cp apps/web/.env.example apps/web/.env
# Éditer DATABASE_URL → postgresql://localhost:5432/femiglow_dev

# Migrations
pnpm --filter @femiglow/web db:migrate

# Seed
pnpm --filter @femiglow/web db:seed
```

#### Option B : DB Neon staging

```bash
# Copier la connection string depuis Vercel/Neon dashboard
# Coller dans .env
# DATABASE_URL=postgresql://...neon.tech/...
```

### 1.4 Setup base de données de test

```bash
# Créer la DB test (séparée de dev)
createdb femiglow_test

# Variables d'env
echo "DATABASE_URL_TEST=postgresql://localhost:5432/femiglow_test" >> apps/web/.env.test.local

# Migrations + seed test
pnpm --filter @femiglow/web db:test:setup
```

### 1.5 Setup Playwright

```bash
# Installer browsers (chromium suffit pour l'i18n suite)
pnpm exec playwright install --with-deps chromium

# Optionnel : firefox + webkit pour matrix complète
pnpm exec playwright install --with-deps
```

### 1.6 Vérification setup complet

```bash
# Script de smoke test setup
pnpm --filter @femiglow/web setup:doctor
```

Output attendu :
```
✓ Node 20.18.x detected
✓ pnpm 9.x detected
✓ Postgres reachable
✓ DATABASE_URL valid
✓ DATABASE_URL_TEST valid
✓ Playwright chromium installed
✓ Next.js can build (smoke build)
✓ Vitest can run (smoke unit test)
✓ Ready to run i18n batterie
```

### 1.7 Tag Git baseline

**Avant** de lancer la batterie, on tag pour pouvoir revenir :

```bash
git tag -a i18n-baseline-2026-MM-DD -m "Baseline avant exécution batterie i18n"
git push origin --tags
```

---

## Section 2 — Exécution wave par wave

### 2.1 Wave 1 — Foundation

```bash
# Run
pnpm --filter @femiglow/web test:i18n:wave1

# Variantes
pnpm test:i18n:wave1 -- --reporter=verbose             # log verbeux
pnpm test:i18n:wave1 -- --coverage                      # avec coverage
pnpm test:i18n:wave1 -- --bail                          # stop au premier fail
pnpm test:i18n:wave1 -- src/lib/i18n/resolveLocale.test.ts  # fichier précis
```

**Durée attendue** : ~2 min local, ~1 min CI.

**Exit criterion** :
- 100% green
- Coverage `lib/i18n/*` ≥ 90%
- 0 snapshot obsolete

### 2.2 Wave 2 — Component

```bash
pnpm --filter @femiglow/web test:i18n:wave2

# Variantes
TZ=Africa/Casablanca pnpm test:i18n:wave2              # locked timezone
pnpm test:i18n:wave2 -- --update-snapshots             # update snapshots (review obligatoire)
pnpm test:i18n:wave2 -- --watch                        # mode watch (dev local)
```

**Durée attendue** : ~5 min local, ~3 min CI.

**Exit criterion** :
- 100% green
- Coverage `components/i18n/*` ≥ 85%

### 2.3 Wave 3 — Integration

```bash
# Setup DB test (1ère fois ou après reset)
pnpm --filter @femiglow/web db:test:reset
pnpm --filter @femiglow/web db:test:migrate
pnpm --filter @femiglow/web db:test:seed -- --i18n-fixtures

# Run
pnpm --filter @femiglow/web test:i18n:wave3
```

**Durée attendue** : ~6 min local, ~4 min CI.

**Exit criterion** :
- 100% green
- Coverage routes API ≥ 90%
- DB rollback propre

### 2.4 Wave 4 — E2E

```bash
# Terminal 1 : démarrer Next.js
pnpm --filter @femiglow/web dev

# Terminal 2 : run les tests
pnpm --filter @femiglow/web test:i18n:wave4

# Par locale (si on veut isoler)
pnpm test:i18n:wave4:fr
pnpm test:i18n:wave4:ar
pnpm test:i18n:wave4:en

# Mode UI interactif (debug visuel)
pnpm test:i18n:wave4 -- --ui

# Spec unique avec debug
pnpm test:i18n:wave4 -- e2e/i18n/wizard-checkout.spec.ts --headed --debug
```

**Durée attendue** : ~25 min local, ~10 min CI (3 projects parallèle).

**Exit criterion** :
- 100% green sur **3 runs consécutifs**
- 0 spec `.skip` sans ticket

### 2.5 Wave 5 — Visual

```bash
# Run
pnpm --filter @femiglow/web test:i18n:wave5

# Update baseline (après refactor légitime, jamais sans review)
pnpm test:i18n:wave5 -- --update-snapshots

# Spec unique
pnpm test:i18n:wave5 -- e2e/visual/home.visual.spec.ts --project=chromium-ar
```

**Durée attendue** : ~8 min local, ~5 min CI.

**Exit criterion** :
- 0 diff inattendu (tous les diffs sont review et approuvés)

### 2.6 Wave 6 — A11y

```bash
pnpm --filter @femiglow/web test:i18n:wave6

# Par locale
pnpm test:i18n:wave6 -- --project=chromium-ar

# Single spec
pnpm test:i18n:wave6 -- e2e/a11y/i18n/home.a11y.spec.ts
```

**Durée attendue** : ~4 min local, ~3 min CI.

**Exit criterion** :
- 0 violation critical/serious sur 18 scans

### 2.7 Wave 7 — Performance

```bash
# 1. Build prod
pnpm --filter @femiglow/web build

# 2. Démarrer en prod mode (terminal séparé)
pnpm --filter @femiglow/web start

# 3. Run Lighthouse + bundle analysis
pnpm --filter @femiglow/web test:i18n:wave7
```

**Durée attendue** : ~5 min local, ~3 min CI.

**Exit criterion** :
- Lighthouse perf ≥ 90 sur 3 locales
- Bundle delta < +5%

### 2.8 Wave 8 — Robustness

```bash
# Run complète
pnpm --filter @femiglow/web test:i18n:wave8

# Juste les fuzz tests
pnpm test:i18n:wave8 -- src/lib/i18n/edge-cases

# Juste les chaos E2E
pnpm test:i18n:wave8 -- e2e/chaos

# Fuzz avec seed différent (re-test après fix)
FAST_CHECK_SEED=123 pnpm test:i18n:wave8
```

**Durée attendue** : ~10 min local, ~5 min CI.

**Exit criterion** :
- 0 crash sur fuzz inputs
- 0 XSS leak
- 0 data loss sur chaos

### 2.9 All waves séquentiel

```bash
# Lance les 8 waves dans l'ordre, échoue au premier fail
pnpm --filter @femiglow/web test:i18n:all
```

**Durée attendue** : ~65 min local, ~22 min CI (parallélisé).

---

## Section 3 — Commandes utilitaires

### 3.1 Run un test précis

```bash
# Vitest : par nom (grep)
pnpm --filter @femiglow/web test:unit -- --grep "resolveLocale extracts ar"

# Vitest : par fichier
pnpm test:unit -- src/lib/i18n/resolveLocale.test.ts

# Playwright : par fichier
pnpm test:e2e -- e2e/i18n/wizard-checkout.spec.ts

# Playwright : par nom (grep)
pnpm test:e2e -- --grep "switch to AR"

# Playwright : par tag (annotations)
pnpm test:e2e -- --grep "@critical"
```

### 3.2 Mode watch (dev local)

```bash
# Vitest watch
pnpm --filter @femiglow/web test:unit -- --watch src/lib/i18n

# Playwright UI mode (interactif)
pnpm --filter @femiglow/web test:e2e -- --ui
```

### 3.3 Retry just failed

```bash
# Vitest : rerun les tests qui ont fail au dernier run
pnpm --filter @femiglow/web test:i18n:retry-failed
# (alias pour `vitest --run --reporter=verbose --rerunFailedSpecs`)

# Playwright : rerun les fail uniquement
pnpm --filter @femiglow/web test:e2e -- --last-failed
```

### 3.4 Coverage

```bash
# Génère coverage HTML + JSON + LCOV
pnpm --filter @femiglow/web test:coverage

# Coverage uniquement sur i18n
pnpm --filter @femiglow/web test:coverage -- src/lib/i18n src/components/i18n

# Voir le HTML report
open coverage/index.html
```

### 3.5 Update snapshots

```bash
# Snapshots Vitest (toMatchSnapshot)
pnpm test:unit -- --update-snapshots

# Snapshots Playwright visual
pnpm test:visual -- --update-snapshots

# Snapshots Playwright + i18n (juste la wave 5)
pnpm test:i18n:wave5 -- --update-snapshots
```

**ATTENTION** : `--update-snapshots` ne doit JAMAIS être lancé en CI. Toujours en local + review obligatoire avant commit.

### 3.6 Génération de fixtures de test

```bash
# Régénérer les fixtures i18n (messages, locales)
pnpm --filter @femiglow/web fixtures:i18n:generate

# Lister les fixtures dispos
pnpm --filter @femiglow/web fixtures:list
```

### 3.7 Reset / clean

```bash
# Reset tests results
rm -rf apps/web/test-results apps/web/playwright-report apps/web/.vitest

# Reset coverage
rm -rf apps/web/coverage

# Reset DB test (réinit + reseed)
pnpm --filter @femiglow/web db:test:reset
```

### 3.8 Lint i18n

```bash
# Run uniquement les rules ESLint i18n custom
pnpm --filter @femiglow/web lint:i18n

# Auto-fix
pnpm --filter @femiglow/web lint:i18n --fix
```

### 3.9 Typecheck strict

```bash
pnpm --filter @femiglow/web typecheck

# Sur les fichiers i18n uniquement
pnpm --filter @femiglow/web typecheck -- --filter '**/i18n/**'
```

### 3.10 Run plusieurs waves en parallèle (local)

```bash
# Exemple : run Wave 1 + Wave 2 + Wave 3 en parallèle
pnpm test:i18n:wave1 & pnpm test:i18n:wave2 & pnpm test:i18n:wave3 & wait
```

ATTENTION : risque de race sur la DB test si Wave 3 est mélangée. Préférer séquentiel pour Wave 3.

---

## Section 4 — Lecture des résultats

### 4.1 Reporter Vitest

#### Reporter `default` (CI)

```
 RUN  v2.1.2

 ✓ src/lib/i18n/config.test.ts (12)
 ✓ src/lib/i18n/resolveLocale.test.ts (18)
 ✗ src/lib/i18n/formatters.test.ts (24)
   × formatCurrency MAD format AR avec native numerals
     → Expected '١٢٣٫٤٥ MAD' but got '123,45 MAD'

 Test Files  1 failed | 2 passed (3)
      Tests  1 failed | 53 passed (54)
   Start at  10:32:14
   Duration  1.87s
```

#### Reporter `verbose` (debug)

```
 ✓ formatCurrency MAD format FR (4ms)
 ✓ formatCurrency MAD format EN (3ms)
 ✗ formatCurrency MAD format AR avec native numerals (5ms)

   Expected: '١٢٣٫٤٥ MAD'
   Received: '123,45 MAD'

   at /Users/.../formatters.test.ts:42:32
```

#### Reporter `dot` (CI rapide)

```
.....F.................

 1 failed
```

### 4.2 Reporter Playwright

#### Reporter `list` (CI)

```
Running 150 tests using 4 workers

  ✓ e2e/i18n/locale-switcher.spec.ts:3:1 › switches FR to AR (4.2s)
  ✓ e2e/i18n/cookie-persist.spec.ts:8:1 › cookie persists (3.1s)
  ✗ e2e/i18n/wizard-checkout.spec.ts:15:1 › full wizard AR (timeout 30s)
  ...

  149 passed, 1 failed (10m 24s)
```

#### Reporter `html` (debug)

Génère un dossier `playwright-report/` avec :
- `index.html` : vue d'ensemble
- Screenshots avant/après pour chaque fail
- Videos `.webm`
- Traces `.zip` rejouables

Ouvrir :
```bash
pnpm exec playwright show-report
```

### 4.3 Reporter JUnit (CI ingestion)

Génère `junit.xml` ingestible par :
- GitHub Actions (`actions/upload-artifact` + reporting plugin)
- GitLab CI (native)
- Jenkins (xUnit plugin)
- Datadog Test Visibility

Configuration :
```ts
// vitest.config.ts
export default defineConfig({
  test: {
    reporters: ['default', ['junit', { outputFile: 'junit.xml' }]],
  },
});
```

### 4.4 Coverage report

```bash
pnpm --filter @femiglow/web test:coverage
open coverage/index.html
```

Vue HTML :
- Heatmap par fichier (rouge < 80%, orange 80-90%, vert ≥ 90%)
- Drill-down ligne par ligne (hit/missed)
- Branche coverage (if/else, switch)

JSON pour gates CI :
```bash
node scripts/check-i18n-coverage.mjs --threshold-lines=90
```

### 4.5 Lighthouse report

```bash
# HTML report
open .lighthouseci/lhr-{timestamp}.html

# JSON pour gates
cat .lighthouseci/lhr-{timestamp}.json | jq '.categories.performance.score'
```

---

## Section 5 — Debug d'un test qui fail

### 5.1 Workflow général

```
                    ┌──────────────────────┐
                    │  Test fail            │
                    └─────────┬────────────┘
                              ▼
                    ┌──────────────────────┐
                    │ Read error message    │
                    │ + stack trace          │
                    └─────────┬────────────┘
                              ▼
                    ┌──────────────────────┐
                    │ Reproduce locally     │
                    │ avec --reporter=verbose│
                    └─────────┬────────────┘
                              ▼
                    ┌──────────────────────┐
                    │ Isole le test seul    │
                    │ avec --grep / --bail   │
                    └─────────┬────────────┘
                              ▼
                    ┌──────────────────────┐
                    │ Hypothèse cause       │
                    │ (test bug / app bug / │
                    │  flaky / env)          │
                    └─────────┬────────────┘
                              ▼
                    ┌──────────────────────┐
                    │ Phase 3 boucle        │
                    │ correction             │
                    └──────────────────────┘
```

### 5.2 Debug Vitest

#### Mode interactif

```bash
# Pause au premier fail pour debugger en console
pnpm test:i18n:wave1 -- --bail --reporter=verbose

# Inspector Chrome DevTools
node --inspect-brk node_modules/.bin/vitest run src/lib/i18n
# Open chrome://inspect
```

#### Console.log temporaire

```ts
it('debug', () => {
  const result = resolveLocale('/ar/kit');
  console.log('DEBUG result:', JSON.stringify(result, null, 2));
  expect(result).toBe('ar');
});
```

Run avec :
```bash
pnpm test:unit -- --grep "debug" --reporter=verbose
```

⚠️ Toujours **retirer** les console.log avant commit.

#### Snapshot diff

Si fail sur `toMatchSnapshot()`, voir le diff :
```bash
pnpm test:unit -- --grep "snapshot" --reporter=verbose
```

Pour update légitime :
```bash
pnpm test:unit -- --grep "snapshot" --update-snapshots
git diff  # review diff
```

### 5.3 Debug Playwright

#### Mode UI

```bash
pnpm test:e2e -- e2e/i18n/wizard-checkout.spec.ts --ui
```

Avantages :
- Pause après chaque action
- DOM inspection
- Re-run ligne par ligne
- Trace replay

#### Mode headed + slowMo

```bash
pnpm test:e2e -- e2e/i18n/wizard-checkout.spec.ts --headed
```

Avec slow motion (dans le test) :
```ts
test('debug', async ({ page, browser }) => {
  // slowMo intégré au browser (au lancement)
  // OU utiliser page.pause() pour stopper en cours
  await page.goto('/fr/kit');
  await page.pause(); // ouvre Playwright Inspector
  await page.getByTestId('locale-switcher-button').click();
});
```

#### Trace replay

```bash
# Ouvrir une trace .zip
pnpm exec playwright show-trace test-results/.../trace.zip
```

Trace contient :
- Screenshots à chaque action
- Network requests
- Console logs
- DOM snapshots avant/après

#### Vidéo

Vidéos enregistrées automatiquement sur fail :
```bash
ls test-results/*/video.webm
open test-results/.../video.webm
```

### 5.4 Debug flaky tests

#### Reproduire la flakiness

```bash
# Lancer le test 10 fois consécutivement
for i in {1..10}; do
  echo "=== Run $i ==="
  pnpm test:e2e -- --grep "T204" || echo "FAIL run $i"
done
```

Si fail sur certaines runs → flaky confirmé.

#### Identifier la cause

Causes typiques :
1. **Race condition** : `await waitForLoadState('networkidle')` manquant
2. **Timing fragile** : `page.waitForTimeout(500)` au lieu d'un selector
3. **State leak** : test précédent modifie la DB / cookies sans cleanup
4. **Animation** : capture screenshot pendant transition
5. **Network** : appel API non mocké, latence variable

#### Fix patterns

```ts
// ❌ Mauvais : timing fragile
await page.click('button');
await page.waitForTimeout(1000);
await expect(page.locator('.result')).toBeVisible();

// ✅ Bon : wait sur condition
await page.click('button');
await expect(page.locator('.result')).toBeVisible({ timeout: 5000 });

// ❌ Mauvais : race condition
await page.goto('/fr/kit');
const title = await page.locator('h1').textContent();

// ✅ Bon : attendre que le DOM soit prêt
await page.goto('/fr/kit');
await page.waitForLoadState('networkidle');
const title = await page.locator('h1').textContent();
```

### 5.5 Debug env (CI vs local)

Si test passe en local mais fail en CI :

1. **Vérifier les versions** :
   ```bash
   node --version       # CI utilise même version ?
   pnpm --version       # idem
   pnpm exec playwright --version
   ```

2. **Vérifier les env vars** :
   ```bash
   env | grep -E '(NEXT_|DATABASE_|TEST_)'
   ```

3. **Vérifier le timezone** :
   ```bash
   echo $TZ
   # CI souvent UTC, local souvent Europe/Paris ou Africa/Casablanca
   # Forcer dans les tests :
   TZ=Africa/Casablanca pnpm test
   ```

4. **Vérifier la locale système** :
   ```bash
   locale
   # CI souvent C.UTF-8, local souvent fr_FR.UTF-8
   ```

5. **Reproduire CI en local** (Docker) :
   ```bash
   docker run --rm -v $(pwd):/app -w /app node:20.18-bookworm-slim bash -c "
     corepack enable && pnpm install && pnpm test:i18n:wave1
   "
   ```

---

## Section 6 — Snapshots et coverage

### 6.1 Snapshots Vitest

#### Structure

```
src/components/i18n/__snapshots__/
├── LocaleSwitcher.test.tsx.snap
└── Header.i18n.test.tsx.snap
```

#### Lifecycle

1. Test écrit avec `toMatchSnapshot()`
2. 1er run : génère le snapshot
3. Runs suivants : compare au snapshot
4. Si refactor légitime : `--update-snapshots`

#### Bonnes pratiques

- ✅ Snapshots ciblés (un seul élément) plutôt que full DOM
- ✅ `toMatchInlineSnapshot()` pour les très petits (visible direct dans le test)
- ✅ Review obligatoire des diffs avant commit
- ❌ Snapshots de plus de 50 lignes (illisible en review)
- ❌ Snapshots avec timestamps / IDs aléatoires (flaky)

### 6.2 Snapshots Playwright visual

#### Structure

```
e2e/visual/__snapshots__/
├── chromium-fr/
│   ├── home-desktop.png
│   └── home-mobile.png
├── chromium-ar/
│   ├── home-desktop.png
│   └── home-mobile.png
└── chromium-en/
    ├── home-desktop.png
    └── home-mobile.png
```

#### Storage Git LFS

Les `.png` sont volumineuses, stockées en Git LFS :

```bash
# Setup une fois
git lfs install
git lfs track "**/*.png"
git add .gitattributes
```

#### Update workflow

```bash
# 1. Run pour voir les diffs
pnpm test:visual

# 2. Review les diffs (HTML report)
pnpm exec playwright show-report

# 3. Si refactor légitime, update
pnpm test:visual -- --update-snapshots

# 4. Review le diff Git LFS
git diff -- '*.png' | head -20

# 5. Commit
git add e2e/visual/__snapshots__/
git commit -m "chore(i18n-visual): update baseline after refactor X"
```

### 6.3 Coverage thresholds

#### Configuration

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      thresholds: {
        'src/lib/i18n/**/*.ts': {
          lines: 90,
          branches: 85,
          functions: 90,
          statements: 90,
        },
        'src/components/i18n/**/*.tsx': {
          lines: 85,
          branches: 80,
          functions: 85,
          statements: 85,
        },
        'src/app/api/i18n/**/*.ts': {
          lines: 90,
          branches: 85,
          functions: 90,
          statements: 90,
        },
      },
    },
  },
});
```

#### Script de check

```bash
node scripts/check-i18n-coverage.mjs
```

Output :
```
✓ src/lib/i18n/ → 92% lines (target 90%)
✓ src/components/i18n/ → 87% lines (target 85%)
✗ src/app/api/i18n/admin/upsert-message → 88% lines (target 90%, gap -2%)

Failed: 1 file below threshold
```

### 6.4 Coverage des clés i18n

#### Endpoint

```bash
curl http://localhost:3000/api/i18n/coverage | jq
```

#### Script CLI

```bash
node scripts/coverage-translations.mjs
```

Output :
```
FR : 100% (542 / 542)  ✓
AR :  78% (423 / 542)  ⚠ Target 90%
EN :  45% (245 / 542)  ⚠ Target 90%

Missing keys AR:
- marketing.hero.cta_v2
- legal.cgv.section_5.body
... (119 total)
```

---

## Section 7 — Reporting et exports

### 7.1 Export résultats CI

```bash
# JUnit XML
pnpm test:i18n:all -- --reporter=junit --outputFile=junit-i18n.xml

# HTML report (Playwright)
pnpm test:e2e -- --reporter=html
open playwright-report/index.html

# JSON coverage
pnpm test:coverage -- --reporter=json --outputFile=coverage.json
```

### 7.2 Génération rapport synthèse

Script `scripts/generate-batterie-report.mjs` :

```bash
node scripts/generate-batterie-report.mjs \
  --waves=.test-execution/ \
  --output=docs/i18n-strategy-2026-05/11-test-execution/rapport-2026-MM-DD.md
```

Output : un `.md` avec sections obligatoires (cf. `communication-templates.md` Template 3).

### 7.3 Export pour stakeholder (non-technique)

```bash
node scripts/generate-batterie-report.mjs \
  --format=executive \
  --output=rapport-exec-2026-MM-DD.pdf
```

Produit un PDF avec :
- One-pager exec summary
- KPIs visuels (charts)
- Décisions GO/NO-GO recommandées

### 7.4 Archivage long terme

```bash
# Archive complet
tar czf .test-execution-2026-MM-DD.tar.gz \
  .test-execution/ \
  coverage/ \
  playwright-report/ \
  test-results/ \
  junit-i18n.xml

# Upload vers stockage
aws s3 cp .test-execution-2026-MM-DD.tar.gz s3://femiglow-test-archive/
# OU
gh release upload v1.0.0-i18n .test-execution-2026-MM-DD.tar.gz
```

### 7.5 Slack notification

Webhook custom :

```bash
node scripts/notify-slack.mjs \
  --report=docs/i18n-strategy-2026-05/11-test-execution/rapport-2026-MM-DD.md \
  --channel=#dev-femiglow
```

---

## Section 8 — CI GitHub Actions

### 8.1 Structure des workflows

```
.github/workflows/
├── i18n-tests.yml          # PR check (wave 1-3 + smoke wave 4)
├── i18n-tests-full.yml     # Nightly (toutes waves)
├── i18n-tests-visual.yml   # On-demand (visual regression)
└── i18n-coverage.yml       # Daily (coverage clés)
```

### 8.2 Trigger PR

`i18n-tests.yml` :
```yaml
on:
  pull_request:
    paths:
      - 'apps/web/src/lib/i18n/**'
      - 'apps/web/src/components/i18n/**'
      - 'apps/web/messages/**'
      - 'apps/web/src/app/api/i18n/**'
      - 'apps/web/middleware.ts'

jobs:
  wave1-foundation: ...
  wave2-component: ...
  wave3-integration: ...
  wave4-smoke: ...
```

### 8.3 Lecture des résultats CI

#### Sur GitHub PR

- Status checks en bas de la PR :
  - `i18n-tests / wave1-foundation` ✓
  - `i18n-tests / wave2-component` ✓
  - `i18n-tests / wave3-integration` ✗ ← cliquer pour détails

#### Logs détaillés

```bash
gh run view {run_id} --log
gh run view {run_id} --log-failed  # juste les fails
```

#### Artifacts

```bash
# Lister
gh run view {run_id} --json artifacts

# Télécharger
gh run download {run_id} --name playwright-report
unzip playwright-report.zip
open playwright-report/index.html
```

### 8.4 Re-run un workflow

```bash
# Re-run le workflow entier
gh run rerun {run_id}

# Re-run uniquement les jobs failed
gh run rerun {run_id} --failed
```

### 8.5 Debug workflow localement

Tool `act` (run GitHub Actions localement) :

```bash
brew install act

# Run le workflow
act -W .github/workflows/i18n-tests.yml -j wave1-foundation
```

---

## Section 9 — Communication résultats

### 9.1 Daily standup batterie

Format Slack `#dev-femiglow` quotidien (cf. `communication-templates.md` Template 1) :

```
Batterie i18n — Daily J5 (2026-MM-DD)

Wave en cours : 4 (E2E)

Hier
- Wave 3 closée : green ✓
- 2 P1 fermés
- 3 P1 ouverts

Aujourd'hui
- Wave 4 lancement (matin)
- Wave 5 visual prévu PM si W4 green

Tableau
- P0 : 0
- P1 : 3
- P2 : 8
- Coverage : 91% (cible 90%)

Blockers : aucun
```

### 9.2 Weekly à founder

Format email/Notion hebdomadaire (cf. `communication-templates.md` Template 2) :

```
Subject: Batterie i18n W{N} — Status & KPIs

Bonjour {founder},

Récap semaine {N}/2 :

Avancement
- Waves complétées : 5/8 ({pct}%)
- Tests verts : 423/450 (94%)
- Coverage helpers : 92% (cible 90%)
- Coverage components : 86% (cible 85%)

Bugs trouvés et fixés
- P0 fixés : 1 (XSS sur messages ICU)
- P1 fixés : 4 (RTL switch, focus order, etc.)
- P2 fixés : 7

Bugs ouverts
- P0 : 0
- P1 : 2 (ETA J+3)
- P2 : 6

Risques
- Wave 5 (visual) : baseline AR à régénérer après refactor checkout
- Wave 7 (perf) : Lighthouse AR à 88/100, gap -2 à combler

Prochaine semaine
- Wave 6 (a11y) + Wave 7 (perf) + Wave 8 (robustness)
- Signoff phase 6 visé J+10

Décisions requises de votre part : aucune cette semaine.
```

### 9.3 Annonce dans #dev-femiglow

```
Wave 4 (E2E) PASSED en 22 min ✓
150 tests verts / 150
0 flaky sur 3 runs
On passe Wave 5 demain matin.
```

### 9.4 Rapport final

Cf. `communication-templates.md` Template 3.

### 9.5 One-pager exec

Cf. `communication-templates.md` Template 5.

---

## Section 10 — On-call et escalade

### 10.1 Pendant la batterie (Phase 6)

| Rôle | Personne | Disponibilité |
|---|---|---|
| Pilote batterie | Dev (lead exécution) | 100% temps |
| Backup pilote | Autre dev | 50% temps |
| Lead technique | Architecte / lead | Sur appel |
| Founder | Founder | Daily checkpoint + escalade |
| QA | QA dédié | 80% pendant Phase 6 |

### 10.2 Critères d'escalade

#### Escalade au lead technique

- P0 non résolu sous 24h
- Wave bloquée > 48h sans hypothèse cause
- Découverte d'un risque non documenté (architecture, sécurité)
- Désaccord sur la sévérité d'un bug

#### Escalade au founder

- Risque de glissement > 1 semaine sur Phase 6
- Découverte d'un budget non prévu (lib payante, infra)
- P0 en production (si déjà shipé en canary)
- Décision GO/NO-GO sur exit criteria non atteints

### 10.3 Channels

- **Daily ops** : Slack `#dev-femiglow`
- **Escalade lead** : Slack DM @lead-tech
- **Escalade founder** : email + Slack DM @founder
- **Incident prod** : page on-call via PagerDuty / OpsGenie

### 10.4 Disponibilité on-call (canary phase 7)

| Période | On-call primary | Backup |
|---|---|---|
| Canary 10% (J1) | Dev lead | Lead tech |
| Canary 50% (J3-J4) | Dev lead | Lead tech |
| Canary 100% (J5-J7) | Rotation équipe | Lead tech |
| Stabilisation S+1 | Rotation équipe | Lead tech |
| Stabilisation S+2 | Rotation équipe | — |

---

## Annexes

### Annexe A — Cheat sheet commandes

```bash
# Setup
fnm use && pnpm install
pnpm exec playwright install --with-deps chromium
pnpm --filter @femiglow/web db:test:setup

# Run waves
pnpm test:i18n:wave1   # ~2 min
pnpm test:i18n:wave2   # ~5 min
pnpm test:i18n:wave3   # ~6 min
pnpm test:i18n:wave4   # ~25 min
pnpm test:i18n:wave5   # ~8 min
pnpm test:i18n:wave6   # ~4 min
pnpm test:i18n:wave7   # ~5 min
pnpm test:i18n:wave8   # ~10 min

# All
pnpm test:i18n:all       # séquentiel
pnpm test:i18n:parallel  # CI

# Utilitaires
pnpm test:i18n:retry-failed
pnpm test:i18n:update-snapshots
pnpm test:i18n:coverage
pnpm test:i18n:bail

# Debug
pnpm test:e2e -- --ui
pnpm test:e2e -- --headed --debug
pnpm exec playwright show-trace test-results/.../trace.zip
pnpm exec playwright show-report

# Lint / type
pnpm --filter @femiglow/web lint:i18n
pnpm --filter @femiglow/web typecheck

# DB
pnpm --filter @femiglow/web db:test:reset
pnpm --filter @femiglow/web db:test:seed

# Reporting
node scripts/generate-batterie-report.mjs
node scripts/notify-slack.mjs
```

### Annexe B — Variables d'environnement

```bash
# Test env
DATABASE_URL=postgresql://localhost:5432/femiglow_dev
DATABASE_URL_TEST=postgresql://localhost:5432/femiglow_test
TZ=Africa/Casablanca
NEXT_TELEMETRY_DISABLED=1

# Playwright
PLAYWRIGHT_BASE_URL=http://localhost:3000
CI=false  # true en CI pour 4 workers

# Fuzz
FAST_CHECK_SEED=42
FAST_CHECK_NUM_RUNS=1000

# Lighthouse
LHCI_URL=http://localhost:3000
LHCI_PERF_THRESHOLD=90
LHCI_A11Y_THRESHOLD=95

# Coverage
COVERAGE_LINES_THRESHOLD=90
COVERAGE_BRANCHES_THRESHOLD=85

# Slack
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
```

### Annexe C — Glossaire commandes pnpm

| Commande | Équivalent direct | Description |
|---|---|---|
| `pnpm --filter @femiglow/web test:i18n:wave1` | `cd apps/web && vitest run src/lib/i18n` | Wave 1 foundation |
| `pnpm --filter @femiglow/web test:e2e` | `cd apps/web && playwright test` | Tous les E2E |
| `pnpm --filter @femiglow/web db:test:reset` | `cd apps/web && drizzle-kit push:pg --reset` | Reset DB test |
| `pnpm --filter @femiglow/web setup:doctor` | script Node interactif | Vérifie env |
| `pnpm --filter @femiglow/web lint:i18n` | `cd apps/web && eslint --rule i18n/* src` | Lint i18n |

### Annexe D — Troubleshooting

| Symptôme | Cause probable | Solution |
|---|---|---|
| `EADDRINUSE :3000` | Serveur déjà lancé | `lsof -i :3000 \| awk '$1=="next"{print $2}' \| xargs kill` |
| `Postgres connection refused` | DB pas démarrée | `brew services start postgresql@16` |
| `Playwright timeout 30s` | Serveur lent ou pas démarré | Vérifier `pnpm dev` actif, ou hausser `timeout` config |
| `Snapshot diff inattendu` | Police, animation, ou data dynamique | Mask l'élément ou attendre `networkidle` |
| `Coverage drop -3%` | Test supprimé sans remplacement | Vérifier coverage avant push, ajouter tests |
| `Test passe local, fail CI` | Différence env (TZ, locale, browser version) | Reproduire CI via Docker |
| `Pixel diff 0.6% > threshold` | Sub-pixel rendering ou font | Hausser threshold ou utiliser font local |
| `axe-core violation contrast` | Couleur non WCAG AA | Vérifier color picker + design system |
| `Flaky 2/3 runs` | Race condition | Remplacer `waitForTimeout` par `waitForSelector` |
| `next-intl missing key` | Clé pas dans messages.json | Lancer `pnpm i18n:check` (script de drift detection) |

### Annexe E — Commandes Git utiles

```bash
# Tag baseline pré-batterie
git tag -a i18n-baseline-2026-MM-DD -m "Baseline before batterie"
git push origin --tags

# Tag passed post-batterie
git tag -a i18n-batterie-passed-2026-MM-DD -m "Batterie passed"
git push origin --tags

# Revenir à baseline si pollution
git reset --hard i18n-baseline-2026-MM-DD  # ATTENTION destructif

# Cherry-pick un fix depuis une autre branche
git cherry-pick {commit_hash}

# Lister les commits depuis baseline
git log i18n-baseline-2026-MM-DD..HEAD --oneline

# Stat changement depuis baseline
git diff --stat i18n-baseline-2026-MM-DD..HEAD
```

### Annexe F — Liens et références

- Stratégie tests : [`../07-tests/strategy.md`](../07-tests/strategy.md)
- Plan batterie : [`./plan-batterie-tests.md`](./plan-batterie-tests.md)
- Boucle correction : [`./boucle-correction.md`](./boucle-correction.md)
- Checklist vérification : [`./verification-checklist.csv`](./verification-checklist.csv)
- Templates communication : [`./communication-templates.md`](./communication-templates.md)
- Matrice tests : [`../07-tests/test-matrix.csv`](../07-tests/test-matrix.csv)
- Phases plan d'action : [`../08-plan-action/phases.md`](../08-plan-action/phases.md)
- Vitest docs : https://vitest.dev/
- Playwright docs : https://playwright.dev/
- next-intl testing : https://next-intl-docs.vercel.app/docs/workflows/testing
- axe-core rules : https://dequeuniversity.com/rules/axe/4.10
- fast-check : https://fast-check.dev/
