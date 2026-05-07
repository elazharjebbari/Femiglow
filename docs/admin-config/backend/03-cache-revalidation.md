# Backend — Cache & revalidation

## Tags

| Tag                          | Quoi                                       |
|------------------------------|--------------------------------------------|
| `app-config`                 | wrapper global (toutes sections)           |
| `app-config:nav`             | section nav                                |
| `app-config:flags`           | section flags                              |
| `app-config:rbac`            | section rbac                               |
| `app-config:branding`        | section branding                           |

## Wrappers

### `getAppConfig(section)`

```ts
import { unstable_cache } from 'next/cache';

export const getAppConfigCached = <S extends Section>(section: S) =>
  unstable_cache(
    () => _getAppConfigImpl(section),
    ['app-config', 'resolve', section],
    {
      tags: ['app-config', `app-config:${section}`],
      revalidate: 3600,
    },
  )();
```

### `getAllAppConfig()`

```ts
export const getAllAppConfigCached = unstable_cache(
  async () => {
    const [nav, flags, rbac, branding] = await Promise.all([
      _getAppConfigImpl('nav'),
      _getAppConfigImpl('flags'),
      _getAppConfigImpl('rbac'),
      _getAppConfigImpl('branding'),
    ]);
    return { nav, flags, rbac, branding };
  },
  ['app-config', 'resolve', 'all'],
  {
    tags: ['app-config'],
    revalidate: 3600,
  },
);
```

## Routes mutantes : revalidation

```ts
import { revalidateTag } from 'next/cache';

export function invalidateAppConfig(section?: Section): void {
  revalidateTag('app-config');
  if (section) {
    revalidateTag(`app-config:${section}`);
  }
}
```

| Route                                          | Tags revalidés |
|------------------------------------------------|----------------|
| PATCH `/api/admin/settings/[section]`          | `app-config`, `app-config:${section}` |
| POST  `/api/admin/settings/[section]/restore`  | idem           |
| GET   *                                        | aucun (pas de mutation) |

## Conséquences cross-module

Quand on modifie `nav` ou `branding`, **toute l'app** doit refresh
parce qu'`AdminShell` et `RootLayout` consomment ces sections.

→ `revalidateTag('app-config')` invalide largement, ce qui est OK :
   les autres consommateurs (RBAC, flags) ne sont pas chers à
   recalculer.

Pour `flags` :

- Le wrapper `useFeatureFlag(name)` côté client lit la valeur via
  un fetch debounced (re-fetch sur visibility change)
- Côté serveur, `getFeatureFlag(name)` lit le cache `app-config:flags`

## Cache HTTP

Les routes API admin n'ont **pas** de cache HTTP (`Cache-Control:
no-store`). Le cache concerne uniquement l'in-memory Next.js
(unstable_cache).

Les pages publiques (`/`, `/produits`, …) sont des RSC ; elles
consomment indirectement `getAppConfigCached` (pour le branding) et
bénéficient du cache automatiquement.

## Pré-warm au boot

Optionnel : au start du process Node, hit les 4 sections en
parallèle pour amorcer le cache :

```ts
// apps/web/src/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await Promise.all([
      getAppConfigCached('nav'),
      getAppConfigCached('flags'),
      getAppConfigCached('rbac'),
      getAppConfigCached('branding'),
    ]);
  }
}
```

→ p99 du premier render passe de ~150 ms à ~5 ms.

## Métriques

- `app_config_cache_hits_total{section}`
- `app_config_cache_misses_total{section}`
- `app_config_zod_failure_total{section}` ⚠ à surveiller
- `app_config_resolve_duration_seconds_bucket{section}`

Alerte si :

- `app_config_zod_failure_total > 0` sur 1 min → corruption en DB
- `cache_hit_rate < 0.95` sur 1 h → trop d'invalidations

## Debugging

Endpoint admin caché (route `/api/admin/cache/inspect?prefix=app-config`)
qui retourne :

```json
{
  "entries": [
    { "key": "app-config:resolve:nav", "ageMs": 12300, "tags": ["app-config", "app-config:nav"] },
    { "key": "app-config:resolve:flags", "ageMs": 12350, "tags": [...] }
  ]
}
```

Utile en post-deploy pour vérifier l'invalidation.
