# Phase 4 — E2E business scenarios + Playwright

**Durée** : 1,5 semaine (7-8 jours)

Implémenter les **10 scénarios métier** Gherkin de [03-business-scenarios/](../03-business-scenarios/)
en spec Playwright, + smoke + tests critiques.

## Jour 31 — Setup E2E renforcé
- [ ] POM admin complets (10 POM admin restants)
- [ ] Helper `loginAsAdmin` via API (skip UI login = +30 % rapidité)
- [ ] Seed helpers : `seedConversation`, `seedLeads`, `seedFaq`, `seedCanned`
- [ ] Reset DB stratégie (TRUNCATE entre suites Playwright)
- [ ] Network throttle helpers (slow 3G profile)

## Jour 32 — BS01 + BS02 (conversion FR + frustration)
- BS01 — Conversion FR (parcours complet + lead capture)
- BS02 — Frustration → lead auto

## Jour 33 — BS03 (darija) + BS05 (admin canned)
- BS03 — Conversion darija (mobile + RTL)
- BS05 — Admin publie canned + visiteur voit en <10s

## Jour 34 — BS04 (failover) + BS06 (rotation provider)
- BS04 — OpenAI down → fallback Anthropic
- BS06 — Admin rotate provider sans interruption

## Jour 35 — BS07 (RGPD) + BS08 (handover langue)
- BS07 — Forget endpoint + admin reflection
- BS08 — Switch FR → AR-MA mid-conversation

## Jour 36 — BS09 + BS10 (futurs, marqués `.fails()`)
- BS09 — Budget exhausted (test négatif documentant gap C3+C4)
- BS10 — Tools recall (test négatif documentant gap C1)
- Ces tests servent de **guide d'implémentation** pour les ADRs cibles

## Jour 37 — Smoke + critical tags
- 5 specs `smoke-*.spec.ts` couvrant happy paths essentiels
- Tag `@critical` sur tests bloquant release
- Configuration `pnpm test:e2e:smoke` (< 5 min)

## Jour 38 — Stabilisation
- Identifier specs lentes (top-10)
- Refactor pour réduire temps (skip auth, parallel descrit)
- Vérifier 0 flaky sur 5 runs consécutifs

**Gate sortie Phase 4** :
- 10 business scenarios passent en CI
- Smoke suite < 5 min
- Full suite Playwright < 20 min
- 0 flaky sur 5 runs

## Conventions Playwright

```typescript
test.describe('@critical BS01 — Conversion FR', () => {
  test.describe.configure({ mode: 'parallel' });

  test('@smoke visitor → lead happy path', async ({ page, browserName }) => {
    // POM
    // Actions
    // Assertions
  });
});
```

## Trace + screenshot policy

```typescript
// playwright.config.ts
use: {
  trace: 'retain-on-failure',           // garde traces fail (debug)
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
}
```

## Parallélisme

- En CI : 4 workers, projects en parallèle
- Locale RTL en projet séparé pour éviter pollution
- Tests serial uniquement quand strict order (rare)

## Livrables phase 4

- 10 specs business scenarios
- Smoke suite < 5 min
- POM admin complète (10 fichiers)
- Helpers e2e (auth, seed, throttle)
