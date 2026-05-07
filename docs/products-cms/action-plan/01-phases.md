# Products-CMS — Plan d'action (Phases A → D)

> 4 phases livrables incrémentalement. Réf. [`README.md`](../README.md).

## Vue d'ensemble

| Phase | Thème                | Durée  | Livrables clés |
|-------|----------------------|--------|----------------|
| A     | Foundation           | 3 j    | Migration, queries Drizzle, API CRUD, page liste admin |
| B     | Détail + médias      | 2 j    | Page détail, intégration SlotCard + MediaPicker |
| C     | Variantes + pricing  | 3 j    | Sous-form variantes, prix structuré, validation |
| D     | Publication + audit  | 2 j    | Draft/publish, snapshots, restore, audit log |

Total ~10 j. Chaque phase déployable seule.

---

## Phase A — Foundation

### A.1 — Migration

- Fichier : `apps/web/drizzle/migrations/0008_products_cms.sql`
- Tables : `products`, `product_variants`, `product_snapshots`
- Cf. [`architecture/02-data-model.md`](../architecture/02-data-model.md)

### A.2 — Queries

- `listProducts({ status?, q?, page? })`
- `getProduct(slug)` → produit + variantes
- `upsertProduct(input)`
- `archiveProduct(slug)` (soft)

### A.3 — API admin

- `GET    /api/admin/products`        → liste
- `POST   /api/admin/products`        → créer
- `GET    /api/admin/products/[slug]` → détail
- `PATCH  /api/admin/products/[slug]` → update draft
- `DELETE /api/admin/products/[slug]` → archive (soft)

### A.4 — Page liste

- `/admin/products` (RSC) : table avec slug, titre, statut, prix
- Filtres : statut, recherche
- Bouton **Nouveau produit** → modal slug + titre

### Critères Phase A

- [ ] Migration appliquée, seed peuple le catalogue actuel
- [ ] CRUD API testé (Vitest + handlers MSW)
- [ ] Liste filtrable avec recherche live
- [ ] Pas de régression : `/produits` rend les fiches existantes

---

## Phase B — Détail + médias

### B.1 — Page détail

- `/admin/products/[slug]` (RSC + form client)
- Champs basiques : `title`, `tagline`, `description` (rich-text),
  `category`, `tags[]`
- Save optimiste + dirty tracking (réutilise `useDirtyState`)

### B.2 — Slots produit

- Définir 3 slots : `packshot` (1:1), `lifestyle` (4:3), `gallery` (variable, 0..N)
- Réutilise `SlotCard` + `MediaPicker` du component-media-system
- `acceptKinds: ['image']` pour packshot/lifestyle, `['image', 'video']` pour gallery

### B.3 — Composant front

- Helper `resolveProductMedia(slug, slot)` côté serveur
- Cascade : DB binding → fallback registry codé
- `<ProductMedia productSlug="..." slot="packshot" />`

### Critères Phase B

- [ ] Édition d'un produit + upload packshot fonctionne e2e
- [ ] Le packshot apparaît sur `/produits/[slug]` après publish
- [ ] Tests Playwright : edit → upload → save → vérif front

---

## Phase C — Variantes + pricing

### C.1 — Schéma variantes

- Une variante = `{ sku, label, priceCents, promoPriceCents?, currency, inventoryStatus }`
- `inventoryStatus`: `'available' | 'low_stock' | 'out_of_stock' | 'preorder'`
- Optionnels : `weightG`, `attributes` (jsonb : taille, parfum, …)

### C.2 — Sous-form variantes

- Onglet **Variantes** dans `/admin/products/[slug]`
- Liste éditable inline (ajouter / réorganiser / supprimer)
- Chaque ligne : SKU, label, prix, promo, stock
- Validation Zod : SKU unique par produit, `promo < prix`

### C.3 — Pricing helpers

- `formatPrice({ amountCents, currency, locale })`
- `computeDiscount({ priceCents, promoPriceCents })` → `{ percentage, savedCents }`

### C.4 — API variantes

- `POST   /api/admin/products/[slug]/variants`
- `PATCH  /api/admin/products/[slug]/variants/[id]`
- `DELETE /api/admin/products/[slug]/variants/[id]`
- Réordonnancement par `position` (drag & drop optionnel)

### Critères Phase C

- [ ] CRUD variantes complet
- [ ] Validation : SKU unique, promo cohérent
- [ ] Tests RTL pour le sous-form
- [ ] Le front affiche les variantes (sélecteur)

---

## Phase D — Publication + audit

### D.1 — Draft / publish

- Bouton **Publier** en haut de `/admin/products/[slug]`
- Désactivé si erreurs Zod ou champs requis manquants
- Confirmation modale : « Publier la version courante ? »

### D.2 — Snapshots

- À chaque publish : ligne dans `product_snapshots` (payload complet)
- Onglet **Historique** dans la page détail (50 derniers)

### D.3 — Restore

- Action **Restaurer** sur un snapshot → copie le payload dans le draft
- Diff visuel champ par champ

### D.4 — Audit

- `logAuditEvent({ resource: 'product', action: 'publish' | 'update' | 'archive' })`
- Actor + diff dans le payload

### Critères Phase D

- [ ] Publish gélère un snapshot consultable
- [ ] Restore + diff fonctionne
- [ ] Audit log écrit pour chaque mutation
- [ ] Test e2e : edit → publish → edit → restore → publish → 2 snapshots

---

## Sequencing & dépendances

```
A ──► B ──► C ──► D
```

Linéaire : chaque phase étend la précédente.

## Hors scope (post-v1)

- Multi-locale produits
- Bulk import CSV
- Intégration paiement / e-commerce réel
- A/B testing de packshot
- Stock temps réel (intégration ERP)
