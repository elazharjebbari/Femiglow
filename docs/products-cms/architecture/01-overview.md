# Architecture — Vue d'ensemble

## Où s'insère le module

```
                +-----------------------------+
                |  /admin/products (UI)        |
                |  AdminShell + NAV "products" |
                +--------------+--------------+
                               |
                               v
+--------------------+  +---------------------+   +---------------------+
| API admin          |<>| products            |   | product_variants    |
| /api/admin/products|  | product_snapshots   |   +---------------------+
+--------------------+  +----------+----------+
                                   |
                                   v
                  +-----------------------------+
                  | resolveProduct() RSC        |
                  +--------------+--------------+
                                 |
                                 v
                  Pages publiques /produits/[slug]
                  (RSC, unstable_cache, tag=products)
```

## Principes

### 1. Cascade défaut → DB

Aucune fiche existante n'est cassée. La résolution serveur applique :

```
registry default (codé) → DB published row → resolved
```

Si aucune ligne DB : la fiche reste 100% codée. La migration est
**produit-par-produit** ; on peut migrer `kit` sans toucher `rituel`.

### 2. Audit + snapshots

Toute publication crée une copie figée dans `product_snapshots`.
Permet : historique, diff, restore, audit fin.

### 3. Réutilisation médias

Pas de table dédiée pour les médias produit : on réutilise
`component_media_bindings` avec `componentKey = product:${slug}`.
Slot = `packshot | lifestyle | gallery:0..N`.

### 4. Cache invalidé par tag

- `revalidateTag('products')` : listings
- `revalidateTag(\`product:${slug}\`)` : page détail
- Auto après chaque publish + chaque mutation de variante

## Dépendances avec autres modules

| Module                  | Couplage                                | Direction |
|-------------------------|-----------------------------------------|-----------|
| **components-CMS**      | même pattern draft/publish/snapshots    | inspiration |
| **component-media-system** | bindings réutilisés pour slots produit | products → media |
| **seo-CMS**             | `scope: 'product'` référence un slug    | seo → products |
| **admin-config**        | NAV array + AdminShell                  | products consomme |

## Hors scope (v1)

- Multi-locale produits (titres FR uniquement)
- Bulk import CSV
- Intégration e-commerce / panier
- Calcul de TVA dynamique
- Stock temps réel
