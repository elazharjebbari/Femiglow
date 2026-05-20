# Mocks MSW (Mock Service Worker)

MSW intercepte les requêtes HTTP au niveau réseau, à la fois côté **navigateur** (tests Jest avec `jsdom`, Storybook) et côté **Node** (tests Jest server-side, Playwright si besoin).

Aucune importation conditionnelle dans le code applicatif : les mocks sont activés au démarrage des tests uniquement.

## Fichiers

| Fichier | Rôle |
|---------|------|
| `handlers.spec.md` | Code des handlers MSW pour l'API tracking |
| `fixtures.md` | Fixtures JSON utilisés par les handlers |
| `setup.md` | Setup browser (Storybook) et Node (Jest) |
| `usage.md` | Comment override un handler dans un test précis |

## Décision : pourquoi MSW plutôt que mock direct ?

| Approche | Pour | Contre |
|----------|------|--------|
| `jest.mock('@/lib/api/tracking')` | Simple, rapide | Couplage fort au code, ne teste pas le contrat HTTP |
| MSW handlers | Teste le contrat HTTP, partagé Storybook/Jest/Playwright | Setup initial, latence légère |

→ MSW est choisi pour le **contrat-first** : si l'API change, les handlers évoluent en parallèle des types Zod.

## Couverture des endpoints

| Endpoint | Handler |
|----------|---------|
| `GET /api/tracking/plans` | Liste avec filtres status, search |
| `GET /api/tracking/plans/:id` | Plan détaillé |
| `POST /api/tracking/plans` | Création (création + audit) |
| `PATCH /api/tracking/plans/:id` | Update avec optimistic concurrency |
| `POST /api/tracking/plans/:id/activate` | Activation transactionnelle |
| `POST /api/tracking/plans/:id/archive` | Archivage |
| `GET /api/tracking/plans/:id/export?env=` | Export GTM JSON |
| `GET /api/tracking/health` | Healthcheck |
| `GET /api/tracking/audit?planId=` | Audit log |
| `POST /api/admin/tracking/import` | Import legacy |

## Statuts d'erreur simulés

Chaque handler peut être surchargé pour simuler :
- 200 / 201 (success)
- 400 (validation Zod)
- 401 (session expirée)
- 403 (RBAC interdit)
- 404 (plan introuvable)
- 409 (conflit version optimistic)
- 422 (drift critique)
- 500 (erreur serveur)
- network error (offline)
