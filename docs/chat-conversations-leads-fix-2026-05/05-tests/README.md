# 05 — Tests (vitest + MSW + Playwright)

Stratégie de tests à 4 niveaux pour garantir le fix non-régressif.

## Fichiers

| Fichier | Contenu | Cible |
|---|---|---|
| [`unit-vitest.md`](./unit-vitest.md) | Tests unitaires Vitest pour queries, repos, cleanup, feature flag | ~18 tests |
| [`integration-msw.md`](./integration-msw.md) | Tests intégration MSW + Drizzle in-memory | ~6 tests |
| [`e2e-playwright.md`](./e2e-playwright.md) | Specs `@chat-purity` | ~4 specs |
| [`regression-suite.md`](./regression-suite.md) | Liste des tests existants à NE PAS casser | référence |

## Stratégie pyramide

```
              ┌────────────┐
              │ Playwright │  4 specs (@chat-purity)
              └────────────┘
            ┌──────────────────┐
            │   MSW intégration│  6 tests
            └──────────────────┘
        ┌──────────────────────────┐
        │     Vitest unit          │  18 tests
        └──────────────────────────┘
```

- **Vitest unit** : rapide (<1s par fichier), mocks fins de la DB.
- **MSW intégration** : test des routes API avec faux network, vraie DB in-memory.
- **Playwright E2E** : flow utilisateur complet, vrai navigateur, vraie DB locale.

## Commandes

```bash
# Tests unitaires (rapide)
pnpm vitest run src/lib/chat/admin/queries.test.ts
pnpm vitest run src/lib/chat/repos/session.kind.test.ts
pnpm vitest run src/lib/chat/admin/cleanup.test.ts

# Tous les tests vitest (régression complète)
pnpm vitest run

# Tests Playwright @chat-purity
pnpm playwright test --grep @chat-purity

# Smoke staging
pnpm tsx scripts/smoke-chat-purity.ts --url https://staging.femiglow-maroc.com
```

## Critères d'acceptation tests

- [ ] 100 % des nouveaux tests vitest verts
- [ ] 0 régression sur la suite vitest existante (7159 tests verts à maintenir)
- [ ] 4 specs Playwright `@chat-purity` verts
- [ ] Smoke staging exit 0
- [ ] Coverage des nouvelles lignes ≥ 85 % (vitest --coverage)
