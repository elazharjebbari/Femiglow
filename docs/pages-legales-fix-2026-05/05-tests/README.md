# 05 — Tests (vitest + MSW + Playwright)

## Fichiers

| Fichier | Contenu |
|---|---|
| [`unit-vitest.md`](./unit-vitest.md) | Tests unitaires Vitest (~12 tests) |
| [`integration-msw.md`](./integration-msw.md) | Tests intégration MSW + Drizzle (~5 tests) |
| [`e2e-playwright.md`](./e2e-playwright.md) | Specs `@legal-purity` (5 specs) + smoke |
| [`regression-suite.md`](./regression-suite.md) | Tests existants à ne pas casser |

## Pyramide de tests

```
              ┌──────────────┐
              │  Playwright  │  5 specs @legal-purity + 3 a11y
              └──────────────┘
            ┌──────────────────┐
            │   MSW intégration│  5 tests
            └──────────────────┘
        ┌──────────────────────────┐
        │     Vitest unit          │  12 tests
        └──────────────────────────┘
```

## Commandes

```bash
# Unit
pnpm vitest run src/lib/legal/

# Intégration
pnpm vitest run src/test/integration/legal-*

# Playwright
pnpm playwright test --grep @legal-purity

# Smoke staging
pnpm tsx scripts/smoke-legal-purity.ts --url https://staging.femiglow-maroc.com
```

## DoD tests

- [ ] 12 tests vitest unit verts
- [ ] 5 tests MSW intégration verts
- [ ] 5 specs Playwright `@legal-purity` verts
- [ ] 3 specs Playwright `@a11y` verts
- [ ] Smoke staging exit 0
- [ ] Coverage ≥ 85% sur fichiers modifiés
- [ ] 0 régression sur tests existants (baseline maintenue)
