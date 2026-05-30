# Test Battery Runbook — Execution guide

> Suite pratique pour exécuter et corriger la batterie complète.

## Étapes (séquentielles)

### Étape 1 — Pré-flight
```bash
cd /var/www/femiglow-staging/apps/web
node -v && pnpm -v && npx playwright --version
PGPASSWORD=$DB_PASSWORD psql -h 127.0.0.1 -U femiglow -d staging_femiglow -c "\dt social_*"
pm2 status web
```

### Étape 2 — Unit
```bash
pnpm vitest run src/lib/social-publishing src/lib/content-studio/postiz.test.ts --reporter=verbose 2>&1 | tee /tmp/sp-unit.log
```

### Étape 3 — Component
```bash
pnpm vitest run \
  src/components/admin/content-studio-v2/create/PublishActionGroup.test.tsx \
  src/components/admin/content-studio-v2/plan \
  src/components/admin/content-studio-v2/home/AccountHealthCard.test.tsx \
  src/components/admin/content-studio-v2/library/LibraryClient.test.tsx \
  --reporter=verbose 2>&1 | tee /tmp/sp-component.log
```

### Étape 4 — Contract
```bash
pnpm vitest run src/test/api-contracts/social-publishing-*.contract.test.ts --reporter=verbose 2>&1 | tee /tmp/sp-contract.log
```

### Étape 5 — Build + type-check
```bash
pnpm run type-check && pnpm run build 2>&1 | tee /tmp/sp-build.log
pm2 restart web && sleep 6
```

### Étape 6 — E2E mocked
```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 \
  npx playwright test e2e/social-publishing/*.spec.ts --grep -v @live \
  --reporter=list --project=chromium 2>&1 | tee /tmp/sp-e2e.log
```

### Étape 7 — Cross-cutting
```bash
npx playwright test \
  e2e/social-publishing/a11y.spec.ts \
  e2e/social-publishing/dark-mode.spec.ts \
  e2e/social-publishing/responsive.spec.ts \
  e2e/social-publishing/keyboard.spec.ts \
  --reporter=list --project=chromium
```

### Étape 8 — Live (opt-in, prod-like)
```bash
export E2E_LIVE_POSTIZ=1
export POSTIZ_API_KEY=<...>
export E2E_LIVE_ACCOUNT_ID=<...>
export E2E_LIVE_CLEANUP=1

PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 \
  npx playwright test e2e/social-publishing/live-instagram-alfenna.spec.ts \
  --grep @live --workers=1
```

### Étape 9 — Coverage
```bash
pnpm vitest run --coverage \
  src/components/admin/content-studio-v2 \
  src/lib/social-publishing \
  src/lib/content-studio/postiz.ts \
  src/test/api-contracts/social-publishing-*.contract.test.ts
```

### Étape 10 — Anti-flake (3 runs identiques)
```bash
for i in 1 2 3; do
  echo "=== Run $i ==="
  npx playwright test e2e/social-publishing/*.spec.ts --grep -v @live --reporter=line | tail -3
done
```

## Boucle de correction

```
Pour chaque échec :
1. Identifier nature : bug code / bug test / contrat / flake
2. Fix code first, sinon test
3. Re-run isolé → module → full
4. Documenter dans REGRESSION_NOTES.md
```

## Done criteria

- [ ] Étapes 1-9 vertes
- [ ] Étape 10 : 3 runs identiques
- [ ] Coverage atteint
- [ ] Étape 8 : post AlFenna visible + cleanup OK (si lancé)
- [ ] REGRESSION_NOTES.md à jour
