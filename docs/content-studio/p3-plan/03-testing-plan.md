# P3 — Plan de Tests

## Stratégie de test

### Pyramide de tests

```
          ┌──────────────┐
          │   E2E (15)   │  ← Playwright — workflow complet
          ├──────────────┤
          │  MSW (41)     │  ← Handlers API mockés
          ├──────────────┤
          │  Unit (34)    │  ← Hooks, helpers, lib, repository
          └──────────────┘
```

### Règles

1. **Chaque commit inclut ses tests** — pas de test en attente
2. **MSW pour les handlers API** — test de la couche réseau sans serveur
3. **Unit tests pour la logique métier** — hooks extraits, helpers, budget, idempotency
4. **E2E pour le parcours utilisateur** — formulaires, navigation, workflow
5. **Pas de test de rendering React via Vitest** — bug rolldown/JSX, contourné par hooks purs + E2E

---

## Détail par catégorie

### A. Tests MSW (41 nouveaux)

| Endpoint | Tests | Étape |
|----------|-------|-------|
| GET /health | mode + enabled | P3.4.3 |
| POST /ideas/:id/generate | happy + 404 | P3.4.1 |
| POST /posts/:id/postiz-draft | happy + 404 | P3.4.1 |
| POST /drafts/:id/archive | 404 | P3.4.2 |
| POST /posts/:id/archive | 404 | P3.4.2 |
| GET /generation-runs | structure | P3.4.2 |
| GET /ideas?limit=&offset=&status= | 3 filtres | P3.4.3 |
| GET /campaigns | happy | P3.8.3 |
| POST /campaigns | happy | P3.8.3 |
| PATCH /campaigns/:id | happy | P3.8.3 |
| POST /campaigns/:id/archive | happy + 404 | P3.8.3 |
| POST /campaigns | validation error | P3.8.3 |

**Total MSW existant** : 29 → **70 après P3**

---

### B. Tests Unitaires (34 nouveaux)

| Module | Tests | Étape |
|--------|-------|-------|
| generation.test.ts | 3 (fallback, structure, pillar) | P3.4.4 |
| idempotency.test.ts | 3 (store, expire, cleanup) | P3.4.5 |
| repository.test.ts | 3 (notes, runs, pagination memory) | P3.4.5 |
| useDraftValidation.test.ts | 4 (valid, empty, too long, hashtags) | P3.5.1 |
| useBudgetStatus.test.ts | 3 (ok, warning, exceeded) | P3.5.2 |
| helpers.test.ts | 6 (formatDate, schedule, iso, datetime, extract, summarize) | P3.5.3 |
| api.test.ts | 4 (get, post, patch, error) | P3.5.4 |
| budget.test.ts | 3 (check, daily sum, exceeded) | P3.3.3 |
| repository.test.ts | +3 (campaigns) | P3.8.1 |
| service.test.ts | +2 (campaigns) | P3.8.2 |

**Total unit existant** : ~8 → **~42 après P3**

---

### C. Tests E2E Playwright (15 nouveaux)

| Feature | Tests | Étape |
|---------|-------|-------|
| Idea creation flow | 3 (fill, submit, validation) | P3.6.2 |
| Calendar navigation | 4 (grid, prev/next, filter, select-draft) | P3.6.3 |
| Analytics + budget tabs | 3 (dashboard, costs, load-data) | P3.6.4 |
| Error states | 2 (network, disabled) | P3.6.5 |
| Campaign workflow | 3 (create, associate, filter) | P3.8.5 |

**Total E2E existant** : 10 → **25 après P3**

---

### D. Coverage targets

| Couche | Cible P3 | Actuel |
|--------|----------|--------|
| `lib/content-studio/**` | 85% statements | ~60% estimé |
| `components/admin/content-studio/**` | 70% (hooks only) | ~30% |
| API routes | 90% (via MSW) | ~75% |

---

## Bug Rolldown/JSX — Stratégie de contournement

### Problème
Vitest v4 avec rolldown ne transforme pas JSX dans les fichiers `.tsx`. Tous les tests avec `render()` échouent.

### Contournement P3

1. **Extraire la logique métier** dans des hooks `.ts` purs (testables par Vitest)
2. **Tests de rendering** via Playwright E2E (browser réel, pas de problème JSX)
3. **Tests de composants** : uniquement la logique événementielle via hooks

### Hooks à extraire

| Hook | Composant source | Logique |
|------|------------------|---------|
| `useDraftValidation` | DraftEditor.tsx | Zod validation + error mapping |
| `useBudgetStatus` | BudgetSummary.tsx | Fetch + calcul budget restant |
| `useLearningNotes` | ContentStudioClient.tsx | CRUD notes |
| `useCalendarNavigation` | EditorialCalendar.tsx | Mode week/month + cursor |

---

## CI/CD — Tests automatisés

### Pipeline CI existante (ci.yml)

```
lint → typecheck → vitest (unit)
```

### Pipeline P3

```
lint → typecheck → vitest (unit + coverage)
                  → vitest content-studio (isolé)
                  → playwright e2e-content-studio (si paths modifiés)
```

### Coverage gate

- Seuil : 80% statements, 70% branches
- Bloque le merge si en dessous
- Artifacts : rapport HTML uploadé