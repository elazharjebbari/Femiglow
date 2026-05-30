# Phase 7 — Batterie de tests

## Objectif
Verrouiller le périmètre avec une couverture de tests robuste et exécutable de bout en bout.

## Durée estimée
2 j-p (dev tests) + 1 j (boucle de correction)

## Dépendances
- Phases 1 à 6 terminées

## Exécution

Suivre `test-battery/00-runbook.md`. Synthèse :

### Étape 1 — Unit (1h)
```bash
pnpm vitest run src/lib/content-studio-v2 src/lib/content-studio/services src/lib/content-studio/state-machine.ts
```
Cible : ~80 tests, 0 fail.

### Étape 2 — Component (1h)
```bash
pnpm vitest run src/components/admin/content-studio-v2/create
```
Cible : ~140 tests, 0 fail.

### Étape 3 — Contract (30 min)
```bash
pnpm vitest run src/test/api-contracts/content-studio-v2-*.contract.test.ts
```
Cible : ~72 tests, 0 fail.

### Étape 4 — Type-check + build (15 min)
```bash
pnpm run type-check
pnpm run build
```
Cible : 0 erreur TS.

### Étape 5 — E2E (45 min)
```bash
pm2 restart web && sleep 5
npx playwright test e2e/content-studio-v2/create-*.spec.ts
```
Cible : ~59 tests, 0 fail.

### Étape 6 — Cross-cutting (30 min)
```bash
npx playwright test e2e/content-studio-v2/create-a11y.spec.ts
npx playwright test e2e/content-studio-v2/create-dark-mode.spec.ts
npx playwright test e2e/content-studio-v2/create-responsive.spec.ts
npx playwright test e2e/content-studio-v2/create-keyboard.spec.ts
```

### Étape 7 — Couverture
```bash
pnpm vitest run --coverage src/components/admin/content-studio-v2/create src/lib/content-studio-v2 src/lib/content-studio src/app/api/admin/content-studio
```
Cible : cf `test-battery/05-coverage-targets.md`.

### Étape 8 — Anti-flake (30 min)
```bash
for i in 1 2 3; do
  echo "=== Run $i ==="
  npx playwright test e2e/content-studio-v2/create-*.spec.ts --reporter=line | tail -5
done
```
Cible : résultats identiques 3 fois.

## Boucle de correction

Pour chaque échec :

```
1. Lire stack trace
2. Identifier nature (bug code / test obsolete / flake)
3. Corriger
4. Re-run isolé puis module puis full
5. Documenter dans test-battery/REGRESSION_NOTES.md
```

## Rapport final

```bash
echo "## Test Battery Report — $(date)" > /tmp/test-report.md
echo "" >> /tmp/test-report.md
echo "### Unit : $(grep -c PASS /tmp/test-unit.log) PASS / $(grep -c FAIL /tmp/test-unit.log) FAIL" >> /tmp/test-report.md
echo "### Component : ..." >> /tmp/test-report.md
echo "### Contract : ..." >> /tmp/test-report.md
echo "### E2E : ..." >> /tmp/test-report.md
echo "### Coverage : $(grep 'All files' coverage/lcov-report/index.html | head -1)" >> /tmp/test-report.md
```

## Acceptance globale

- [ ] Étapes 1-5 : 0 fail
- [ ] Étape 6 : 0 violation a11y critical
- [ ] Étape 7 : couvertures cibles atteintes
- [ ] Étape 8 : 3 runs identiques
- [ ] REGRESSION_NOTES.md à jour
