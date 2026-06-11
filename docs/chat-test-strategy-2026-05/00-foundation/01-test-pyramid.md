# Pyramide de tests — distribution & rationale

Adapté du modèle classique (Cohn pyramid) **modifié pour un contexte UI-first métier**.

## Forme cible

```
                              ┌────────────────┐
                              │     E2E         │  ~6 %  (30 specs)
                              │  (Playwright)   │  Lent (~30 s/spec en avg)
                              └────────────────┘
                       ┌──────────────────────────┐
                       │      Component             │  ~25 % (120 specs)
                       │  (vitest + RTL + MSW)      │  Rapide (~200 ms/spec)
                       └──────────────────────────┘
                  ┌──────────────────────────────────────┐
                  │       Integration                       │  ~17 % (80 specs)
                  │   (vitest + MSW + DB test)              │  Modéré (~500 ms/spec)
                  └──────────────────────────────────────┘
            ┌──────────────────────────────────────────────────┐
            │                Unit                                  │  ~52 % (250 specs)
            │           (vitest pur)                                │  Très rapide (~10 ms/spec)
            └──────────────────────────────────────────────────┘
```

## Distribution détaillée

| Couche | Count cible | % | Stack | Temps moyen / spec | Budget total CI |
|--------|-------------|---|-------|---------------------|-----------------|
| Unit | 250 | 52 % | vitest | 10 ms | 2,5 s |
| Integration | 80 | 17 % | vitest + MSW + Drizzle test container | 500 ms | 40 s |
| Component | 120 | 25 % | vitest + @testing-library/react + MSW | 200 ms | 24 s |
| E2E | 30 | 6 % | Playwright + axe-playwright | 30 s | 900 s (15 min) |
| **Total** | **480** | **100 %** | — | — | **~17 min** |

Ces chiffres sont **indicatifs**, pas un objectif. La règle d'or :
**chaque comportement métier doit avoir au moins 1 test à la couche la plus haute possible**
qui le valide bout-en-bout.

## Pourquoi cette forme

### Plus large à la base (unit)

- ~250 unit tests : services purs, helpers, matchers, formatters, sanitizers, intent regex,
  charter filter, lead-decision règles, billing pricing.
- Coût d'écriture faible, feedback instantané, base de la confiance refactoring.

### Couche component **épaisse** vs Cohn classique

Le projet est très UI-driven (widget visiteur + admin console). On augmente la couche
component (25 %) pour valider :
- Interactions clavier/souris/tactile
- États de chargement / erreur / vide
- Intégration store Zustand
- Branchement SSE simulé via MSW
- A11y avec jest-axe

### Couche E2E **fine mais critique**

30 specs Playwright **uniquement** pour :
- Parcours métier de bout en bout (BS01–BS10)
- Smoke tests post-deploy
- Tests de régression sur les bugs C1–C6 audit
- Multi-tabs, multi-locales

On **ne réplique pas** en E2E des cas déjà couverts en component (anti-pattern "ice cream cone").

## Quand choisir quelle couche

```
                   ┌──────────────────────────┐
                   │  Comportement à valider   │
                   └────────────┬─────────────┘
                                ▼
                  ┌─────────────────────────────┐
                  │  Implique UI (visible       │
                  │  par utilisateur) ?          │
                  └────────────┬─────────────────┘
                ┌──────────────┴───────────────┐
              NON                              OUI
                │                                │
                ▼                                ▼
   ┌────────────────────┐         ┌────────────────────────────┐
   │ Fonction pure /     │         │ Implique BD / API + UI ?   │
   │ logique métier ?    │         └─────────────┬──────────────┘
   └─────────┬──────────┘                       │
             │                     ┌────────────┴───────────┐
             ▼                   NON                        OUI
   ┌────────────────┐             │                          │
   │   UNIT          │             ▼                          ▼
   │   (vitest)      │     ┌────────────────┐    ┌────────────────────┐
   └────────────────┘     │ COMPONENT       │    │ E2E (Playwright)   │
                          │ (vitest + RTL)  │    │ ou INTEGRATION     │
                          └────────────────┘    │ + COMPONENT          │
                                                └────────────────────┘
```

## Anti-patterns interdits

1. **Ice cream cone** — Trop d'E2E par rapport à l'unit. Symptôme : CI long, flakiness.
2. **Mock everything** — Tests qui mockent toutes les dépendances → ne valident plus rien
   (cas `orchestrator.test.ts` actuel — voir Mi1 audit).
3. **Cypress-like component testing** — Utiliser Playwright pour ce qui peut tester en RTL.
4. **Snapshot abuse** — Snapshots gigantesques qui changent à chaque tweak. Préférer
   assertions ciblées.
5. **Tests sans assertion** — `await expect(action()).resolves.toBeDefined()` non, on assert
   le **comportement attendu**.
6. **Tests dépendants d'ordre** — Chaque test doit pouvoir tourner seul. Pas de
   `test.serial` sauf cas justifié.
7. **Tests qui lisent leur propre output** — Auto-référence.

## Distribution par catégorie de feature

Estimation à partir de [02-functional-areas/_index/00-matrix.csv](../02-functional-areas/_index/00-matrix.csv) :

| Catégorie | Unit | Int | Comp | E2E | MSW | Total |
|-----------|------|-----|------|-----|-----|-------|
| Widget UI (F01–F13) | 30 | 10 | 60 | 18 | 7 | 125 |
| API (F14–F22) | 25 | 30 | 0 | 11 | 10 | 76 |
| Orchestrator (F23–F36) | 73 | 50 | 0 | 16 | 13 | 152 |
| Admin (F37–F52) | 32 | 32 | 60 | 26 | 18 | 168 |
| Cross (F53–F60) | 27 | 27 | 12 | 14 | 14 | 94 |
| **Total** | **187** | **149** | **132** | **85** | **62** | **615 lignes test cas** |

Compteurs en lignes de matrice : chaque cellule = un cas à couvrir. Une spec peut couvrir
plusieurs cas via `describe.each` / table-driven tests.

## Budget temps CI

| Job | Durée cible | Mode |
|-----|-------------|------|
| `unit-and-int` | < 2 min | sur chaque PR |
| `component` | < 3 min | sur chaque PR |
| `e2e-smoke` | < 5 min | sur chaque PR (tag `@smoke`) |
| `e2e-full` | < 20 min | sur main + release |
| `visual-regression` | < 5 min | sur main + release |
| `a11y-audit` | < 3 min | sur main + release |
| `load-test` | < 15 min | hebdo + release |

Si un job dépasse son budget, **action** : profiler les specs les plus lentes, paralléliser,
ou monter à un tier supérieur.

## Suivi en continu

- Coverage report (`vitest --coverage` + `codecov`) — voir [03-quality-gates.md](03-quality-gates.md)
- Pass rate trend sur 30 jours
- Spec slowest top-10 quotidien (alerter si > 10 % budget)
- Flaky test detection (3 retries → quarantaine)
