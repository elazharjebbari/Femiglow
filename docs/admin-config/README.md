# Module Admin-Config

Configuration centralisée et runtime de l'admin FemiGlow : navigation,
feature flags, RBAC, branding, paramètres applicatifs — éditables sans
redeploy.

## Vision

Aujourd'hui, plusieurs constantes sont codées en dur :

- `apps/web/src/components/admin/AdminShell.tsx` (NAV array)
- `apps/web/src/lib/auth/roles.ts` (matrice RBAC)
- `apps/web/src/lib/branding/*.ts` (couleurs, polices, logos)
- `apps/web/src/lib/feature-flags.ts` (flags statiques)

Le module **admin-config** déplace ces constantes vers une table
`app_config` éditable depuis `/admin/settings`, avec :

- **Cascade défaut → DB** (un repo neuf reste fonctionnel sans ligne DB)
- **Validation Zod stricte** (impossible de casser l'admin avec une mauvaise valeur)
- **Audit log** sur chaque modification
- **Snapshots / restore** (rollback 1-click)
- **Reload runtime** sans redeploy (`revalidateTag('app-config')`)

## Ce que livre le module

| Capacité                              | Surface |
|---------------------------------------|---------|
| Édition NAV admin                     | `/admin/settings/navigation` |
| Édition feature flags                 | `/admin/settings/flags` |
| Édition RBAC (rôles → permissions)    | `/admin/settings/rbac` |
| Édition branding runtime              | `/admin/settings/branding` |
| Snapshots / restore                   | `app_config_snapshots` |
| Cascade serveur                       | `getAppConfig()` helper |
| Hot-reload                            | `revalidateTag('app-config')` |

## Plan d'action condensé

| Phase | Thème               | Livrables |
|-------|---------------------|-----------|
| A     | Foundation          | Migration `app_config`, queries, API GET/PATCH, page liste |
| B     | NAV + flags         | Editeurs NAV, flags booléens, hot-reload |
| C     | RBAC + branding     | Matrice RBAC, picker couleurs/polices |
| D     | Snapshots + audit   | Historique, restore, diff |

Détail : [`action-plan/01-phases.md`](./action-plan/01-phases.md).

## Index docs

### Architecture

- [Vue d'ensemble](./architecture/01-overview.md)
- [Modèle de données](./architecture/02-data-model.md)
- [Cascade défaut → DB](./architecture/03-cascade.md)

### Backend

- [Routes API admin](./backend/01-api-routes.md)
- [Validation Zod](./backend/02-zod-validation.md)
- [Cache & revalidation](./backend/03-cache-revalidation.md)

### Frontend

- [UI admin](./frontend/01-admin-ui.md)
- [Editeur NAV](./frontend/02-nav-editor.md)
- [Editeur RBAC](./frontend/03-rbac-editor.md)

### Testing

- [Stratégie](./testing/01-strategy.md)
- [Handlers MSW](./testing/02-msw-handlers.md)

### Runbook

- [Déploiement](./runbook/01-deployment.md)
- [Rollback config cassée](./runbook/02-rollback.md)

### Action plan

- [Phases A → D](./action-plan/01-phases.md)

## Glossaire

- **Config** : objet typé représentant une section configurable
  (NAV, flags, RBAC, branding).
- **Section** : clé top-level de `app_config` (`'nav' | 'flags' |
  'rbac' | 'branding'`).
- **Cascade** : ordre de résolution serveur — `defaultConfig (codé)
  → DB row → resolved`.
- **Snapshot** : copie figée d'une section au moment d'une
  modification, dans `app_config_snapshots`.

## Contraintes transverses

- **Failsafe** : si la ligne DB est invalide (Zod fail), fallback
  silencieux sur la valeur défaut codée. L'admin ne plante jamais.
- **RBAC strict** : seul `superadmin` peut éditer `rbac` et
  `flags` ; `admin` peut éditer `nav` et `branding`.
- AdminShell pattern : `requireAdmin()` RSC, `getAdminSession()` API.
- Cache : `revalidateTag('app-config')` après chaque mutation.
- **Pas de circular dep** : le module ne consomme pas lui-même la
  config qu'il édite (utilise les valeurs résolues au moment du
  render, pas au moment de l'édition).
