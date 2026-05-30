# Phase 8 — Correction loop + coverage

## Objectif
Verrouiller les acquis. Tous tests passent, anti-flake validé, coverage atteinte.

## Process

### 1. Run complet
```bash
# Unit + component + contract
pnpm vitest run src/lib/social-publishing src/lib/content-studio/postiz.test.ts \
  src/components/admin/content-studio-v2 \
  src/test/api-contracts/social-publishing-*.contract.test.ts \
  --reporter=verbose 2>&1 | tee /tmp/sp-full.log

# E2E mocked
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 \
  npx playwright test e2e/social-publishing/*.spec.ts --grep -v @live \
  --reporter=list 2>&1 | tee /tmp/sp-e2e.log
```

### 2. Loop de correction
```
Pour chaque échec :
1. Identifier nature : bug code / bug test / contrat dérivé / flake
2. Localiser via stack trace
3. Fix code en priorité
4. Re-run isolé → module → full
5. Documenter dans REGRESSION_NOTES.md
```

### 3. Coverage check
```bash
pnpm vitest run --coverage src/lib/social-publishing src/components/admin/content-studio-v2/create/PublishActionGroup.tsx src/components/admin/content-studio-v2/plan
```

Comparer aux targets de `06-coverage-targets.md`. Si écart, ajouter tests ciblés.

### 4. Anti-flake (3 runs identiques)
```bash
for i in 1 2 3; do
  echo "=== Run $i ==="
  npx playwright test e2e/social-publishing/*.spec.ts --grep -v @live --reporter=line | tail -3
done
```

3 runs doivent donner exactement le même résultat. Sinon → identifier flake → fix ou quarantine.

### 5. REGRESSION_NOTES.md
Pour chaque fix non-trivial :
```md
## YYYY-MM-DD — {brief}
- Symptom: ...
- Root cause: ...
- Fix: ...
- Files: ...
- Coverage: ...
```

## Durée
~0.5 j-p

## Acceptance
- [ ] 0 fail sur toute la suite
- [ ] Coverage targets atteintes
- [ ] 3 runs anti-flake identiques
- [ ] REGRESSION_NOTES.md à jour
- [ ] PR ouverte avec lien vers ce dossier
