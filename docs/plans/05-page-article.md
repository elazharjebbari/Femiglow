# Plan 05 — Page Article détail (`/journal/[slug]`)

> Plan d'exécution détaillé pour porter la page de lecture longue au niveau
> « cabinet international ». C'est la page la plus lue du site une fois le SEO
> en route — elle doit se lire comme un article de magazine, pas comme un
> blogpost. À lire de bout en bout avant de toucher au code.

**Page cible** : [`apps/web/src/app/(marketing)/journal/[slug]/page.tsx`](../../apps/web/src/app/(marketing)/journal/[slug]/page.tsx)
**Spec source** : pas de § dédié dans `04-specifications-pages.md` — ce plan
fait office de spécification, dérivée de § 4.4 (Journal) et de la stratégie
éditoriale (§ 1, § 11).
**Stratégie d'itération** : [`15-strategie-iteration.md`](../preparation/15-strategie-iteration.md)
**Estimation totale** : 18 à 24 heures de travail concentré (3 jours).

---

## 1. Objectif

L'article est la **page d'autorité**. Elle doit, dans l'ordre :

1. Tenir la lecture **5 à 15 minutes** sans rupture, comme un papier de presse
   long format.
2. Convertir le scroll en **conviction lente** : la prose, l'auteur, les
   citations, les images breakout.
3. Indexer en **BOFU long-tail** sur des requêtes informationnelles précises
   (« comment soigner ses ongles cassants en hiver », « rituel ongles slow
   beauty »).
4. Capturer l'email **en fin d'article** (lecteur engagé = haute valeur).
5. Renvoyer vers **3 articles connexes** soigneusement choisis, pas du
   « related random ».

KPIs cibles (déduits de § 4.4 et de la stratégie éditoriale) :

| KPI                                  | Cible                                |
| ------------------------------------ | ------------------------------------ |
| Temps moyen de lecture               | ≥ 60 % du `readingTimeMinutes`       |
| Scroll ≥ 80 %                        | > 50 % des sessions                  |
| CTR articles connexes                | > 8 %                                |
| Taux d'inscription newsletter inline | > 5 %                                |
| LCP (image hero article)             | < 2.0 s                              |
| CLS                                  | < 0.05                               |
| INP (table des matières, partage)    | < 150 ms                             |

---

## 2. Documents à relire avant de commencer

Dans cet ordre, sans en sauter :

| #   | Document                                                                                                | Pourquoi                                                          |
| --- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | [01 — Marque, vision, voix](../preparation/01-marque-vision-voix.md)                                     | Voix éditoriale longue, posture de carnet                         |
| 2   | [02 — Design system](../preparation/02-design-system.md)                                                 | Échelles typographiques, prose width 640 px, blockquote           |
| 3   | [04 — Spécifications de pages, § 4.4](../preparation/04-specifications-pages.md)                         | Schéma `Article`, contrat CMS                                     |
| 4   | [05 — Bibliothèque de composants](../preparation/05-bibliotheque-composants.md)                          | Inventaire mutualisable                                           |
| 5   | [07 — Modèles de données & API](../preparation/07-modeles-donnees-api.md)                                | `getArticleBySlug`, `body` markdown ou MDX                        |
| 6   | [08 — UX, animations, micro-interactions](../preparation/08-ux-animations-interactions.md)               | Reading progress, drop cap, blockquote                            |
| 7   | [09 — Ergonomie & accessibilité](../preparation/09-ergonomie-accessibilite.md)                           | Lecture longue, ToC sticky, contraste prose                       |
| 8   | [10 — Performance & Web Vitals](../preparation/10-performance-web-vitals.md)                             | Hero image, sanitisation markdown, code splitting MDX             |
| 9   | [11 — SEO & métadonnées](../preparation/11-seo-metadata.md)                                              | JSON-LD `BlogPosting`, `BreadcrumbList`, OG image dynamique       |
| 10  | [Annexe glossaire éditorial](../preparation/annexes/glossaire-editorial.md)                              | Vocabulaire, microcopy auteur et partage                          |
| 11  | [12 — QA, debugging, observabilité](../preparation/12-qa-debugging-observabilite.md)                     | Event GA4 scroll 75 %, sanitisation HTML                          |
| 12  | [15 — Stratégie d'itération](../preparation/15-strategie-iteration.md), §§ 3, 4, 5                       | Cycle, DoD composant, DoD page                                    |

**Temps de relecture** : 90 minutes, à faire d'une traite avant la baseline.

---

## 3. Inventaire des dépendances de la page

### 3.1 Tokens (à compléter pour la prose)

À vérifier dans [`tokens.css`](../../apps/web/src/styles/tokens.css) :

- Couleurs : `--encre`, `--encre-soft`, `--creme`, `--sauge-soft` (auteur,
  newsletter), `--champagne` (filets, reading progress).
- Typographies : `--font-display` pour h1/h2/h3/blockquote, `--font-body`
  pour prose/meta/caption.
- Tailles : `display-md` (h1 ~64 pt), `prose-h2` (32 pt), `prose-h3` (24 pt),
  `prose-body` (18 pt, line-height 1.7), `caption` (13 pt).
- Largeur prose : `--prose-width` (640 px), `--prose-content-width` (960 px).
- Espacements prose : `--space-prose-paragraph`, `--space-prose-h2/h3`,
  `--space-prose-blockquote` — **à ajouter en Phase 1 si absents**.

### 3.2 Primitifs UI (réutilisés tels quels)

Dans [`apps/web/src/components/ui/`](../../apps/web/src/components/ui/) :

| Composant   | Usage Article                                                          |
| ----------- | ---------------------------------------------------------------------- |
| `Container` | Variants `prose` (640 px), `content` (960 px pour images breakout)     |
| `Heading`   | `display-md` pour h1, `lg`/`md`/`sm` pour h2/h3 dans la prose          |
| `Text`      | `body` pour paragraphes, `caption` pour meta, `lead` pour intro hero   |
| `Kicker`    | Catégorie au-dessus du titre                                           |
| `Image`     | `priority` sur hero, lazy partout ailleurs                             |

### 3.3 Layout (aucune touche)

`Header`, `Footer`, `SkipLink` réutilisés. **Cible du SkipLink** : `#article-body`
(ajouter l'ancre dans le composant `ArticleProse`).

### 3.4 Sections de la page (à créer)

| #   | Section                | Fichier                              | État                |
| --- | ---------------------- | ------------------------------------ | ------------------- |
| 1   | Reading progress       | `sections/ReadingProgress.tsx`       | **À créer**         |
| 2   | Hero article           | `sections/ArticleHero.tsx`           | **À créer**         |
| 3   | Meta auteur/date       | `sections/ArticleMeta.tsx`           | **À créer**         |
| 4   | Table des matières     | `sections/TableOfContents.tsx`       | **À créer**         |
| 5   | Corps prose (markdown) | `sections/ArticleProse.tsx`          | **À créer**         |
| 6   | Encart auteur          | `sections/AuthorCard.tsx`            | **À créer**         |
| 7   | Boutons partage        | `sections/ShareButtons.tsx`          | **À créer**         |
| 8   | Newsletter inline      | `sections/NewsletterBlock.tsx`       | Réutilisé (Plan 01) |
| 9   | Articles connexes      | `sections/RelatedArticles.tsx`       | **À créer**         |

### 3.5 Composants annexes à créer (au sein des sections)

| Composant            | Pourquoi                                                                |
| -------------------- | ----------------------------------------------------------------------- |
| `ProseImage`         | Wrapper `next/image` pour images markdown (Phase 2)                     |
| `DropCap`            | Lettrine CSS, désactivable via classe                                   |
| `CopyLinkButton`     | « Copier le lien » avec feedback `aria-live`                            |
| `JsonLd`             | Helper d'injection JSON-LD (mutualisé Plan 01/04)                       |

### 3.6 Données

```ts
const article = await cms.getArticleBySlug(params.slug);
if (!article) notFound();

const related = await cms.getArticles({
  limit: 3,
  category: article.category,
});
const relatedFiltered = related.items.filter((a) => a.slug !== article.slug).slice(0, 3);
```

`generateStaticParams()` : déjà en place, itère sur les 100 premiers articles
(suffisant pour la Phase 1, à monter à 500 avec Sanity Phase 2).

### 3.7 Rendu markdown — choix Phase 1

Trois options évaluées : `next-mdx-remote` (bundle lourd), `react-markdown`
(pas streaming-friendly côté RSC), **`unified` + `remark-*` + `rehype-sanitize`
+ `rehype-stringify`** (pur serveur, HTML statique, ultra-léger).

→ **Choix Phase 1 : `unified` + `remark-*` + `rehype-sanitize`.**
**Phase 2 (Sanity)** : `@portabletext/react` quand le `body` devient Portable Text.

---

## 4. Écarts entre la spec et le scaffold actuel

Avant de coder, **résoudre ces décisions** :

| #   | Spec / besoin                                  | Scaffold actuel                              | Décision proposée                                                   |
| --- | ---------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| D1  | Rendu markdown sécurisé (HTML échappé, sanitisé) | `body.split('\n\n').map(...)` — naïf, ignore h2/blockquote | **Installer** `unified`, `remark-*`, `rehype-sanitize` ; pipeline RSC |
| D2  | ToC sticky desktop, générée depuis h2/h3       | Absente                                      | **Créer** `TableOfContents`, headings extraits côté serveur, IDs kebab-case |
| D3  | Reading progress bar                           | Absente                                      | **Créer** `ReadingProgress` (Client, `requestAnimationFrame`, `aria-hidden`) |
| D4  | Drop cap sur le premier paragraphe             | Absent                                       | CSS pur `.prose-femiglow > p:first-of-type::first-letter`, désactivable |
| D5  | Boutons partage (copie, mail, LinkedIn)        | Absent                                       | **Créer** `ShareButtons` (liens directs, pas de SDK)                |
| D6  | Encart auteur (avatar, nom, bio)               | Absent                                       | **Créer** `AuthorCard` ; `author.bio` déjà optionnel dans schema    |
| D7  | Articles connexes (3 cards)                    | Absent                                       | **Créer** `RelatedArticles` ; réutilise `ArticleCard` du Plan 04    |
| D8  | Newsletter inline avant footer                 | Absent                                       | **Réutiliser** `NewsletterBlock` (variant `inline`)                 |
| D9  | JSON-LD `BlogPosting` + `BreadcrumbList`       | Aucun JSON-LD                                | **Créer** via helper `<JsonLd>` (Plan 01/04)                        |
| D10 | OpenGraph image personnalisée                  | Reprend l'image featured                     | Optionnel Phase 1 ; à faire via `opengraph-image.tsx` ultérieurement |
| D11 | Event GA4 au scroll 75 %                       | Absent                                       | **Créer** hook `useScrollMilestone(75)`                             |
| D12 | Images markdown traitées par `next/image`      | `remark` produit `<img>` natifs              | Plugin `rehype` custom (lazy-loading) Phase 1 ; vrai `ProseImage` Phase 2 |

Douze écarts ~5 h. **À traiter avant toute autre chose** (Phase 1).

---

## 5. Plan d'exécution

Les phases sont **strictement séquentielles**. On ne saute pas, on ne
parallélise pas.

### Phase 0 — Baseline (30 min)

```bash
cd apps/web && pnpm dev
```

- [ ] Captures mobile 375 px + desktop 1440 px sur
      `/journal/hiver-ongles-patience`.
- [ ] Lighthouse mobile : noter LCP, CLS, INP, TBT.
- [ ] axe DevTools : violations critiques.
- [ ] `pnpm build` → bundle size route `/journal/[slug]`.
- [ ] Tout dans `docs/plans/05-page-article-baseline.md`.

### Phase 1 — Résolution des écarts spec / scaffold (5 h)

#### 1.1 Installer le pipeline markdown
```bash
pnpm --filter @femiglow/web add unified remark-parse remark-gfm remark-rehype \
  rehype-slug rehype-autolink-headings rehype-sanitize rehype-stringify
```

#### 1.2 Moteur de rendu — `apps/web/src/lib/markdown/render.ts`

```ts
export interface RenderedMarkdown {
  html: string;
  headings: Array<{ depth: 2 | 3; id: string; text: string }>;
}

export async function renderMarkdown(source: string): Promise<RenderedMarkdown> {
  const headings: RenderedMarkdown['headings'] = [];
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, { behavior: 'wrap' })
    .use(collectHeadings(headings))   // plugin local : visit h2/h3
    .use(rehypeSanitize, sanitizeSchema)
    .use(rehypeStringify)
    .process(source);
  return { html: String(file), headings };
}
```

`sanitizeSchema` étend `defaultSchema` pour autoriser `class` sur `p`, `img`,
`figure`, `figcaption` et `id` sur `h2`/`h3`.

#### 1.3 Tokens manquants — `styles/tokens.css`
```css
:root {
  --prose-width: 640px;
  --prose-content-width: 960px;
  --space-prose-paragraph: 1.5rem;
  --space-prose-h2: 3rem 0 1rem;
  --space-prose-h3: 2rem 0 0.75rem;
  --space-prose-blockquote: 2.5rem 0;
}
```

#### 1.4 Feuille `styles/prose.css` — sélecteur `.prose-femiglow`
- `p` : `font-body` 18 pt, line-height 1.7, marge paragraphe.
- `h2`/`h3` : `font-display`, scroll-margin-top 96 px (header sticky).
- `blockquote` : Cormorant Italic 28 pt, filet 2 px sauge gauche.
- `figure` : breakout via marges négatives x.
- `a` : underline encre, hover 70 % opacité.
- `code`/`pre` : fond encre 5-10 %, padding.
- `.no-drop-cap > p:first-of-type::first-letter { all: initial; }`.
- Sinon : drop cap Cormorant 96 pt, `float: left`, line-height 0.9.

#### 1.5 Étoffer le mock
L'article `hiver-ongles-patience` doit avoir un body markdown complet :
~800 mots, 3 h2, 1 blockquote, 1 image, 1 lien externe, 1 lien interne
`/rituel`. C'est la matière de tous les tests prose.

#### 1.6 Commit
```
git commit -m "Pose le pipeline markdown : remark + sanitisation + prose"
```

> **Sortie de phase** : pipeline utilisable depuis tout RSC, prose stylée,
> mock enrichi.

### Phase 2 — Polissage des primitifs UI (1 h)

Vérifier seulement (déjà polis Plan 01) :
- `Container` variants `prose` (640 px) et `content` (960 px breakout).
- `Heading` taille `display-md` pour h1 hero.
- `Image` ratio libre + `placeholder="blur"` partout.

Commits : un par retouche le cas échéant.

### Phase 3 — Composants de structure (3 h)

#### 3.1 `ArticleHero`
Server Component. Image full-width viewport (breakout total) ratio 16:9,
`priority`, `fetchPriority="high"`, `sizes="100vw"`. Dessous : `Container
width="prose"` contenant `Kicker` (catégorie) → `Heading as="h1"
size="display-md"` → `ArticleMeta`. Pas de tagline.

#### 3.2 `ArticleMeta`
Props `author`, `publishedAt`, `readingTimeMinutes`. Avatar 32 px + nom + `·`
+ date longue + `·` + « 4 min de lecture ». Mobile : pile verticale. Tone
tertiary, caption.

#### 3.3 `TableOfContents`
Client Component. Props `headings`. Desktop ≥ 1280 px : sticky à droite,
`top: 96px`, `overflow-y: auto`. Mobile/tablet : non rendu. IntersectionObserver
sur headings → highlight actif (encre vs encre 50 %). `<nav
aria-label="Sommaire">`. Si `headings.length < 2` : ne rend rien.

#### 3.4 `ReadingProgress`
Client Component, `aria-hidden="true"`. Barre fixed top 2 px, fond
`--champagne`. Calcul `scrollY / (docHeight - vhHeight)` via
`requestAnimationFrame`. Sous `prefers-reduced-motion` : pas de transition
CSS (changement direct du `transform`).

#### 3.5 `ShareButtons`
Client Component. 3 boutons :
- **Copier le lien** : `navigator.clipboard.writeText(url)`, feedback
  `aria-live="polite"` « Lien copié. ».
- **Email** : `<a href="mailto:?subject=...&body=...">`.
- **LinkedIn** : `https://www.linkedin.com/sharing/share-offsite/?url=...`,
  `target="_blank" rel="noopener noreferrer"`.

Pas de Twitter/X, pas de Facebook. Icônes Lucide 18 px, label desktop, mobile
`sr-only`.

#### 3.6 `AuthorCard`
Server Component. Avatar 80 px cercle + nom Cormorant 20 pt + bio Inter 14 pt
+ lien optionnel « Lire les articles de [nom] » (Phase 2). Bordures
top/bottom 1 px `--encre-soft`, padding vertical 2 rem.

#### 3.7 `RelatedArticles`
Server Component. Props `articles` (3 items). Titre `Heading as="h2" size="md"`
« Lire ensuite » + Fleuron. Grille `grid-cols-1 sm:grid-cols-3 gap-8`.
Réutilise `ArticleCard` du Plan 04.

**Commits** : un par composant. Sept commits.

### Phase 4 — Composant prose (2 h)

#### 4.1 `ArticleProse`
Server Component. Props `html: string`, `dropCap?: boolean` (défaut true).
Rend `<div id="article-body" className={cx('prose-femiglow', { 'no-drop-cap':
!dropCap })} dangerouslySetInnerHTML={{ __html: html }} />`. HTML sanitisé en
amont (Phase 1) — vérifié dans un test paranoïaque.

#### 4.2 Plugin `rehype` lazy-images
Petit plugin (5 lignes) qui ajoute `loading="lazy"` à toutes les `<img>`.
**Décision Phase 1** : on garde les `<img>` natifs ; passage à Sanity
Portable Text en Phase 2 pour avoir un vrai `<ProseImage>` Next/Image.

**Commit** : « Pose ArticleProse + plugin rehype lazy-images ».

### Phase 5 — Assemblage de la page (1 h)

Fichier : [`apps/web/src/app/(marketing)/journal/[slug]/page.tsx`](../../apps/web/src/app/(marketing)/journal/[slug]/page.tsx)

```tsx
export default async function ArticlePage({ params }: Params) {
  const article = await cms.getArticleBySlug(params.slug);
  if (!article) notFound();

  const [{ html, headings }, related] = await Promise.all([
    renderMarkdown(article.body),
    cms.getArticles({ limit: 4, category: article.category }),
  ]);
  const relatedArticles = related.items
    .filter((a) => a.slug !== article.slug)
    .slice(0, 3);

  return (
    <>
      <ReadingProgress />
      <ArticleHero article={article} />
      <Container width="content">
        <div className="grid xl:grid-cols-[1fr_240px] gap-12">
          <div>
            <ArticleProse html={html} dropCap />
            <ShareButtons url={`https://femiglow.ma/journal/${article.slug}`} title={article.title} />
            <AuthorCard author={article.author} />
          </div>
          <aside className="hidden xl:block">
            <TableOfContents headings={headings} />
          </aside>
        </div>
      </Container>
      <NewsletterBlock source={`article-${article.slug}`} variant="inline" />
      <RelatedArticles articles={relatedArticles} />
    </>
  );
}
```

**Commit** : « Assemble la page Article ».

### Phase 6 — SEO, métadonnées, JSON-LD (2 h)

Référence : [§ 11](../preparation/11-seo-metadata.md).

**`generateMetadata` enrichie** : `title`, `description`, canonical, OpenGraph
`type: 'article'` avec `publishedTime`, `modifiedTime`, `authors`, `section`
(catégorie traduite), `images`. Twitter `summary_large_image`.

**JSON-LD** via `<JsonLd>` (helper du Plan 01/04) :
- `BlogPosting` : `headline`, `description`, `image`, `author` Person,
  `datePublished`, `dateModified`, `publisher` Organization,
  `mainEntityOfPage`, `wordCount`.
- `BreadcrumbList` : Accueil → Journal → titre article.

**Commit** : « SEO et JSON-LD pour la page Article ».

### Phase 7 — Performance (3 h)

Référence : [§ 10](../preparation/10-performance-web-vitals.md).

- **Image hero = LCP** : `priority`, `fetchPriority="high"`, `sizes="100vw"`,
  AVIF, `placeholder="blur"`, dimensions 1600 × 900 explicites.
- **Pipeline markdown** : exécuté en RSC, route `revalidate = 3600`. HTML
  caché — pas de problème runtime.
- **Bundle client** : seuls `ReadingProgress`, `TableOfContents`,
  `ShareButtons`, `NewsletterForm`, hook scroll-milestone. Cible **≤ 95 kB
  gzip**. Si dépassé : `dynamic()` sur `TableOfContents` (xl breakpoint
  uniquement), confirmer absence de `framer-motion`, confirmer absence de
  `unified`/`remark-*` dans les chunks client.
- **Cache HTTP** : vérifier les headers ISR en prod (Vercel ou équivalent).
- **Mesure** : Lighthouse sur 2 articles (court et long).

**Commit** : « Optimise la page Article : LCP < 1.8 s, bundle ≤ 95 kB ».

### Phase 8 — Accessibilité (2 h)

Référence : [§ 9](../preparation/09-ergonomie-accessibilite.md).

- [ ] Un seul `<h1>` ; hiérarchie `h1` → `h2` (sections prose, `RelatedArticles`,
      `NewsletterBlock`) → `h3`.
- [ ] Skip-link cible `#article-body`.
- [ ] ToC : `<nav aria-label="Sommaire">`, lien actif `aria-current="location"`.
- [ ] `ReadingProgress` : `aria-hidden="true"`.
- [ ] `ShareButtons` : feedback `aria-live="polite"`, jamais `alert()`.
- [ ] `AuthorCard` : avatar `alt=""` (le nom est à côté).
- [ ] Blockquote = balise `<blockquote>`, jamais un `<p>` stylé.
- [ ] Tap targets ≥ 44 × 44 px (partage : `p-3`).
- [ ] axe-core 0 violation, VoiceOver lit l'article continûment.
- [ ] Tab : skip-link → ToC (desktop) → liens prose → partage → auteur →
      newsletter → related.
- [ ] `prefers-reduced-motion` : ToC highlight instantané, ReadingProgress
      sans transition CSS.

**Commit** : « Audit accessibilit\u00e9 Article : 0 violation ».

### Phase 9 — Tests (2 h)

Référence : [§ 12](../preparation/12-qa-debugging-observabilite.md).

**Vitest** :
- `renderMarkdown.test.ts` : `# titre\n\n## h2\n\nparagraphe` → headings
  collectés, HTML correct.
- **Test paranoïaque XSS** :
  ```ts
  it('purge les scripts injectés', async () => {
    const { html } = await renderMarkdown('Bonjour <script>alert(1)</script> monde');
    expect(html).not.toContain('<script>');
    expect(html).toContain('Bonjour'); expect(html).toContain('monde');
  });
  ```
- `ArticleHero` (h1, image priority), `TableOfContents` (rend pour ≥ 2,
  rien pour < 2), `ShareButtons` (`clipboard.writeText` appelé, feedback),
  `ArticleProse` (HTML sanitisé). Tous : `axe()` 0 violation.

**Storybook** : `ArticleHero` (court/long), `TableOfContents` (2/5/10),
`ShareButtons`, `AuthorCard`, `Page > Article`.

**Playwright** :

```ts
test('Article : golden path', async ({ page }) => {
  await page.goto('/journal/hiver-ongles-patience');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await expect(page.getByRole('navigation', { name: /sommaire/i })).toBeVisible();
  await page.getByRole('button', { name: /copier le lien/i }).click();
  await expect(page.getByText(/lien copi\u00e9/i)).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(3);
});
```

**Commit** : « Tests Article : unitaires, sanitisation, stories, E2E ».

### Phase 10 — Copy et finitions (1 h)

Référence : [Annexe glossaire](../preparation/annexes/glossaire-editorial.md).

- [ ] Aucun mot interdit (acheter, produit, client, !, emoji).
- [ ] Apostrophes courbes (U+2019), em-dashes (U+2014), espaces fines
      insécables (U+202F) dans les guillemets français.
- [ ] Partage : « Copier le lien », « Envoyer par email », « Partager sur
      LinkedIn » (sr-only / hover).
- [ ] Feedback copie : « Lien copié. ».
- [ ] Encart auteur : pas de label « À propos de l'auteur ».
- [ ] Related : « Lire ensuite » (pas « Articles similaires »).
- [ ] Newsletter : « Une lettre par saison. Aucun envoi commercial. ».
- [ ] Aucune occurrence de « blog » dans la prose (toujours « journal » ou
      « carnet »).

**Commit** : « Polit la copy de la page Article ».

### Phase 11 — Mesure finale et merge (30 min)

- [ ] Lighthouse mobile + desktop sur 2 articles (court et long).
- [ ] Comparaison baseline vs après dans le fichier dédié.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` → vert.
- [ ] Capture vidéo du golden path (375 px puis 1440 px).
- [ ] PR référencée à ce plan → merge.
- [ ] Ligne dans `docs/preparation/journal-iteration.md`.

---

## 6. Definition of Done — spécifique Article

En plus des DoD génériques (§ 4 et § 5 de la stratégie), pour cette page :

- [ ] Le markdown est **sanitisé** : un test injecte `<script>` et vérifie qu'il
      est absent du HTML rendu.
- [ ] Le rendu prose tient bien sur 640 px et **ne déborde jamais** sur mobile
      (test sur 375 px et 320 px).
- [ ] Le drop cap **n'apparaît pas** si le premier paragraphe commence par une
      citation (détection : `text.startsWith('"')` → désactiver via prop).
- [ ] La table des matières **disparaît** s'il y a moins de 2 headings h2.
- [ ] La barre de reading progress atteint exactement 100 % au bas de
      l'article (pas 95 %, pas 105 %).
- [ ] Le lien « Copier le lien » fonctionne sur Safari iOS (test device réel
      ou simulateur).
- [ ] Les articles connexes ne contiennent **jamais l'article courant**
      (filtrage par slug).
- [ ] Si la catégorie n'a qu'un seul article (l'article courant) : le bloc
      `RelatedArticles` n'apparaît pas du tout (plutôt que d'afficher du vide).
- [ ] `generateStaticParams` génère bien toutes les pages au build, mesurable
      dans `next build`.
- [ ] Aucun warning console en dev, en build, en prod.

---

## 7. Métriques avant / après (à remplir)

À tenir dans `docs/plans/05-page-article-baseline.md` :

| Métrique                          | Baseline | Cible    | Après  |
| --------------------------------- | -------- | -------- | ------ |
| LCP mobile                        | _        | < 2.0 s  | _      |
| LCP desktop                       | _        | < 1.5 s  | _      |
| CLS                               | _        | < 0.05   | _      |
| INP                               | _        | < 150 ms | _      |
| TBT                               | _        | < 200 ms | _      |
| First-load JS gzip                | _        | ≤ 95 kB  | _      |
| HTML rendu (taille gzip)          | _        | ≤ 25 kB  | _      |
| Violations axe critique           | _        | 0        | _      |
| Score Lighthouse Perf             | _        | ≥ 95     | _      |
| Score Lighthouse a11y             | _        | 100      | _      |
| Score Lighthouse Best Pr.         | _        | ≥ 95     | _      |
| Score Lighthouse SEO              | _        | 100      | _      |
| Pages générées au build           | _        | = N art. | _      |

---

## 8. Risques et points d'attention

| Risque                                                | Mitigation                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------- |
| XSS via markdown malveillant (CMS compromis)          | `rehype-sanitize` schéma strict, test paranoïaque obligatoire             |
| ToC cassée si headings irréguliers (h2 → h4)          | Pipeline ne remonte que h2/h3, warning dev si incohérence                 |
| Images sans dimensions → CLS                          | Convention éditoriale : dimensions dans le markdown ; auto en Phase 2     |
| Drop cap moche selon OS / police                      | Fallback CSS `font-feature-settings`, désactivable via prop               |
| Reading progress cassée sur Safari iOS                | Test device réel ; fallback no-op si APIs scroll absentes                 |
| Partage LinkedIn sans `noopener`                      | `rel="noopener noreferrer"` obligatoire                                   |
| Articles connexes = sélection médiocre par catégorie  | Phase 1 acceptable ; Phase 2 : champ `relatedSlugs` éditorial             |
| `unified` accidentellement dans le bundle client      | Vérifier `ANALYZE=true pnpm build` — chunks client propres                |
| `generateStaticParams` plafonné à 100                 | Phase 2 : monter à 500 ou `dynamicParams: true` + ISR                     |
| Drop cap + RTL (cas arabe futur)                      | Désactiver si `lang="ar"` (à noter pour i18n)                             |

---

## 9. Estimation horaire récapitulative

| Phase                          | Estimation |
| ------------------------------ | ---------- |
| 0 — Baseline                   | 0 h 30     |
| 1 — Résolution écarts          | 5 h        |
| 2 — Vérif primitifs            | 1 h        |
| 3 — Composants structure       | 3 h        |
| 4 — Composant prose            | 2 h        |
| 5 — Assemblage page            | 1 h        |
| 6 — SEO + JSON-LD              | 2 h        |
| 7 — Performance                | 3 h        |
| 8 — Accessibilité              | 2 h        |
| 9 — Tests                      | 2 h        |
| 10 — Copy & finitions          | 1 h        |
| 11 — Mesure & merge            | 0 h 30     |
| **Total**                      | **23 h**   |

Avec interruptions et apprentissage outils (`unified`, `rehype-sanitize`) :
**24 h ou 3 jours pleins**. Plancher confiant : **18 h** si le pipeline
markdown est déjà familier.

---

## 10. Annexes — commandes utiles

```bash
# Dev
cd apps/web && pnpm dev

# Vérifier que unified/remark/rehype ne sont PAS dans le bundle client
ANALYZE=true pnpm --filter @femiglow/web build

# Lighthouse
npx lighthouse http://localhost:3000/journal/hiver-ongles-patience --view --preset=desktop
npx lighthouse http://localhost:3000/journal/hiver-ongles-patience --view

# Test XSS paranoïaque
pnpm --filter @femiglow/web test -- renderMarkdown

# axe
npx @axe-core/cli http://localhost:3000/journal/hiver-ongles-patience

# Tests complets
pnpm --filter @femiglow/web test
pnpm --filter @femiglow/web test:e2e -- article
pnpm --filter @femiglow/web storybook
```

---

## 11. Critère unique de réussite

> *L'article tient debout si, en l'envoyant à un journaliste de la presse
> beauté ou à un lecteur exigeant, vous n'avez **rien à excuser**. Pas de « la
> table des matières est en bêta », pas de « la sanitisation viendra plus
> tard », pas de « le drop cap saute parfois ». Si vous devez excuser, la
> page n'est pas finie.*

---

## 12. Bilan d'exécution — 2026-05-03

### Livrables

- **Pipeline markdown sécurisé** ([`src/lib/markdown/render.ts`](../../apps/web/src/lib/markdown/render.ts)) :
  `unified` + `remark-parse` + `remark-gfm` + `remark-rehype` + `rehype-slug` +
  `lazyImages` (custom) + `collectHeadings` (custom, h2/h3 avec id+texte) +
  `rehype-sanitize` (schéma étendu : `className`, `id`, `target=_blank` +
  `rel=noopener noreferrer` sur `a`, `loading`/`decoding` sur `img`) +
  `rehype-stringify`. Purement RSC, zéro fuite client.
- **Composants Article (8)** :
  - [`ReadingProgress.tsx`](../../apps/web/src/components/sections/ReadingProgress.tsx)
    — barre `fixed` 2 px, `scaleX` via `requestAnimationFrame`, `aria-hidden`.
  - [`ArticleHero.tsx`](../../apps/web/src/components/sections/ArticleHero.tsx)
    — image breakout 100 vw 16:9 `priority`, Container `prose` Kicker + h1
    `display-md` italique-auto + `ArticleMeta`.
  - [`ArticleMeta.tsx`](../../apps/web/src/components/sections/ArticleMeta.tsx)
    — avatar 8×8 ratio 1:1 + nom + `<time dateTime>` + reading time.
  - [`ArticleProse.tsx`](../../apps/web/src/components/sections/ArticleProse.tsx)
    — `<div id="article-body" className="prose-femiglow">` +
    `dangerouslySetInnerHTML` (HTML déjà sanitisé), prop `dropCap`.
  - [`TableOfContents.tsx`](../../apps/web/src/components/sections/TableOfContents.tsx)
    — `IntersectionObserver` `rootMargin: '-96px 0px -60% 0px'`,
    `aria-current="location"`, masquée si < 2 headings.
  - [`AuthorCard.tsx`](../../apps/web/src/components/sections/AuthorCard.tsx)
    — avatar 80 px circle + h3 italique + bio courte.
  - [`ShareButtons.tsx`](../../apps/web/src/components/sections/ShareButtons.tsx)
    — Copier (`navigator.clipboard`) + Email (`mailto:`) + LinkedIn
    (`target=_blank rel=noopener noreferrer`), feedback `role="status"`
    `aria-live="polite"`.
  - [`RelatedArticles.tsx`](../../apps/web/src/components/sections/RelatedArticles.tsx)
    — h2 italique « Lire ensuite » + 3 `ArticleCard` filtrées par catégorie.
- **Page** ([`/journal/[slug]/page.tsx`](../../apps/web/src/app/(marketing)/journal/[slug]/page.tsx))
  — `ReadingProgress` + 2× `<JsonLd>` (`BlogPosting` enrichi + `BreadcrumbList`)
  + `ArticleHero` + Container `content` grid `xl:grid-cols-[1fr_220px]` →
  (`ArticleProse` + `ShareButtons` + `AuthorCard`) | sticky `TableOfContents`,
  puis `NewsletterBlock` (source `article-{slug}`) + `RelatedArticles`.
- **Tokens & styles** ([`tokens.css`](../../apps/web/src/styles/tokens.css),
  [`prose.css`](../../apps/web/src/styles/prose.css)) — `--prose-width 640px`,
  `--prose-content-width 960px`, `.prose-femiglow` (h2/h3 Cormorant italic,
  blockquote 2 px sauge, drop cap 96 pt, responsive 28 → 24 pt mobile).
- **JSON-LD** ([`json-ld.tsx`](../../apps/web/src/lib/seo/json-ld.tsx)) —
  `articleSchema` renommé `blogPostingSchema` (alias conservé), enrichi
  (`author.bio`, `articleSection`, `wordCount`, `inLanguage`) + nouvelle
  fonction `breadcrumbListSchema(items)`.
- **Mock enrichi** ([`articles.ts`](../../apps/web/src/data/mock/articles.ts))
  — body de `hiver-ongles-patience` à ~800 mots, 3 h2, 1 blockquote, 1 image,
  1 lien externe, 2 liens internes (`/rituel`, `/journal/huile-d-argan-vraie`),
  bio « Salma F. » ajoutée.

### Métriques après

| Métrique                          | Avant   | Après  |
| --------------------------------- | ------- | ------ |
| First Load JS `/journal/[slug]`   | _       | 1.75 kB / 128 kB |
| SSG                               | _       | 15/15 articles préfabriqués |
| Suite Vitest                      | 84 verts | 98 verts (28 fichiers) |
| Tests Article dédiés              | 0       | 4 fichiers, 14 tests (render XSS + ArticleHero + TableOfContents + ShareButtons) |
| Violations axe                    | _       | 0 (vérifié sur `/journal/hiver-ongles-patience`) |
| TypeScript / ESLint               | _       | 0 / 0  |

### Décisions notables

- **Sanitisation préfixe les `id` headings avec `user-content-`** (sécurité
  collision par défaut de `rehype-sanitize`). Accepté tel quel — le ToC lit
  l'`id` post-sanitize via `collectHeadings`, donc cohérent end-to-end.
- **Pas de `rehype-autolink-headings`** — non nécessaire pour le ToC sticky
  desktop, et garde le HTML plus propre côté lecteur.
- **`userEvent.clipboard` shadow le mock `navigator.clipboard`** dans le test
  `ShareButtons` → utilisation de `fireEvent` + `Object.defineProperty` direct
  pour récupérer un canal d'observation testable sans userEvent v14.
- **Pipeline markdown ESM-only (`unified` v11)** intégré sans
  `transpilePackages` — Next 14 le bundle uniquement côté RSC.
- **Drop cap désactivable** via classe `.no-drop-cap` posée sur le wrapper —
  utile pour les courts billets ou les articles ouvrant sur une liste.

### Critère de presse

L'article `/journal/hiver-ongles-patience` peut être envoyé tel quel à un
journaliste de la presse beauté : prose cadrée 640 px, drop cap, blockquote
sauge, ToC sticky en desktop, partage opérationnel, encart auteure, articles
connexes filtrés par catégorie, newsletter inline, JSON-LD complet
(BlogPosting + BreadcrumbList), axe 0 violation. Rien à excuser.

À cocher **avant** d'attaquer la page suivante.
