# Module Products-CMS

Pilotage centralisé du catalogue produit FemiGlow depuis l'admin :
fiches, variantes, prix, médias, disponibilités, et publication
draft/publish — sans toucher au code produit.

## Vision

Le repo expose actuellement un catalogue défini en `.ts` (titres,
descriptions, prix codés). Ce module ajoute :

- Une **interface admin** (`/admin/products`) pour CRUD complet
- Des **variantes** (taille, format, parfum) typées
- Une **gestion des médias** réutilisant `component-media-system`
  (slots `packshot`, `lifestyle`, `gallery`)
- Un **statut draft/published** + snapshots restorables
- Une **cascade défaut → DB** pour migration progressive (un produit
  peut rester codé tant qu'il n'a pas de ligne en base)

Aucune fiche produit existante n'est cassée : la résolution passe
par `resolveProduct()` qui applique la cascade
`registry default → DB published`.

## Ce que livre le module

| Capacité                                | Surface |
|-----------------------------------------|---------|
| CRUD fiche produit                      | `/admin/products` |
| Variantes (SKU, prix, stock)            | `/admin/products/[slug]/variants` |
| Médias par slot                         | réutilise SlotCard / MediaPicker |
| Pricing structuré (prix, promo, devise) | colonnes `price_cents`, `promo_*` |
| Inventory hint (stock simple)           | `inventory_status` enum |
| Draft / publish                         | `products.status` |
| Snapshots / restore                     | `product_snapshots` |
| Cascade serveur                         | `resolveProduct()` |
| Filtres admin                           | recherche, statut, catégorie |

## Plan d'action condensé

| Phase | Thème              | Livrables |
|-------|--------------------|-----------|
| A     | Foundation         | Migration produits + variantes, queries, API CRUD, page liste |
| B     | Détail + médias    | Page détail, intégration MediaPicker, slots produit |
| C     | Variantes + pricing| Sous-form variantes, calculateur promo, validation |
| D     | Publication + audit| Draft/publish, snapshots, restore, audit log |

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

- [UI admin (liste + détail)](./frontend/01-admin-ui.md)
- [Sous-form variantes](./frontend/02-variants-editor.md)
- [Intégration médias produit](./frontend/03-product-media.md)

### Testing

- [Stratégie](./testing/01-strategy.md)
- [Handlers MSW](./testing/02-msw-handlers.md)
- [Scénarios Playwright](./testing/03-playwright-scenarios.md)

### Runbook

- [Déploiement](./runbook/01-deployment.md)
- [Ajouter un produit](./runbook/02-add-product.md)

### Action plan

- [Phases A → D](./action-plan/01-phases.md)

## Glossaire

- **Produit** : entité racine (`products` table), identifiée par `slug`.
- **Variante** : déclinaison d'un produit (`product_variants`), porte
  son propre SKU, prix, stock.
- **Slot produit** : emplacement média (`packshot`, `lifestyle`,
  `gallery[]`) réutilisant `component_media_bindings`.
- **Statut** : `draft` (jamais publié) | `published` (visible front)
  | `archived` (masqué mais préservé).
- **Snapshot** : copie figée d'une fiche au moment du publish, dans
  `product_snapshots`.

## Contraintes transverses

- Compatible avec le catalogue codé existant (`apps/web/src/lib/products/registry.ts`)
- Pas de régression sur `/produits/[slug]` tant qu'aucune ligne DB
  n'existe pour ce slug
- AdminShell pattern : `requireAdmin()` RSC, `getAdminSession()` API
- Cache : `revalidateTag('products')` + `revalidateTag(\`product:${slug}\`)`
- RBAC : `editor` peut éditer draft, `admin` peut publier
