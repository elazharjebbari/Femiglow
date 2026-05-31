# Test strategy

## 1. Philosophie

### Trois objectifs
1. **Détecter les régressions** rapidement (CI rapide).
2. **Documenter le comportement** (les tests servent d'exemples vivants).
3. **Protéger les flows critiques** (E2E sur les parcours utilisateur).

### Anti-patterns à éviter
- Tests qui ne testent que l'implémentation (re-implementing in tests).
- Tests trop fragiles (cassent à chaque refacto de selector).
- Tests "always pass" (mocks trop permissifs).
- Tests sans assertion claire.
- Tests qui dépendent de l'ordre d'exécution.

### Principes
- **Test name describes behavior** : `expect plan.activate to fail when invalid placeholder present`, pas `test activate2`.
- **Arrange-Act-Assert** structure.
- **Un seul comportement par test** (sauf E2E qui chaine logiquement).
- **Pas de logique métier dans les tests** : si le test devient complexe, c'est que la fonction sous test l'est aussi → simplifier.
- **Snapshots avec parcimonie** : oui pour `exportPlan()` (le JSON GTM doit être deterministe), non pour des composants React (trop fragile).

## 2. Niveaux de tests

### 2.1 Unitaires (Jest)

Cibles :
- `lib/tracking/plan/types.ts` — schémas Zod.
- `lib/tracking/plan/validator.ts` — règles métier.
- `lib/tracking/plan/exporter.ts` — déterminisme + structure JSON.
- `lib/tracking/plan/differ.ts` — diff correct entre 2 plans.
- `lib/tracking/plan/cache.ts` — TTL.
- `lib/tracking/plan/defaults.ts` — cascade autocomplete.
- Utilitaires (formatters, helpers).

Caractéristiques :
- Aucune dépendance externe (DB, network).
- Mocks minimaux (juste les pures fonctions).
- Rapides (< 50ms par test).
- 1 test par cas (incluant edge cases).

### 2.2 Intégration (Jest + DB test)

Cibles :
- `lib/tracking/plan/repository.ts` avec vraie DB Postgres (test container).
- `lib/tracking/plan/service.ts` chaine repository + validator + exporter.
- API endpoints (`app/api/admin/tracking/plans/*`) via Supertest.

Caractéristiques :
- DB réelle (test container Postgres 16).
- Setup/teardown via fixtures.
- Plus lents (~100-500ms par test).
- Couvrent les interactions multi-modules.

### 2.3 Composants React (Jest + RTL)

Cibles :
- `components/tracking/shared/*` (StatusCard, Badge, IdInput, etc.).
- `components/tracking/wizard/*` (Step1-5).
- `components/tracking/expert/*`.

Caractéristiques :
- Render avec props mockés.
- Tests d'interaction (click, type, etc.) via `userEvent`.
- Mocks API via MSW.
- Vérifications : DOM contient ce qui est attendu, callbacks appelés, snapshot pour cas critiques.

### 2.4 End-to-end (Playwright)

Cibles :
- Journeys utilisateur complets (cf. user-journeys.md).
- Cross-browser (Chromium minimum, WebKit + Firefox optionnel).
- Cross-locale (fr-MA + ar-MA).
- Mobile responsive (sm breakpoint minimum).

Caractéristiques :
- Vraie app (next dev ou next start).
- Vraie DB (test container).
- Mocks externes (GTM API, providers analytiques) via MSW.
- Lents (5-30s par test).

### 2.5 Tests d'accessibilité

Cibles :
- Toutes les pages critiques.
- Tous les composants interactifs.

Outils :
- `@axe-core/playwright` automatisé dans E2E.
- Tests manuels NVDA + VoiceOver (checklist).

### 2.6 Tests de performance

Cibles :
- Endpoints API (latence p95).
- Bundle size (budget respecté).
- Lighthouse score.

Outils :
- Jest avec `--max-workers=1` pour mesurer.
- Lighthouse CI.
- Bundle analyzer en CI.

### 2.7 Tests de migration

Cibles :
- Script `migrate-tracking-plan.ts`.
- Idempotence (peut être relancé).
- Reversibilité (rollback).

Outils :
- Dataset legacy fictif réaliste.
- Snapshot du résultat.
- Comparaison legacy export vs migrated export.

### 2.8 Test ultime (1 test)

LE test qui valide tout :
- Crée un plan vierge.
- Saisit tous les champs via wizard UI.
- Valide.
- Active.
- Vérifie l'export JSON GTM.
- Simule un ping client.
- Vérifie le drift status OK.
- Modifie le plan.
- Active une nouvelle version.
- Vérifie le drift critical temporaire puis OK après "import dans GTM".
- Vérifie l'audit log.

Cf. `integration/ultimate-test.md`.

## 3. Couverture

### Cibles par couche

| Couche | Cible |
|---|---|
| `types.ts` (Zod) | 100% (cas simples, structures clés) |
| `validator.ts` | 95%+ (toutes les règles + edge cases) |
| `exporter.ts` | 90%+ (chaque provider + multi-env) |
| `differ.ts` | 90%+ |
| `cache.ts` | 95%+ (TTL, invalidation) |
| `defaults.ts` | 90%+ (cascade) |
| `repository.ts` | 85% (CRUD + edge cases concurrence) |
| `service.ts` | 80%+ (orchestration) |
| `audit.ts` | 95%+ (append-only critique) |
| API endpoints | 80%+ |
| Components | 70%+ |
| Pages | E2E |

### Métrique

Reportée par Jest :
- Statements
- Branches
- Functions
- Lines

Échec si l'une d'elles tombe sous le seuil.

## 4. Données de test (fixtures)

### Structure
```
tests/
├── fixtures/
│   ├── tracking-plans/
│   │   ├── valid-production-v8.json
│   │   ├── valid-minimal.json
│   │   ├── invalid-placeholder.json
│   │   ├── invalid-missing-required.json
│   │   └── multi-env-staging.json
│   ├── legacy-data/
│   │   ├── tracking-providers.csv
│   │   ├── event-mapping-versions.json
│   │   └── tracking-settings.json
│   └── gtm-exports/
│       ├── expected-export-production.json
│       ├── expected-export-staging.json
│       └── snapshot-bundle-hashes.txt
```

### Convention
- Toutes les fixtures sont **réalistes** : pas de "test123", mais "Test campagne mai 2026".
- Indication claire de ce qui rend chaque fixture **invalide** (commentaire en haut).
- Fixtures versionnées (pas regénérées au hasard).

## 5. Mocks et stubs

### Quand mocker
- Service externe (GTM API, providers analytics).
- Date/time (`Date.now`, pour les hash deterministic et l'audit).
- Random (`Math.random`, pour les ID predictable).
- Network slowness.

### Quand ne PAS mocker
- DB en tests intégration (utiliser test container).
- Zod schemas (utiliser direct, pas de remock).
- React Testing Library (utiliser direct, pas Enzyme).

### Outil MSW

MSW intercepte les requêtes HTTP au niveau du navigateur (frontend tests) ou Node (backend tests).

```typescript
// mocks/handlers/tracking.ts
import { http, HttpResponse } from 'msw'

export const handlers = [
  http.get('/api/admin/tracking/plans/active', () => {
    return HttpResponse.json({ /* fixture */ })
  }),
  // ...
]
```

Cf. `msw/` folder pour détails.

## 6. CI Pipeline

### Sur PR
```yaml
- lint
- typecheck
- test:unit         # Jest unit + intégration (~ 2-5 min)
- test:e2e:critical # Playwright happy paths only (~ 3-5 min)
- a11y              # axe-core CI (~ 1 min)
- build             # next build
- bundle-analysis   # check budget
```

Total : ~10-15 min par PR.

### Sur merge `release/tracking-plan-v2`
```yaml
- all PR checks
- test:e2e:full     # Tous les E2E, fr + ar, multi-browser
- test:integration:ultimate
- test:migration:dry-run
```

Total : ~30-45 min.

### Sur merge `master`
```yaml
- all release checks
- deploy:staging
- smoke tests staging
```

### Nightly (cron)
```yaml
- test:e2e:full
- test:performance
- test:lighthouse
- security:audit
```

## 7. Outillage local dev

### Lancer tests
```bash
npm test                          # tous Jest (rapide)
npm test -- --watch                # mode watch
npm test -- --coverage             # avec couverture
npm test path/to/file.test.ts      # un seul fichier
npm test -- --testNamePattern "validator"  # par nom

npm run test:e2e                   # tous Playwright
npm run test:e2e -- --headed       # avec UI visible
npm run test:e2e:debug             # mode debug
npm run test:e2e e2e/wizard.spec.ts # un fichier
```

### Debug
- VS Code : config `.vscode/launch.json` pour debugger Jest et Playwright.
- Playwright UI mode : `npm run test:e2e -- --ui`.
- Inspector : `PWDEBUG=1 npm run test:e2e`.

## 8. Maintenance des tests

### Quand un test casse
1. **Suspect le code en premier** (pas le test).
2. Si le code est correct : le test reflète-t-il toujours le comportement attendu ?
3. Si le comportement a changé volontairement : mettre à jour le test (avec attention).
4. Si le test casse pour des raisons indépendantes (flaky) : investiguer.

### Tests flaky
- 0 tolérance pour les tests flaky en CI.
- Si un test est flaky : `xtest` (skip), créer un ticket urgent.
- Cause typique : timing, animations, dépendance ordre.

### Refacto
Si un test devient illisible :
- Extraire en helpers (`test-utils.ts`).
- Renommer pour clarté.
- Pas de "snapshot test bidouille" qui passe sans vraie assertion.

## 9. Test ownership

- Le dev qui écrit une feature écrit aussi les tests (TDD-friendly).
- Le reviewer vérifie qualité des tests autant que du code.
- Lead dev maintient cette doc à jour.

## 10. Mesure du succès

À chaque release :
- Coverage ≥ cibles.
- 0 test flaky.
- Tests E2E pass rate : 100%.
- Bug post-release attribué à manque de test : créer le test manquant + post-mortem.

Si plusieurs bugs post-release : revue de la stratégie tests.
