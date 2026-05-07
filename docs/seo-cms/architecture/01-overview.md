# Architecture — Vue d'ensemble

## Ou s'insere le module

```
                +---------------------------+
                |  /admin/seo (UI)          |
                |  AdminShell + NAV "seo"   |
                +-------------+-------------+
                              |
                              v
+-----------------+   +---------------------+   +---------------------+
| API admin       |<->| seo_overrides       |   | media (FK ogImage)  |
| /api/admin/seo  |   | seo_settings        |   +---------------------+
+-----------------+   | seo_audit_snapshots |
                      +----------+----------+
                                 |
                                 v
                  +-----------------------------+
                  | resolveSeoMetadata() RSC    |
                  +--------------+--------------+
                                 |
                  +--------------+--------------+
                  |                             |
                  v                             v
        Pages publiques                Route /api/og/[scope]/[targetKey]
        (`metadata`/`generateMetadata`) (next/og ImageResponse)
```

## Principes

### 1. Overrides, pas remplacement

Aucun fichier `page.tsx` n'est reecrit. Les `metadata` existantes
deviennent des **defaults** ; un helper applique l'override si
present. Cela permet :

- Rollback trivial (supprimer la ligne `seo_overrides`)
- Pas de regression si l'admin n'edite rien
- Co-existence avec les patterns Next.js standards

### 2. Audit de tous les changements

Toute mutation passe par `logAuditEvent()` avec
`resourceType: 'seo'` et un payload diff (avant/apres). Les
snapshots sont stockes dans `seo_audit_snapshots` pour permettre
un restore granulaire.

### 3. Cascade explicite

L'ordre de merge est documente et teste :
`defaults app` -> `seo_settings` -> `seo_overrides` -> resolved.
Voir [`03-merge-cascade-strategy.md`](./03-merge-cascade-strategy.md).

### 4. Cache invalide par tag

`revalidateTag('seo')` apres chaque PATCH/publish. Les pages
publiques utilisent `unstable_cache` avec ce tag.

## Dependances avec autres modules

| Module | Couplage | Direction |
|---|---|---|
| **components-CMS** | meme pattern draft/publish, snapshots | inspiration uniquement |
| **media** | `ogImageMediaId` -> FK media | seo-cms -> media |
| **products-CMS** | `scope: 'product'` reference produit | seo-cms -> products |
| **journal/article** | `scope: 'article'` reference article | seo-cms -> journal |
| **admin-config** | NAV array + AdminShell | seo-cms consomme |

## Hors scope (v1)

- Multi-langue actif (`locale` est present mais une seule valeur `fr-MA`)
- A/B testing de title
- Integration Google Search Console API
- Auto-suggestion AI de descriptions
