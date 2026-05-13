# Tests — Stratégie & batterie complète

> Une batterie de tests n'est pas une checklist d'auto-rassurance. Elle est ce qui transforme « ça marche chez moi » en « ça marchera chez 100 000 visiteurs vendredi soir ». Notre stack : **Vitest (unit), Vitest+supertest (intégration), Playwright (E2E), MSW (mocks providers), Lighthouse CI (perf), axe-core (a11y), k6 (load)**. Et un test ULTIME qui fait tout en un.

## Pyramide de tests

```
                      /\
                     /  \   ULTIMATE (1 test, 30 min)
                    /----\
                   /      \   E2E Playwright (~20 scenarios)
                  /--------\
                 /          \  Integration (~50 tests)
                /------------\
               /              \  Unit Vitest (~500 tests)
              /________________\
```

| Niveau | Outils | Volume | Durée locale | Durée CI |
|---|---|---|---|---|
| Unit | Vitest + jsdom | ~500 tests | < 30s | < 1 min |
| Intégration | Vitest + supertest + Postgres test container | ~50 tests | < 2 min | < 4 min |
| MSW providers | Vitest + msw | ~30 tests | inclus dans unit | inclus |
| E2E | Playwright | ~20 scénarios | < 5 min | < 10 min |
| A11y | axe-core via Playwright | ~10 audits | < 1 min | inclus E2E |
| Perf | Lighthouse CI | 3 pages | < 2 min | < 5 min |
| Load | k6 | 1 scénario 100 SSE | 5 min | manuel |
| **ULTIMATE** | Playwright + chaos | 1 méga-scénario | 30 min | nightly |

## Fichiers de cette section

- [`README.md`](README.md) — ce fichier
- [`test-strategy.md`](test-strategy.md) — pyramide, coverage targets, chaos engineering
- [`unit-matrix.csv`](unit-matrix.csv) — matrice tests unit par module
- [`integration-matrix.csv`](integration-matrix.csv) — matrice tests intégration
- [`e2e-playwright.md`](e2e-playwright.md) — scénarios Playwright complets
- [`msw-handlers.md`](msw-handlers.md) — handlers MSW pour mocker tous providers LLM + tools
- [`ultimate-pipeline-test.md`](ultimate-pipeline-test.md) — **le test ULTIME validant toute la pipeline**

## Commandes principales

```bash
# Tests unit (rapide, en watch pendant dev)
npm test

# Tests unit + coverage
npm run test:unit -- --coverage

# Tests intégration (besoin Postgres test container)
npm run test:integration

# Tests E2E (besoin Vercel preview ou local server)
npm run test:e2e

# Tests E2E spécifique
npm run test:e2e -- --grep "greeting"

# Test a11y dédié
npm run test:a11y

# Test perf Lighthouse
npm run test:perf

# Load test
npm run test:load

# Test ULTIMATE (nightly CI uniquement, ou manuel)
npm run test:ultimate
```

## Coverage targets V5 ship

| Module | Cible coverage | Bloquant CI |
|---|---|---|
| `lib/chat/services/intent/*` | 90%+ | ✅ |
| `lib/chat/services/retrieval/*` | 85%+ | ✅ |
| `lib/chat/services/tools/*` | 95%+ | ✅ |
| `lib/chat/services/canned/*` | 90%+ | ✅ |
| `lib/chat/services/orchestrator/*` | 80%+ | ✅ |
| `lib/chat/providers/*` | 75%+ | ⚠️ warn |
| `lib/chat/store/*` | 85%+ | ✅ |
| `lib/chat/errors/*` | 95%+ | ✅ |
| `components/chat/*` | 70%+ | ⚠️ warn |
| `app/api/chat/*` | 80%+ | ✅ (via integration) |
| **Global** | **80%+** | ✅ |

## Tests bloquants pour ship V5

Voir `09-plan-developpement/definition-of-done.md` section "DoD — Release/Ship".

Résumé :
- ✅ CI verte (lint + type + unit + integration + build)
- ✅ Test ULTIMATE pass
- ✅ Coverage ≥ 80%
- ✅ Axe-core 0 violation niveau "serious" ou "critical"
- ✅ Lighthouse CI score ≥ 90 mobile

## Chaos engineering

Trois scénarios de chaos répétés en nightly CI :

1. **Provider chaos** : on kill OpenAI à 50% des appels via MSW.
2. **Network chaos** : on ajoute 2s latency aléatoire.
3. **DB chaos** : on ferme connexions Postgres pendant 30s.

Le système doit :
- Continuer à servir (service level dégradé OK).
- Aucune corruption data.
- Recovery automatique sous 1 min.

Détails dans `test-strategy.md` section Chaos.

## Conventions tests

### Naming

```typescript
// lib/chat/services/intent/__tests__/regex-layer.test.ts
describe('regex-layer / detectIntentByRegex', () => {
  it('matches pricing intent in french', () => { ... });
  it('returns null for non-matching input', () => { ... });
  it('handles darija with 3-7-9 transliteration', () => { ... });
});
```

### Arrange / Act / Assert

```typescript
it('serves canned pair with continuity note injected', async () => {
  // Arrange
  const session = await createSession({ language: 'fr', audience: 'b2c' });
  const pair = await seedCannedPair('kit-price-question', 'fr');

  // Act
  const result = await servePairByKey(session.id, pair.key);

  // Assert
  expect(result.scriptedReply).toMatchObject({ key: pair.key, language: 'fr' });
  expect(result.ephemeralLLMNote).toContain('Une suggestion vient d\'être servie');
});
```

### Pas de tests fragiles

- ❌ Tests qui dépendent de timing (`setTimeout` fixe).
- ❌ Tests qui dépendent d'ordre d'exécution.
- ❌ Tests qui partagent état (BDD globale non isolée).
- ❌ Tests qui mockent leur propre code (juste les frontières).

### Toujours valider

- ✅ Happy path FR.
- ✅ Happy path AR.
- ✅ Happy path AR-MA (au moins 1 scenario par feature).
- ✅ Error path principal.
- ✅ Edge case identifié.

## Anti-patterns tests

- ❌ Suite "smoke" qui ne teste rien de profond (vibe-check uniquement).
- ❌ Tests E2E qui dépendent d'internet réel (always use MSW for providers).
- ❌ Coverage 100% obsessionnel : on teste l'utile, pas l'inutile.
- ❌ Pas de seed pour tests : chaque test recrée tout (lent, fragile).
- ❌ Tests qui passent localement mais flaky en CI (toujours fix le flake).
- ❌ Skip un test "temporairement" qui devient permanent.
