# SEO-CMS — Plan d'action (Phases A → D)

> 4 phases livrables incrémentalement. Chaque phase est testable de bout
> en bout (DB → API → UI → e2e) et déployable seule.
> Référence : [`README.md`](../README.md).

## Vue d'ensemble

| Phase | Thème                | Durée estimée | Livrables clés |
|-------|----------------------|---------------|----------------|
| A     | Foundation           | 3 j           | Migration, queries, API GET/PATCH, page liste + détail simple |
| B     | Preview & linter     | 2 j           | SerpPreview, FacebookPreview, TwitterPreview, règles linter |
| C     | OG dynamique         | 2 j           | Route `/api/og/[scope]/[targetKey]`, templates marketing/article/product |
| D     | Settings + audit     | 2 j           | Page settings, snapshots, restore |

Total : ~9 jours-personnes. Aucune phase ne casse les phases précédentes.

---

## Phase A — Foundation

**Objectif** : pouvoir éditer manuellement un override SEO depuis l'admin
et voir l'effet sur la page publique après publication.

### A.1 — Migration Drizzle

- Fichier : `apps/web/drizzle/migrations/0007_seo_cms.sql`
- Schéma : `apps/web/src/lib/db/schema/seo.ts`
- Tables : `seo_overrides`, `seo_settings`, `seo_audit_snapshots`
- Cf. [`architecture/02-data-model.md`](../architecture/02-data-model.md)

### A.2 — Queries Drizzle

- `getOverride(scope, targetKey, locale)` → `SeoOverride | null`
- `listOverrides({ scope?, search? })` → `SeoOverride[]`
- `upsertOverride(input)` → `SeoOverride`
- `publishOverride(id, actorId)` → snapshot + `published_at`
- `getSettings()` → `SeoSettings` (singleton)

### A.3 — API admin

- `GET    /api/admin/seo`              → liste paginée
- `GET    /api/admin/seo/[id]`         → détail (draft + publié)
- `POST   /api/admin/seo`              → création override
- `PATCH  /api/admin/seo/[id]`         → mise à jour draft
- `POST   /api/admin/seo/[id]/publish` → publication
- `DELETE /api/admin/seo/[id]`         → soft delete (RBAC editor+)

### A.4 — Helper `resolveSeoMetadata()`

- Fichier : `apps/web/src/lib/seo/resolve.ts`
- Cascade : defaults app → `seo_settings` → `seo_overrides` (publié)
- Wrappé dans `unstable_cache` avec tag `seo`

### A.5 — Page admin liste + détail

- `/admin/seo` (RSC) : table des overrides + filtres `scope`
- `/admin/seo/[id]` : formulaire simple (title, description, canonical, robots)
- Bouton **Publier** + toast de confirmation

### Critères d'acceptance Phase A

- [ ] Migration appliquée, seed peuple `known_pages` (13 entrées)
- [ ] CRUD complet via API + tests Vitest
- [ ] L'admin peut créer un override `home`, le publier, voir le `<title>` changer
- [ ] `revalidateTag('seo')` invalide bien le cache
- [ ] Audit log écrit pour chaque mutation

---

## Phase B — Preview & linter

**Objectif** : feedback immédiat sur la qualité SEO d'un override avant publication.

### B.1 — Composants preview

- `SerpPreview` (Google desktop / mobile)
- `FacebookPreview` (carte OG)
- `TwitterPreview` (`summary` / `summary_large_image`)
- Layout 3 onglets dans `/admin/seo/[id]`

### B.2 — Règles linter

| Règle                             | Sévérité | Détail |
|-----------------------------------|----------|--------|
| `title` ≤ 60 chars                | warning  | tronque en SERP |
| `title` ≥ 30 chars                | info     | pourrait être plus riche |
| `description` ≤ 160 chars         | warning  | |
| `description` non vide            | error    | |
| `keywords` ≤ 20                   | warning  | |
| OG image absente                  | warning  | |
| OG image dimension < 1200×630     | warning  | |
| `canonical` URL absolue           | error    | |
| `robots: noindex` + dans sitemap  | error    | (sitemap.ts doit l'exclure) |
| JSON-LD invalide                  | error    | parse JSON + check `@context` |

### B.3 — API audit

- `POST /api/admin/seo/audit` → `{ results: AuditResult[] }`
- Body : `{ overrideId }` ou `{ payload }` (preview live, sans persister)

### B.4 — UI audit

- Panneau latéral droit dans `/admin/seo/[id]`
- Compteur erreurs / warnings / info
- Click sur une règle → highlight du champ concerné

### Critères d'acceptance Phase B

- [ ] Les 3 previews rendent en < 100 ms côté client
- [ ] Le linter renvoie les bonnes sévérités sur 10 fixtures
- [ ] Tests RTL pour chaque preview
- [ ] Tests Playwright : éditer un title trop long → warning visible

---

## Phase C — OG dynamique

**Objectif** : générer des OG images PNG au runtime, sans dépendre de fichiers SVG statiques.

### C.1 — Route `next/og`

- Fichier : `apps/web/src/app/api/og/[scope]/[targetKey]/route.tsx`
- Runtime : `edge`
- Cache : `Cache-Control: public, max-age=3600, stale-while-revalidate=86400`

### C.2 — Templates

- `marketing` (default) — fond crème, logo, titre Cormorant
- `article` — image hero + chapeau + auteur
- `product` — packshot + nom + prix
- `default` — fallback pure typographique

### C.3 — Polices custom

- Inter (latin) + Cormorant Garamond (latin)
- Chargées depuis `/public/fonts/og/` via `fetch()` dans la route
- Subsetting pour rester < 100 KB

### C.4 — Intégration overrides

- Si `og_image_media_id` présent → renvoyer le média (passthrough)
- Sinon si `og_image_template` présent → render le template
- Sinon → fallback SVG existant (pas de régression)

### Critères d'acceptance Phase C

- [ ] Route répond en < 800 ms en cold (edge)
- [ ] PNG 1200×630, < 200 KB
- [ ] Test Playwright : changer template → OG visible dans Facebook debugger
- [ ] Pas de régression sur les pages sans override

---

## Phase D — Settings + audit

**Objectif** : centraliser les defaults globaux et permettre le restore d'une version antérieure.

### D.1 — Page `/admin/seo/settings`

- Edition `siteName`, `defaultDescription`, `twitterHandle`
- Edition `organizationJsonLd` (textarea + validation Zod stricte)
- Picker `defaultOgImageMediaId` (réutilise MediaPicker)

### D.2 — Snapshots

- À chaque publish → ligne dans `seo_audit_snapshots`
- Liste des snapshots dans `/admin/seo/[id]` → onglet **Historique**
- Action **Restaurer** → copie le payload dans le draft (pas re-publié auto)

### D.3 — Diff visuel

- Composant `<SeoDiff before={...} after={...} />`
- Champ par champ : `title`, `description`, `og_*`, etc.

### Critères d'acceptance Phase D

- [ ] Settings éditables, validation Zod côté serveur
- [ ] Restore d'un snapshot pré-rempli le draft sans publier
- [ ] Historique paginé (50 derniers)
- [ ] Test e2e : edit → publish → edit → restore → diff visible

---

## Sequencing & dépendances

```
A ──► B ──► D
└────► C ──┘
```

- B et C indépendants après A
- D dépend de A et bénéficie de B (diff utilise les previews)

## Hors scope (post-v1)

- Multi-locale active (`fr-MA` only)
- A/B testing de title (Statsig?)
- Auto-suggestion AI de descriptions
- Intégration Google Search Console API
- Bulk actions (publier 10 overrides d'un coup)
