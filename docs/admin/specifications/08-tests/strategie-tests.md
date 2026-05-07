# Stratégie de tests

## Niveau 1 — Statique

Aucun code n'arrive en CI sans avoir traversé :

| Vérification | Outil | Échec |
|---|---|---|
| Style | Prettier | bloque commit (pre-commit hook) |
| Lint | ESLint | bloque CI |
| Types | `tsc --noEmit` | bloque CI |
| Secrets | gitleaks | bloque commit + CI |
| Lock-file intégrité | `pnpm install --frozen-lockfile` | bloque CI |

Configuration : [`lint/`](./lint).

## Niveau 2 — Unitaire (Vitest + RTL)

| Critère | Cible |
|---|---|
| Outil | Vitest 1.x |
| Vitesse | < 30s pour la suite complète |
| Isolation | aucun appel réseau, aucun accès DB |
| Mocks | MSW pour HTTP, mocks Drizzle pour DB (`vi.mock`) |
| Couverture | ≥ 80 % statements sur tout fichier non `*.config.*` |

Cible : composants stateless, hooks, utils, validators Zod.

## Niveau 3 — Intégration (Vitest + MSW)

| Critère | Cible |
|---|---|
| Outil | Vitest + MSW v2 (Node) |
| Vitesse | < 60s |
| Isolation | aucun accès DB, mais on peut tester des composants connectés |
| Scénarios | un par fonctionnalité atomique |

Documentés dans [`integration-msw/`](./integration-msw) — voir
catalogue ci-dessous.

## Niveau 4 — Bout en bout (Playwright)

| Critère | Cible |
|---|---|
| Outil | Playwright 1.x |
| Vitesse | < 5 min pour la suite complète |
| Environnement | Neon branch (preview) ou ENV de test dédié |
| Browsers | Chromium uniquement v1 (Firefox + WebKit en évolution) |
| Mode CI | `pnpm e2e --reporter=html` |
| Retries | 1 retry sur CI, 0 en local |

Cible : parcours utilisateur critiques (login → action → vérification).
Pas de couverture exhaustive, valeur de signal.

Spécifications : [`e2e-playwright/`](./e2e-playwright).

## Niveau 5 — Accessibilité

| Niveau | Outil | Périmètre |
|---|---|---|
| Auto unit | `jest-axe` sur composants | détecte ~30 % des problèmes |
| Auto E2E | `@axe-core/playwright` sur pages | scan complet en contexte |
| Manuel | revue trimestrielle clavier + lecteur d'écran | les 70 % restants |

Stratégie : [`accessibilite/`](./accessibilite).

## Niveau 6 — Charge & robustesse (post-v1)

Pas v1. À envisager si le volume dépasse 1k req/s.

## Gates CI

```yaml
# .github/workflows/ci.yml (résumé)
jobs:
  lint:
    - pnpm lint
    - pnpm typecheck
    - pnpm gitleaks
  test:
    - pnpm test --coverage
  e2e:
    needs: [lint, test]
    - pnpm e2e
  build:
    needs: [lint, test]
    - pnpm build
```

Tous les jobs doivent passer pour merger.

## Stratégie MSW : un scénario par fonctionnalité

C'est la clé de robustesse demandée. Chaque scénario décrit :

1. **Contexte** : la fonctionnalité testée.
2. **Préconditions** : état initial mocké.
3. **Action utilisateur** : ce que fait l'utilisatrice.
4. **Handlers MSW** : les routes mockées et leur comportement.
5. **Assertions** : ce qu'on vérifie côté UI.
6. **Edge cases** : variantes (latence, erreur, vide).

Catalogue dans [`integration-msw/README.md`](./integration-msw/README.md).

## Convention de nommage

| Type | Pattern | Exemple |
|---|---|---|
| Unit | `XYZ.test.tsx` à côté du fichier | `LeadFilters.test.tsx` |
| Intégration | `*.integration.test.tsx` | `LeadsList.integration.test.tsx` |
| Spec MSW | `scenario-{domaine}-{action}.md` | `scenario-leads-filters.md` |
| Handlers MSW | `handlers-{domaine}.ts` | `handlers-admin-leads.ts` |
| E2E | `e2e/{domaine}.spec.ts` | `e2e/login.spec.ts` |

## Que tester / que ne pas tester

| À tester | À NE pas tester |
|---|---|
| Rendu conditionnel selon props | implémentation interne (state hook) |
| Transition d'état utilisateur (form, optimistic) | formatage CSS exact |
| Comportement d'erreur (4xx/5xx) | le moteur de fetch lui-même |
| Validations Zod | la lib Zod elle-même |
| Permissions et redirects | tâches qui appartiennent à Next.js |

## Couverture cible

| Module | Couverture statements | Justification |
|---|---|---|
| `lib/auth/*` | 100 % | sécurité critique |
| `lib/webhooks/*` | 100 % | cœur métier |
| `lib/schemas/*` | 100 % | source de vérité validation |
| `lib/db/queries/*` | 80 % | testé via integration |
| `app/(admin)/**/page.tsx` | 80 % | testé via E2E |
| `components/**/*` | 90 % | unité fine |
| `lib/utils/*` | 95 % | code pur |

## Non-régression

Toute correction de bug ajoute **au minimum un test** qui échouerait
sans le fix. Convention : suffixe `.regression.test.ts` au besoin.
