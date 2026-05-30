# Test Battery Runbook — Content Studio v2 Create

> **Objectif** : exécuter la batterie complète de tests, gérer les échecs via boucle de correction, atteindre 0 fail + couverture cible.

## Pré-requis

```bash
cd /var/www/femiglow-staging/apps/web

# Vérifier versions
node -v          # >= 18
pnpm vitest --version
npx playwright --version

# Verifier env de test
cat .env.test    # doit contenir CONTENT_STUDIO_V2_MOCK_MODE=true

# Verifier que la branche est propre
git status
```

## Étape 1 — Tests unit (services + hooks + registry)

```bash
pnpm vitest run \
  src/lib/content-studio-v2 \
  src/lib/content-studio/services \
  src/lib/content-studio/state-machine.ts \
  --reporter=verbose 2>&1 | tee /tmp/test-unit.log

# Attendu : 0 fail
# Si fail :
#   1. Identifier le fichier et la cause
#   2. Si bug code → fix code, re-run
#   3. Si test obsolete → fix test, re-run
```

## Étape 2 — Tests composants

```bash
pnpm vitest run \
  src/components/admin/content-studio-v2/create \
  src/components/admin/content-studio-v2/primitives \
  --reporter=verbose 2>&1 | tee /tmp/test-component.log

# Attendu : 0 fail
```

## Étape 3 — Tests contract API

```bash
pnpm vitest run \
  src/test/api-contracts/content-studio-v2-*.contract.test.ts \
  src/test/msw/content-studio-handlers.contract.test.ts \
  --reporter=verbose 2>&1 | tee /tmp/test-contract.log

# Attendu : 0 fail
```

## Étape 4 — Type check + build

```bash
pnpm run type-check 2>&1 | tee /tmp/typecheck.log
pnpm run build 2>&1 | tee /tmp/build.log

# Attendu : 0 erreur TS
```

## Étape 5 — Tests E2E Playwright

```bash
# Redémarrer le serveur en mock mode
CONTENT_STUDIO_V2_MOCK_MODE=true pm2 restart web
sleep 5

# Vérifier que la page est servie
curl -s -o /dev/null -w "%{http_code}" http://localhost:8012/admin/content-studio-v2/create
# Attendu : 200 ou 307 (redirect auth)

# Exécuter les E2E
npx playwright test \
  e2e/content-studio-v2/create-*.spec.ts \
  --reporter=html \
  --workers=2 \
  2>&1 | tee /tmp/test-e2e.log

# Attendu : 0 fail
# Rapport HTML : playwright-report/index.html
```

## Étape 6 — A11y + Visual regression

```bash
npx playwright test e2e/content-studio-v2/create-a11y.spec.ts --reporter=list
npx playwright test e2e/content-studio-v2/create-dark-mode.spec.ts --update-snapshots=missing
npx playwright test e2e/content-studio-v2/create-responsive.spec.ts
```

## Étape 7 — Couverture

```bash
pnpm vitest run \
  --coverage \
  src/components/admin/content-studio-v2/create \
  src/lib/content-studio-v2 \
  src/lib/content-studio \
  --reporter=verbose

# Rapport HTML : coverage/index.html

# Cibles :
# - Composants /create : ≥ 85% lignes
# - Services content-studio* : ≥ 80% lignes
# - State/hooks : ≥ 90% lignes
# - Global : ≥ 75% lignes
```

## Étape 8 — Anti-flake

```bash
# Lancer 3× la suite E2E pour détecter les tests instables
for i in 1 2 3; do
  echo "Run $i"
  npx playwright test e2e/content-studio-v2/create-*.spec.ts --reporter=line 2>&1 | tail -5
done

# Attendu : exactement les mêmes résultats les 3 fois
```

## Boucle de correction

À chaque échec :

```
┌─────────────────────────────────────────────────┐
│ 1. Lire stack trace + ligne                     │
│ 2. Identifier la nature :                       │
│    a. Bug code         → fix code               │
│    b. Bug test         → fix test               │
│    c. Spec dérivée     → update test + spec.md  │
│    d. Flake intermittent → ajouter wait/retry  │
│ 3. Re-run le fichier isolé                      │
│ 4. Re-run le module concerné                    │
│ 5. Re-run la suite complète                     │
│ 6. Documenter dans REGRESSION_NOTES.md          │
└─────────────────────────────────────────────────┘
```

## Critères de done

- [ ] Étapes 1-5 : 0 fail
- [ ] Étape 6 : 0 a11y violation critical, snapshots verts
- [ ] Étape 7 : couvertures cibles atteintes
- [ ] Étape 8 : run 3× identique

## Reporting

Après la batterie complète :

```bash
echo "=== Test Battery Report — $(date) ===" > /tmp/test-report.md
echo "" >> /tmp/test-report.md
echo "## Unit" >> /tmp/test-report.md
grep -E "(PASS|FAIL|Tests:)" /tmp/test-unit.log | tail -10 >> /tmp/test-report.md
echo "" >> /tmp/test-report.md
# … répéter pour chaque suite
cat /tmp/test-report.md
```
