# 14 — Batterie de tests

Suite complète : Jest (unit + integration), Playwright (E2E), MSW (mocks frontend), et **test ultime** d'intégration qui valide le système de bout-en-bout.

## Pyramide de tests

```
              ▲
              │
              │   Test ultime (1)
              │   ─────────────
              │   Tests E2E Playwright (~20 scenarios)
              │   ─────────────────────────────
              │   Tests intégration Jest (~30)
              │   ────────────────────────
              │   Tests unitaires Jest (~150)
              │   ────────────────────────────
              ▼
```

Distribution :
- 70% unitaires (Jest).
- 20% intégration (Jest + MSW).
- 10% E2E (Playwright).
- 1 test ultime qui couvre toute la chaîne.

## Sous-dossiers

| Dossier | Contenu |
|---|---|
| [jest/](jest/) | Tests unitaires + intégration Jest |
| [playwright/](playwright/) | Tests E2E (UI + API) |
| [msw/](msw/) | Handlers + fixtures mock API |
| [integration/](integration/) | Test ultime + tests d'intégration cross-system |

## Fichiers de stratégie

| Fichier | Sujet |
|---|---|
| [test-strategy.md](test-strategy.md) | Vision globale, philosophie, outils, couverture |
| [test-matrix.csv](test-matrix.csv) | Matrice exhaustive des tests à écrire |

## Critères de couverture

| Surface | Cible |
|---|---|
| `lib/tracking/plan/` | ≥ 80% (statements, branches, functions, lines) |
| `components/tracking/` | ≥ 70% |
| `app/api/admin/tracking/` | ≥ 80% |
| `app/admin/tracking/` (pages) | E2E plutôt que unit |
| Total module tracking | ≥ 75% |

## Outils

- **Jest 29** : tests unit + intégration.
- **React Testing Library** : tests components.
- **MSW 2** : mocks HTTP.
- **Playwright 1.40+** : E2E.
- **axe-core** : a11y dans Playwright.
- **Supertest** : tests API.

## CI

Tous les tests bloquent le merge :
- Jest : `npm run test` → tous verts.
- Playwright : `npm run test:e2e` → tous verts.
- Coverage : `npm run test:coverage` → seuils respectés.
- a11y : `npm run test:a11y` → 0 violation critique.
