# Phase 5 — E2E mocked

## Objectif
12 specs Playwright couvrant les scénarios S01..S12 (sauf S09/S13/S14/S16-S20 traités ailleurs).

## Specs à créer

Voir `test-battery/04-playwright-mocked-plan.md`.

## Workflow par spec
1. `registerPublishMocks(page, opts)` au début
2. `driveToPublishStep(page)` pour atteindre l'écran cible
3. Actions UI (click, type)
4. Assertions sur UI + état mock (state.calls.X count)

## Durée
~2 j-p

## Commande
```bash
PLAYWRIGHT_BASE_URL=http://127.0.0.1:8012 \
  npx playwright test e2e/social-publishing/*.spec.ts --grep -v @live
```

## Acceptance
- [ ] 12 specs créées
- [ ] ~53 tests verts
- [ ] < 60s run total
