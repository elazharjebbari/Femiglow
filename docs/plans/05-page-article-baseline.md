# Plan 05 — Page Article — Baseline

> Mesures et état initial avant exécution du Plan 05. Capturé le 2026-05-03.

## État initial du scaffold

- Fichier : `apps/web/src/app/(marketing)/journal/[slug]/page.tsx`
- Server Component minimal :
  - `cms.getArticleBySlug(params.slug)` puis `notFound()` si absent.
  - Hero textuel sans image breakout (Container `prose` puis Container
    `content` avec image 16:9 `priority`).
  - Body rendu via `article.body.split('\n\n').map(...)` → ignore h2/h3,
    blockquote, listes, liens, code. Aucun rendu markdown sécurisé.
  - Aucun `ArticleHero`, `ArticleMeta`, `TableOfContents`, `ReadingProgress`,
    `ShareButtons`, `AuthorCard`, `RelatedArticles`, drop cap.
  - Aucun `NewsletterBlock` en fin d'article.
- `generateMetadata` : title/description/canonical/OG basiques (`type: 'article'`,
  `publishedTime`, `authors`, `images`). **Pas** de `modifiedTime`, `section`,
  Twitter card, JSON-LD.
- `generateStaticParams` : 100 articles max (suffisant Phase 1).
- `revalidate = 3600` ✓.

## Composants déjà disponibles

- `JsonLd`, `articleSchema(article)` (Plan 01) — mais non utilisés sur la page.
- `Container`, `Heading`, `Image`, `Kicker`, `Text`, `Fleuron` — disponibles.
- `ArticleCard` (Plan 04) — réutilisable pour `RelatedArticles`.
- `NewsletterBlock` (Plan 01) — réutilisable.

## Composants manquants (à créer)

| Composant            | Type    |
| -------------------- | ------- |
| `ReadingProgress`    | Client  |
| `ArticleHero`        | Server  |
| `ArticleMeta`        | Server  |
| `TableOfContents`    | Client  |
| `ArticleProse`       | Server  |
| `AuthorCard`         | Server  |
| `ShareButtons`       | Client  |
| `RelatedArticles`    | Server  |

## Pipeline markdown — choix Phase 1

**`unified` + `remark-parse` + `remark-gfm` + `remark-rehype` + `rehype-slug`
+ `rehype-autolink-headings` + `rehype-sanitize` + `rehype-stringify`** —
purement RSC, HTML statique, ultra-léger. Phase 2 : `@portabletext/react`
quand le `body` Sanity devient Portable Text.

## Mock — état actuel

- 15 articles, 1 seul `isFeatured` (`voix-de-sara`).
- `body` : texte plat très court (1 à 3 phrases). À enrichir au moins sur
  l'article cible `hiver-ongles-patience` avec ~800 mots, 3 h2, 1 blockquote,
  1 image, 1 lien interne, 1 lien externe pour servir de matière de tests.

## Métriques avant / après

| Métrique                          | Baseline | Cible    | Après  |
| --------------------------------- | -------- | -------- | ------ |
| Hero breakout 100vw               | absent   | présent  | présent (`ArticleHero` 16:9 `priority`) |
| Sanitisation markdown             | absente  | XSS test paranoïaque | `rehype-sanitize` + test paranoïaque vert |
| Table des matières                | absente  | sticky desktop ≥ 1280 px | sticky `top-24` `xl:block`, `IntersectionObserver` |
| Reading progress                  | absente  | bar fixed 2 px | bar `fixed` 2 px, scaleX via rAF, `aria-hidden` |
| Drop cap                          | absent   | présent (CSS, désactivable) | `:first-of-type::first-letter` 96 pt, `.no-drop-cap` |
| Boutons partage                   | absent   | 3 boutons (copier/email/LinkedIn) | 3 boutons + `aria-live="polite"` |
| Encart auteur                     | absent   | présent  | `AuthorCard` (avatar 80 px + bio) |
| Articles connexes                 | absent   | 3 cards filtrées par catégorie | `RelatedArticles` 3 cards même catégorie |
| Newsletter inline                 | absent   | `NewsletterBlock` réutilisé | `NewsletterBlock` réutilisé (source `article-{slug}`) |
| JSON-LD `BlogPosting` + `BreadcrumbList` | absent | présent | 2 blocs (`BlogPosting` enrichi + `BreadcrumbList`) |
| Tests Vitest dédiés               | 0        | ≥ 4 fichiers (XSS + composants) | 4 fichiers, 14 tests verts (render + 3 composants) |
| Violations axe                    | _        | 0        | 0 (vérifié sur `/journal/hiver-ongles-patience`) |
| TypeScript / ESLint               | _        | 0 / 0    | 0 / 0  |
| First Load JS `/journal/[slug]`   | _        | _        | 1.75 kB / 128 kB |
| Build SSG                         | _        | _        | 15/15 articles préfabriqués |
| Suite Vitest globale              | 84       | _        | 98 verts (28 fichiers) |
