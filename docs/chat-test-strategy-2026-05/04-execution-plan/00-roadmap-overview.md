# Roadmap d'exécution — Vue d'ensemble

Plan en **7 phases** sur **~8-10 semaines** pour atteindre la couverture cible (≥85 % avg,
≥95 % critique) sans flakiness.

## Vision

```
Phase 0   ───►  Setup harnais + factories + MSW (1 semaine)
Phase 1   ───►  Couverture P0 services + repos (2 semaines)
Phase 2   ───►  Couverture P0 components + a11y (2 semaines)
Phase 3   ───►  Couverture P1 (services + components) (1 semaine)
Phase 4   ───►  E2E business scenarios + Playwright (1,5 semaine)
Phase 5   ───►  Perf + load + chaos (0,5 semaine)
Phase 6   ───►  A11y audit complet + visual regression (0,5 semaine)
Phase 7   ───►  Stabilisation + CI gates + onboarding doc (continu)

         ▼ Boucle de correction permanente
Feedback ►  Détection flaky → quarantaine → fix
         ►  Coverage drop → blocker → fix
         ►  Specs slowest top-10 → refactor
```

## Distribution effort (jours-homme)

| Phase | Effort (j) | Pourquoi |
|-------|-----------|----------|
| 0. Setup | 5 | Factories, MSW, testcontainers, scripts |
| 1. P0 services + repos | 10 | Cœur métier (orchestrator, intent, charter, sanitize, lead-decision) |
| 2. P0 components + a11y | 10 | Widget visiteur (8 features phares UI) |
| 3. P1 | 5 | API routes, admin secondaires |
| 4. E2E + business | 7 | 10 scénarios + smoke + critical tags |
| 5. Perf + load | 3 | k6 + Lighthouse CI |
| 6. A11y | 3 | Audit axe complet + visual snapshots |
| 7. Stabilisation continu | — | Embedded dans BAU |
| **TOTAL** | **~43 j** | **~8-9 semaines pour 1 dev** ou **4-5 semaines pour 2 devs en parallèle** |

## Ordre stratégique

### Pourquoi cet ordre ?

1. **Phase 0 d'abord** : pas de tests sans harnais propre. Investit avant productivité.
2. **Phase 1 P0 services AVANT components** : la logique métier est plus stable, moins
   pénalisante à refactorer. Les tests services protègent les refactor UI.
3. **A11y intégré Phase 2** (pas en fin) : on ne RAJOUTE pas l'a11y, on la teste DÈS le
   départ.
4. **E2E après P0** : Les scénarios métier exigent que toutes les couches inférieures
   passent.
5. **Perf et a11y dédié à la fin** : ils valident la qualité globale.

## Critères de fin de phase

Chaque phase a une **gate** avant passage à la suivante :

| Phase | Gate sortie |
|-------|-------------|
| 0 | Premier test passe en CI ; coverage report visible ; MSW init OK |
| 1 | Coverage services + repos P0 ≥ 95 % ; 0 flaky |
| 2 | Coverage components P0 ≥ 80 % ; a11y violations critiques = 0 |
| 3 | Coverage moyen global ≥ 80 % |
| 4 | 10 scénarios business passent en CI ; suite full < 20 min |
| 5 | P95 latency `/api/chat/message` ≤ 4 s sous charge 50 req/s |
| 6 | Lighthouse a11y score ≥ 95 sur widget + admin |
| 7 | 30 jours en CI sans flaky ; coverage stable |

## Risques de la roadmap

| Risque | Mitigation |
|--------|------------|
| Bugs prod découverts pendant tests (ex : C2 outbound moderation) | Tests prouvent le bug → ticket immédiat → fix avant gate |
| Capacité dev insuffisante | Phaser ; tests P0 d'abord ; P1 différé OK |
| Code refactor en cours (ex : tools framework C1) | Tests `it.fails(...)` documenter le gap, activés post-implémentation |
| CI temps trop long | Profiler chaque phase ; parallélisation accrue |
| Drift coverage | Codecov + alerte automatique |

## Détail par phase

- 📄 [01-phase-1-foundation-setup.md](01-phase-1-foundation-setup.md)
- 📄 [02-phase-2-coverage-core.md](02-phase-2-coverage-core.md)
- 📄 [03-phase-3-coverage-extended.md](03-phase-3-coverage-extended.md)
- 📄 [04-phase-4-e2e-business-scenarios.md](04-phase-4-e2e-business-scenarios.md)
- 📄 [05-phase-5-perf-load.md](05-phase-5-perf-load.md)
- 📄 [06-phase-6-a11y-audit.md](06-phase-6-a11y-audit.md)
- 📄 [07-feedback-loop.md](07-feedback-loop.md)

## Lien avec audit + recommandations

| Sprint audit (chat-audit-2026-05) | Phase test strategy |
|-----------------------------------|---------------------|
| Quick wins (1 sem) | Tests régression dans Phase 1 |
| Sécurité éditoriale C2 (2 sem) | Tests régression Phase 1 + Phase 4 |
| Observabilité (2 sem) | Phase 2 + Phase 4 |
| Fallback ADR-004 (3 sem) | Phase 4 + tests `it.fails(...)` Phase 1 |
| Cascade intent N3 (1 sem) | Tests Phase 1 sur dataset |
| Tools framework (4 sem) | Tests `it.fails(...)` Phase 1 + activation post-livraison |
