# Architecture — Vue d'ensemble

## Où s'insère le module

```
                +-------------------------------+
                |  /admin/settings (UI)          |
                |  AdminShell + NAV "settings"   |
                +---------------+---------------+
                                |
                                v
+--------------------+  +-------------------------+
| API admin          |<>| app_config              |
| /api/admin/settings|  | app_config_snapshots    |
+--------------------+  +-----------+-------------+
                                    |
                                    v
                  +---------------------------------+
                  | getAppConfig(section?) RSC      |
                  | (cascade default -> DB -> Zod)  |
                  +----------------+----------------+
                                   |
                                   v
                        Toute l'app FemiGlow
                        (AdminShell, RBAC, branding,
                         feature flags, etc.)
```

## Principes

### 1. Failsafe absolu

Si la ligne DB est corrompue ou invalide :

- Zod rejette → on logge un `warn` (Sentry/console)
- `getAppConfig()` renvoie le défaut codé
- L'app continue à tourner

→ Impossible de casser le site avec une mauvaise valeur en DB.
Cf. [`runbook/02-rollback.md`](../runbook/02-rollback.md).

### 2. Cascade défaut → DB

```
defaultConfig (TS, source de vérité initiale)
   ↓ override partiel
DB app_config row
   ↓ deep-merge
resolvedConfig (consommé par l'app)
```

Le merge est **partiel** : la DB n'a besoin que des champs modifiés.
Le reste hérite des défauts.

### 3. Sections indépendantes

Chaque section (`nav`, `flags`, `rbac`, `branding`) a :

- son schéma Zod
- sa valeur défaut
- son cache key (`app-config:nav`, …)
- son endpoint PATCH

→ on peut éditer `nav` sans toucher `rbac`. Une corruption sur
`branding` n'affecte pas le RBAC.

### 4. Pas de circular dep

Le module **édite** la config mais ne **consomme** pas la config qu'il
édite, sinon on aurait un chicken-and-egg :

- L'editeur RBAC ne lit pas la matrice RBAC pour décider qui peut
  l'éditer (il utilise une constante codée `requireSuperAdmin`)
- L'editeur NAV n'apparaît pas via la NAV éditable (il a une route
  fixe `/admin/settings/navigation`)

### 5. Cache invalidé par tag

- `revalidateTag('app-config')` après chaque PATCH
- `revalidateTag(\`app-config:${section}\`)` pour cible
- AdminShell utilise `unstable_cache` avec ces tags

## Dépendances avec autres modules

| Module                   | Couplage                                  | Direction |
|--------------------------|-------------------------------------------|-----------|
| **components-CMS**       | NAV item « Composants » défini ici        | components → admin-config |
| **seo-CMS**              | NAV item « SEO » défini ici               | seo → admin-config |
| **products-CMS**         | NAV item « Produits » défini ici          | products → admin-config |
| **media**                | branding utilise MediaPicker pour le logo | admin-config → media |
| **auth**                 | RBAC consomme la matrice résolue          | auth → admin-config |

## Hors scope (v1)

- Multi-tenant
- Configuration différenciée par environnement (en DB)
- Schedule de publication
- Hot-swap sans `revalidateTag` (websocket, polling)
- Synchronisation cross-instance (1 seul Vercel deployment)
