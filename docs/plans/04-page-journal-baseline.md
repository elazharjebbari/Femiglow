# Plan 04 — Page Journal — Baseline

> Mesures et état initial avant exécution du Plan 04. Capturé le 2026-05-02.

## État initial du scaffold

- Fichier : `apps/web/src/app/(marketing)/journal/page.tsx`
- Server Component minimal : appel `cms.getArticles({ limit: 12 })` → grille uniforme.
- Hero générique : kicker `Journal`, titre `display-lg` « Saisons, matières, voix. », intro courte.
- 3 articles dans le mock (`apps/web/src/data/mock/articles.ts`), tous flagués `isFeatured: true`.
- Aucun filtre catégorie, aucun LoadMore, aucun featured 60/40, aucune newsletter ni cross-link sur la page.
- `metadata` statique, aucun JSON-LD `Blog`/`BlogPosting`.

## Composants déjà disponibles

- `NewsletterBlock` (Plan 01) — réutilisable.
- `Fleuron` (UI primitif) — disponible.
- `Image`, `Heading`, `Kicker`, `Text`, `Container`, `Button`, `ButtonLink` — disponibles.
- `JournalGrid`, `JournalExtraits` — composants existants pour autres pages, pas réutilisables tels quels pour le hub.

## Composants manquants (à créer)

| Composant            | Type             |
| -------------------- | ---------------- |
| `ArticleCard`        | Server           |
| `CategoryPills`      | Server + enhance |
| `FeaturedArticle`    | Server           |
| `LoadMoreButton`     | Client           |
| `JournalHero`        | Server           |
| `ArticleGrid`        | Client           |
| `CrossLinkBanner`    | Server           |
| Route `/api/articles`| Route handler    |

## Écarts contrat CMS

- `getArticles` retourne `Article[]`, pas `{items, nextCursor}`.
- Décision : ajouter `getArticlesPage({ limit, cursor?, category? })` à côté de `getArticles` legacy → pas de cassage des 6 appels existants (`page.tsx`, `rituel`, `kit`, `[slug]`, `sitemap`).

## Mock à enrichir

- 3 articles → 15 (3 par catégorie : `maison`, `saison`, `voix`, `matieres`, `pratique`).
- Au moins 1 `isFeatured: true` (le plus récent).

## Métriques avant / après

| Métrique                     | Baseline | Cible    | Après |
| ---------------------------- | -------- | -------- | ----- |
| Articles affichés            | 3        | 12 + LoadMore | 12 + LoadMore (15 mock, page 1 = 12, page 2 = 3) |
| Filtres catégorie            | 0        | 6 pills (Toutes + 5) | 6 pills, `aria-current="page"` actif |
| Featured 60/40               | absent   | présent  | présent (slug `voix-de-sara`, `priority`, h2 italic) |
| JSON-LD                      | absent   | Blog + 3× BlogPosting | Blog + 3× BlogPosting (featured + 2 grid) |
| Newsletter sur page          | absent   | bandeau sauge | `NewsletterBlock` réutilisé |
| Cross-link maison            | absent   | bannière 50/50 | `CrossLinkBanner` 50/50 lazy |
| Tests Vitest dédiés          | 0        | ≥ 4 fichiers | 5 fichiers / 19 tests (ArticleCard, CategoryPills, FeaturedArticle, JournalHero, getArticlesPage) |
| Violations axe               | _        | 0        | 0 sur `/journal` et `/journal?category=saison` |
| First Load JS `/journal`     | _        | ≤ 110 kB | 130 kB (gap accepté, identique à `/kit`) |
| Vitest global                | _        | tout vert | 84 / 84 |
| TypeScript / ESLint          | _        | 0 erreur | 0 / 0 |

Capture mobile 375 px : `Saisons, matières, voix.` + 3 cards verticales (Pratique, Matières, Saison). Pas de bandeau, pas de pills, pas de featured.
