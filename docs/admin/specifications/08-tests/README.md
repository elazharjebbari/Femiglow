# 08 — Stratégie de tests

L'admin FemiGlow vise une couverture **exhaustive** : chaque
fonctionnalité, chaque état, chaque chemin d'erreur a son scénario.
Cette section documente la pyramide de test, les outils et — pour MSW —
**un scénario par fonctionnalité atomique**.

## Pyramide

```
                  ┌──────────────────┐
                  │      E2E         │   Playwright (~10 specs)
                  │    parcours      │   coût élevé, signal max
                  └──────────────────┘
                ┌──────────────────────┐
                │  Integration / MSW   │   ~30 scénarios MSW
                │  (interactions API)  │   couvre chaque flux
                └──────────────────────┘
            ┌──────────────────────────────┐
            │      Unit (Vitest+RTL)       │   ~80 fichiers
            │  composants, hooks, utils    │   rapide, ciblé
            └──────────────────────────────┘
        ┌──────────────────────────────────────┐
        │      Statique : Lint, Types, a11y    │   exécuté à chaque PR
        └──────────────────────────────────────┘
```

## Sous-dossiers

| Dossier | Contenu |
|---|---|
| [`lint/`](./lint) | Configurations ESLint, Prettier, TypeScript strict, gitleaks |
| [`unit-vitest/`](./unit-vitest) | Spécifications Vitest + RTL pour composants et utils |
| [`integration-msw/`](./integration-msw) | **Scénarios MSW** : un fichier par fonctionnalité |
| [`e2e-playwright/`](./e2e-playwright) | Specs Playwright + configuration |
| [`accessibilite/`](./accessibilite) | Stratégie a11y (jest-axe + revue manuelle) |
| [`strategie-tests.md`](./strategie-tests.md) | Pyramide, ratio, ce qu'on teste à chaque niveau |
| [`matrice-couverture.csv`](./matrice-couverture.csv) | Mapping fonctionnalité → tests |

## Outils

| Outil | Rôle |
|---|---|
| ESLint | qualité de code |
| Prettier | formatage |
| TypeScript strict | typage |
| `tsc --noEmit` | check de types CI |
| gitleaks | détection de secrets |
| **Vitest** | unit + intégration légère |
| **React Testing Library** | rendu composants |
| **MSW v2** | mock HTTP (fetch + XHR) |
| **jest-axe** | a11y automatisée |
| **Playwright** | E2E navigateur |
| **@axe-core/playwright** | a11y E2E |

## Définition de "fait"

Un PR est mergeable si :
- [ ] `pnpm lint` passe
- [ ] `pnpm typecheck` passe
- [ ] `pnpm test` passe (unit + msw)
- [ ] `pnpm e2e` passe (sur Neon branch)
- [ ] `pnpm test:a11y` passe (jest-axe sur tout)
- [ ] couverture nouvelle ligne ≥ 80 %
- [ ] aucune régression de couverture sur les autres fichiers
- [ ] revue de sécurité (cf. checklist `definition-of-done.md`)

## Tests par section de l'app

| Domaine | Unit | MSW | Playwright | a11y |
|---|---|---|---|---|
| Login | `LoginForm.test.tsx` | 4 scénarios | `e2e/login.spec.ts` | jest-axe |
| Dashboard | `KPICards.test.tsx`, `RecentLeads.test.tsx` | — (lecture serveur directe) | `e2e/dashboard.spec.ts` | jest-axe |
| Leads liste | 4 spécifications | 6 scénarios | `e2e/leads.spec.ts` | jest-axe |
| Leads détail | 4 spécifications | 4 scénarios | `e2e/lead-detail.spec.ts` | jest-axe |
| Webhooks | 6 spécifications | 8 scénarios | `e2e/webhooks.spec.ts` | jest-axe |
| Deliveries | 3 spécifications | 5 scénarios | `e2e/webhook-deliveries.spec.ts` | jest-axe |
| Cron | unit dispatch | 3 scénarios | `e2e/cron-flow.spec.ts` | n/a |
| Forms publics | unit | 3 scénarios par form | `e2e/public-forms.spec.ts` | jest-axe |
