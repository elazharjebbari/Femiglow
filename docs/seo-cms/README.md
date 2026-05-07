# Module SEO-CMS

Pilotage centralisé des metadata SEO, OG images dynamiques, audit
linter et previews SERP/Facebook/Twitter depuis l'admin FemiGlow.

## Vision

Le repo expose deja une couche SEO solide (13 pages avec `metadata`,
JSON-LD complet, sitemap/robots dynamiques, OG SVG). Ce qui manque :

- Une interface admin pour editer ces metadata sans toucher au code
- Generation OG images dynamiques (`next/og`) versus SVG statiques
- Un linter SEO inline (longueurs, mots-cles, JSON-LD valide)
- Previews fideles SERP / Facebook / Twitter
- Snapshots et restore (idem components-CMS)

Le module ajoute une couche **d'overrides** au-dessus des defaults
existants. Aucun `metadata`/`generateMetadata` actuel n'est
supprime : tout passe par un helper `resolveSeoMetadata()` qui
applique la cascade defaults -> settings -> overrides.

## Ce que livre le module

| Capacite | Surface |
|---|---|
| Edition title/description/OG/Twitter | `/admin/seo` |
| Settings globaux (org JSON-LD, defaults) | `/admin/seo/settings` |
| OG images dynamiques | `GET /api/og/[scope]/[targetKey]` |
| Audit linter | `POST /api/admin/seo/audit` |
| Previews live | composants `SerpPreview`, `FacebookPreview`, `TwitterPreview` |
| Snapshots / restore | table `seo_audit_snapshots` |
| Cascade serveur | helper `resolveSeoMetadata()` |

## Plan d'action condense

| Phase | Theme | Livrables |
|---|---|---|
| A | Foundation | Migration, queries Drizzle, API GET/PATCH, page liste + detail simple |
| B | Preview & linter | SerpPreview, FacebookPreview, TwitterPreview, regles linter |
| C | OG dynamique | Route `/api/og/[scope]/[targetKey]`, templates marketing/article/product |
| D | Settings + audit | Page settings, snapshots, restore |

Detail : [`action-plan/01-phases.md`](./action-plan/01-phases.md).

## Index docs

### Architecture
- [Vue d'ensemble](./architecture/01-overview.md)
- [Modele de donnees](./architecture/02-data-model.md)
- [Strategie merge / cascade](./architecture/03-merge-cascade-strategy.md)

### Backend
- [Routes API admin](./backend/01-api-routes.md)
- [Validation Zod](./backend/02-zod-validation.md)
- [OG images dynamiques](./backend/03-og-image-generation.md)

### Frontend
- [UI admin](./frontend/01-admin-ui.md)
- [Linter / audit](./frontend/02-seo-linter-audit.md)
- [Previews SERP / FB / Twitter](./frontend/03-preview-serp.md)

### Testing
- [Strategie](./testing/01-strategy.md)
- [Handlers MSW](./testing/02-msw-handlers.md)
- [Scenarios Playwright](./testing/03-playwright-scenarios.md)

### Runbook
- [Deploiement](./runbook/01-deployment.md)

### Action plan
- [Phases A -> D](./action-plan/01-phases.md)

## Contraintes transverses

- Rester compatible avec `apps/web/src/lib/seo/json-ld.tsx` (les JSON-LD existants ne sont pas reecrits, juste augmentes)
- Pas de regression sur `sitemap.ts` / `robots.ts`
- Les overrides peuvent etre `noindex` -> sitemap doit l'exclure
- AdminShell pattern : `requireAdmin()` RSC, `getAdminSession()` API
- Cache : `revalidateTag('seo')` apres toute mutation
