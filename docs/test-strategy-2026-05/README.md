# Stratégie de tests FemiGlow — Mai 2026

> **Sprint** : `test-strategy-2026-05`
> **Effort total** : ~5-7 j-h dev + setup CI + ~24 h roadmap test exhaustif
> **Approche** : pyramide de tests rigoureuse, factories typées, MSW pour intégration, Playwright pour E2E, k6 pour load, Lighthouse pour perf, axe pour a11y

## Mission

Mettre en place une couverture de tests **exhaustive, fiable, maintenable, non-régressive et modulaire** sur :

- **Backend** : routes API, helpers, queries DB, schemas Zod
- **Frontend** : composants UI, états, accessibilité, design tokens
- **UI/UX** : visual regression, parcours utilisateur critique, a11y WCAG AA
- **Data** : factories, seeders, anonymisation, migrations
- **Sécurité** : XSS, SQLi, idempotency, rate-limits, OWASP top-10
- **Performance** : Lighthouse, budgets web vitals, k6 load tests
- **Observabilité** : smoke tests post-deploy + heartbeat cron

## Sommaire du dossier

| Doc | Sujet |
|---|---|
| `README.md` | Index + TL;DR + métriques cibles |
| `01-context-inventory.md` | Inventaire existant (4 678+ tests vitest, gaps E2E) |
| `02-vision-strategy.md` | Pyramide de tests + ratios cibles + principes |
| `03-data-strategy.md` | Factories, fixtures, seeders, anonymisation |
| `04-backend-tests.md` | Specs API + DB + helpers + Zod |
| `05-frontend-ui-tests.md` | Specs composants + UI/UX |
| `06-e2e-tests.md` | Playwright + scénarios parcours utilisateur |
| `07-msw-mocks.md` | Handlers MSW + patterns intégration |
| `08-perf-tests.md` | Lighthouse + k6 + budgets web vitals |
| `09-security-tests.md` | OWASP + axe + dependency scan |
| `10-plan-action-phases.md` | 7 phases T0→T6 avec critères acceptation |
| `11-runbook-execution.md` | Étape-par-étape exécution + commandes |
| `12-ci-cd-workflows.md` | GitHub Actions templates production-ready |
| `13-monitoring-alerts.md` | Sentry + Plausible + heartbeat post-deploy |

## TL;DR — Pyramide de tests cible

```
                  ┌─────────────────────────┐
                  │   E2E + Smoke (5%)      │   < 100 tests, < 10 min CI
                  │   Playwright + k6       │   Critical path business
                  ├─────────────────────────┤
                  │   Integration (15%)     │   ~300 tests, < 5 min
                  │   MSW + DB intégration  │   API contracts + flows
                  ├─────────────────────────┤
                  │   Component (20%)       │   ~600 tests, < 2 min
                  │   React Testing Library │   Rendering + interactions
                  ├─────────────────────────┤
                  │   Unit (60%)            │   ~3000 tests, < 1 min
                  │   Vitest + Zod + pure   │   Helpers, validators, logic
                  └─────────────────────────┘
```

## Métriques cibles (J+30 post-implémentation)

| KPI | Baseline | Cible |
|---|---|---|
| Tests vitest verts | 4 678 | **≥ 5 200** (+550 nouveaux) |
| Tests Playwright fonctionnels | ~80 specs (jamais run) | **150 specs verts en CI** |
| Coverage code | non mesuré | **≥ 85%** lib/ + 75% app/ |
| Tests sécu (a11y + OWASP) | partiels | **100% endpoints critiques** |
| Lighthouse mobile (`/kit`) | non mesuré | **≥ 85 perf, LCP < 2.5s** |
| Smoke tests post-deploy | 1 (attribution) | **3 systèmes live + 1 critique** |
| Mean time to detect régression | manuel | **< 5 min** via CI gates |

## Garde-fous non-négociables

- ❌ **Pas de test flaky** — quarantaine + ticket si rate < 99%
- ❌ **Pas de test sans assertion** explicite (anti-pattern audit)
- ❌ **Pas de mocks ad-hoc** — toujours via `src/test/msw/handlers.ts`
- ❌ **Pas de fixtures inline** — toutes via `src/test/factories/`
- ✅ **Test pyramid respectée** — éviter inflation E2E (coûteux)
- ✅ **Tests parallèles** — pas de state global partagé
- ✅ **Tests déterministes** — fixed clock + seeded random
- ✅ **Tests rapides** — unit < 50ms, integration < 500ms, E2E < 30s

## Quick start

### Pour un nouveau dev
```bash
# Lire dans cet ordre :
# 1. README.md (overview)
# 2. 02-vision-strategy.md (principes)
# 3. 03-data-strategy.md (factories — onboarding)
# 4. 11-runbook-execution.md (commandes utiles)
```

### Pour un PR contributor
```bash
# Avant de pusher
pnpm --filter @femiglow/web test
pnpm --filter @femiglow/web test:integration
pnpm --filter @femiglow/web e2e -g "@critical"  # critical path uniquement

# Pour debug un test flaky
pnpm vitest --watch <pattern>
```

### Pour le release manager
```bash
# Post-deploy smoke
pnpm tsx scripts/smoke-live-systems.ts --url https://femiglow-maroc.com
pnpm tsx scripts/smoke-attribution.ts --url https://femiglow-maroc.com

# Check Lighthouse budgets
pnpm exec lhci autorun
```

## Plan d'action high-level

| Phase | Sujet | Effort | Statut |
|---|---|---|---|
| **T0** | Setup infra : Playwright config, CI workflows, scripts package | ½ j | ⏳ |
| **T1** | Factories + fixtures + helpers réutilisables | 1 j | ⏳ |
| **T2** | Backend tests gap-filling (routes critiques sans coverage) | 1 j | ⏳ |
| **T3** | Frontend UI tests (composants + a11y axe) | 1 j | ⏳ |
| **T4** | E2E Playwright — câblage + run + green-or-skip | 1-2 j | ⏳ |
| **T5** | MSW handlers complets (Anthropic, Meta, TikTok, Snap) | ½ j | ⏳ |
| **T6** | Perf (Lighthouse + k6) + sécurité OWASP basics | 1 j | ⏳ |
| **T7** | CI workflows + monitoring + heartbeat post-deploy | ½ j | ⏳ |

**Total** : **5-7 j-h** dev + ~3-5 j supplémentaires pour coverage exhaustive (load tests, pentest, visual regression).

## Lien avec les sprints précédents

Ce dossier capitalise sur :
- **`attribution-fix-2026-05`** : MSW handlers existants, smoke runner pattern
- **`live-systems-fix-2026-05`** : factories Redis, dashboards admin, idempotency
- **`kit-landing-reorder-2026-05`** : pattern test layout v1/v2
- **`wizard-kit-optim-2026-05`** : tests parcours conversion

## ROI estimé

| Bénéfice | Mesure | Valeur |
|---|---|---|
| Régressions évitées | bugs/sprint | -70% |
| Temps détection | min vs jours | -98% |
| Confiance refactor | qualitatif | high → very high |
| Onboarding nouveaux devs | jours productifs | 5 → 2 |
| Tests flaky | % | < 1% (vs ~5% actuel) |

## Maintenance long terme

- **Hebdo** : review tests flaky (quarantaine + tickets)
- **Mensuel** : audit coverage trend (régression alerte)
- **Trimestriel** : update Playwright + Lighthouse + dépendances test
- **Annuel** : revue stratégie pyramide (toujours pertinente ?)
