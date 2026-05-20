# P3 — Content Studio : Production Readiness & Hardening

## Vue d'ensemble

**Objectif** : Transformer le Content Studio d'un prototype P2 fonctionnel en un système **production-ready** — robuste, testé, monitoré, documenté et déployable sur le serveur de staging actuel.

**Serveur** : `/var/www/femiglow-staging` — tout s'exécute sur ce serveur de staging.

**Philosophie** : Chaque étape est commitée individuellement. Le code doit être robuste, fiable, maintenable, non-régressif, modulaire et fonctionnel. Aucun stub, aucun TODO en attente.

---

## État actuel (post-P2)

| Aspect | Statut |
|--------|--------|
| API routes | 25 routes, toutes câblées au service/repository |
| Repository | 34 fonctions, dual-mode Drizzle/memory |
| Service | 21 fonctions, audit logging, state machine |
| Composants React | 22 composants, 4 onglets |
| MSW handlers | 22 handlers, 29 tests |
| Lib tests | 8 fichiers de test |
| Component tests | 9 fichiers .test.tsx (rolldown/JSX bug bloquant) |
| E2E Playwright | 1 spec, 10 tests (navigation uniquement) |
| CI/CD | Vitest en CI, pas de Playwright, pas de coverage gate |
| Env vars | 10 variables, non documentées dans .env.example |
| Idempotence | In-memory, TTL 24h |
| Pagination | Aucune — listes complètes chargées en mémoire |
| Budget quotidien | Variable existe mais non enforced |

---

## Axes P3

### P3.1 — Configuration & Documentation Environnement
Documentation, .env.example, validation au boot, warning memory store.

### P3.2 — Pagination Serveur & Performance
Query params (limit/offset/status) sur toutes les listes, lazy loading composants.

### P3.3 — Hardening Idempotence & Budget
Idempotence DB-backed, enforcement budget quotidien, rate limiting.

### P3.4 — Couverture de Tests MSW & Lib
Combler les gaps MSW (2 handlers sans test), tests lib manquants (generation, idempotency, repository).

### P3.5 — Tests Composants (Workaround Rolldown)
Stratégie de contournement du bug JSX, tests unitaires purs pour la logique métier.

### P3.6 — E2E Playwright — Workflow Complet
Tests de formulaires, progression de workflow, error states, CI integration.

### P3.7 — CI/CD & Quality Gates
Playwright en CI, coverage gate, isolation tests content-studio.

### P3.8 — Campagnes & Orphan Table
Activer la table contentCampaigns (CRUD, UI, intégration pipeline).

---

## Jalons & Durée estimée

| Jalon | Étapes | Durée |
|-------|--------|-------|
| P3.1 | Env config & docs | 2 commits |
| P3.2 | Pagination & perf | 6 commits |
| P3.3 | Idempotence & budget | 4 commits |
| P3.4 | Tests MSW & lib | 5 commits |
| P3.5 | Tests composants | 4 commits |
| P3.6 | E2E Playwright | 5 commits |
| P3.7 | CI/CD gates | 3 commits |
| P3.8 | Campagnes | 6 commits |

**Total estimé : ~35 commits**