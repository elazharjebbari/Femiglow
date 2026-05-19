# 01 — Contexte et audit du système SEO

Document de référence pour comprendre l'état initial du système SEO avant exécution du plan. Synthèse de l'audit statique du 19 mai 2026 sur le code de `apps/web/` et `packages/`.

## 1. Périmètre audité

L'audit a couvert trois couches :

- **Rendu public** : `apps/web/src/app/**` (App Router Next.js 14), `apps/web/src/lib/seo/**`, `apps/web/src/app/sitemap.ts`, `apps/web/src/app/robots.ts`, `apps/web/src/middleware.ts`, `apps/web/next.config.js`.
- **Modèle CMS et API backend** : `apps/web/src/lib/db/schema.ts` (tables Drizzle), `apps/web/src/lib/db/queries/seo.ts` (repositories), `apps/web/src/lib/seo/**` (services, schemas, resolve), `apps/web/src/app/api/admin/seo/**` (routes API).
- **Interface admin** : `apps/web/src/app/admin/seo/**` (routes), `apps/web/src/components/admin/seo/**` (composants).

## 2. Architecture observée

Le système SEO existant est mature et bien structuré. La hiérarchie de résolution est :

```
defaults TypeScript (lib/seo/defaults.ts)
        |
        v
seoSettings (singleton DB)
        |
        v
seoOverrides (par scope/targetKey/locale, publishedAt non null)
        |
        v
unstable_cache (tag 'seo' + tag 'seo:{scope}:{targetKey}')
        |
        v
generateMetadata() dans chaque page
```

À chaque publication d'un override ou modification des settings globaux, `revalidateTag` invalide chirurgicalement le cache concerné. Les snapshots d'audit immuables permettent le rollback.

## 3. Inventaire détaillé

### 3.1 Schéma Drizzle (`apps/web/src/lib/db/schema.ts` L1223-L1292)

Trois tables dédiées :

- `seoOverrides` — overrides par cible (scope, targetKey, locale), index unique `(scope, targetKey, locale)`, champs publishedAt/draftedAt, FK vers `media` (ogImageMediaId) et `adminUsers` (createdBy).
- `seoSettings` — singleton avec defaults globaux (siteName, defaultDescription, defaultOgImageMediaId, twitterHandle, organizationJsonLd, defaultRobotsIndex/Follow, knownPages).
- `seoAuditSnapshots` — snapshots immuables sauvegardés à chaque publication, payload JSON complet.

### 3.2 Services (`apps/web/src/lib/seo/`)

- `resolve.ts` — `resolveSeoMetadata(scope, targetKey, locale, fallback?)` wrappé `unstable_cache`, cascade override → settings → defaults, failsafe si DB indisponible.
- `schemas.ts` — Zod schemas avec contraintes (title 1-120, description 1-320, keywords ≤ 20, canonical absolu, targetKey kebab-case, locale `[a-z]{2}(-[A-Z]{2})?`).
- `defaults.ts` — defaults TypeScript pour fallback ultime.
- `rules/index.ts` — règles d'audit pour le linter live.

### 3.3 API routes admin (`apps/web/src/app/api/admin/seo/`)

| Route | Méthode | Rôle |
|---|---|---|
| `/api/admin/seo` | GET / POST | List / create override |
| `/api/admin/seo/[id]` | GET / PATCH / DELETE | CRUD individuel |
| `/api/admin/seo/[id]/publish` | POST | Publier + snapshot + revalidate |
| `/api/admin/seo/[id]/unpublish` | POST | Dépublier |
| `/api/admin/seo/[id]/snapshots` | GET | Historique snapshots |
| `/api/admin/seo/[id]/restore` | POST | Restaurer depuis snapshot |
| `/api/admin/seo/settings` | GET / PATCH | Settings globaux |
| `/api/admin/seo/bulk` | POST | Opération batch |
| `/api/admin/seo/audit` | GET | Audit linter (preview) |

Validation Zod systématique, `getAdminSession()` sur chaque route.

### 3.4 Admin UI (`apps/web/src/app/admin/seo/` et `apps/web/src/components/admin/seo/`)

- Routes : liste, new, edit, settings.
- Composants : `SeoOverrideEditor`, `SeoSettingsEditor`, `SeoLinterPanel`, `SeoHistoryPanel`, `SeoBulkPanel`, `SeoBulkActionBar`.
- Previews : SERP Google, Facebook OG, Twitter card.
- Linter debounced 350ms avec score 0-100.

## 4. Findings classés par priorité

### P0 — Bloquant qualité, fix immédiat

| ID | Item | Symptôme | Localisation |
|---|---|---|---|
| F-01 | `/commander` sans metadata explicite | Title/description hérités du root (`FemiGlow — Le rituel...`) → duplication avec home | `apps/web/src/app/(commerce)/commander/page.tsx` |
| F-02 | `/merci` sans metadata explicite | Idem F-01 | `apps/web/src/app/(commerce)/merci/page.tsx` |
| F-03 | Bulk delete SEO sans confirmation | Risque de suppression massive accidentelle | `apps/web/src/components/admin/seo/SeoBulkActionBar.tsx` |

### P1 — Manque structurel, sprint en cours

| ID | Item | Effort | Localisation cible |
|---|---|---|---|
| F-04 | `lastModified` sitemap = `new Date()` à chaque build | 2 h | `apps/web/src/app/sitemap.ts` |
| F-05 | Pas de media picker pour OG image (saisie manuelle de `mediaId`) | 1 j | `apps/web/src/components/admin/seo/SeoOverrideEditor.tsx` + nouveau `OgImagePicker.tsx` |
| F-06 | Pas d'UI affichant l'audit log SEO (events en DB mais invisibles) | 0,5 j | Nouveau composant `SeoAuditLogPanel.tsx` |
| F-07 | Endpoint OG image generation manquant alors que templates `marketing/article/product` existent en DB | 2 j | Nouveau `apps/web/src/app/api/og/[template]/route.tsx` |
| F-08 | Scope `'component'` déclaré mais non câblé au rendu des composants CMS | 2 j | `lib/seo/resolve.ts` + rendu slots/composants |

### P2 — Confort et passage à l'échelle, backlog

| ID | Item | Effort |
|---|---|---|
| F-09 | `Cache-Control` HTML pages statiques absent (CDN ne cache pas) | 30 min |
| F-10 | Trailing slash et UTM non normalisés dans canonical | 0,5 j |
| F-11 | UI hreflang / alternates par-page pour expansion multilingue | 1 j |
| F-12 | Sitemap viewer et robots.txt preview dans admin | 0,5 j |
| F-13 | Snapshot diff visuel (avant/après publication) | 1 j |

## 5. Points forts du système existant

- Cascade de résolution propre avec failsafe DB-down.
- Audit trail double : `auditEvents` + `seoAuditSnapshots` immuables.
- Linter en temps réel dans l'admin avec score numérique.
- Cache par tag, revalidation chirurgicale.
- Multi-locale natif dans le schéma.
- Bots IA refusés explicitement dans `robots.ts`.
- Couverture JSON-LD large : Organization, WebSite, Product, FAQPage, HowTo, BlogPosting, BreadcrumbList, LocalBusiness, ContactPoint.

## 6. Hypothèses retenues pour le plan

- Le site reste **monolangue fr-MA** à court terme ; l'UI hreflang est planifiée en phase 6 mais l'i18n applicative n'est pas livrée ici.
- La base PostgreSQL avec Drizzle est stable, **aucune migration destructive** n'est envisagée ; on ajoute une table `seoOverrides` non — on étend l'usage du scope existant.
- Le système MediaLibrary admin existe et expose un picker réutilisable (à vérifier en phase 2, sinon prévoir extraction).
- La feature flag `NEXT_PUBLIC_SEO_COMPONENT_OVERRIDES` permettra de basculer la phase 5 progressivement (kit hero d'abord, puis autres composants).

## 7. Risques identifiés

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| Régression metadata sur pages critiques (`/kit`, `/journal/[slug]`) lors du branchement composant | Moyen | Élevé | Tests Vitest avec snapshots + Playwright sur `/kit`, lecture du header `x-seo-source` |
| Cache `unstable_cache` non invalidé pour le scope `component` | Moyen | Moyen | Tests d'intégration MSW + tag dédié `seo:component:{key}` + revalidation déclenchée à la publication |
| Génération OG image dynamique trop lente (>1 s) | Faible | Moyen | Cache CDN avec stale-while-revalidate, taille image ≤ 100 KB, test Playwright avec timing |
| Bulk delete UX ambiguë → suppression non voulue | Faible (après fix) | Élevé | Modale de confirmation avec saisie du nombre attendu de cibles |

## 8. Sources et références

- Audit interne du 2026-05-19 (transcript de la session).
- `docs/admin/` — conventions admin.
- `docs/components-cms/` — système de composants pilotés par CMS, référence pour la phase 5.
- `docs/kit-hero-optim/04-test-strategy.md` — patterns de tests utilisés pour le hero, à dupliquer pour le SEO composant.
