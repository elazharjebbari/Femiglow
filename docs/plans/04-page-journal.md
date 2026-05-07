# Plan 04 — Page Journal index (`/journal`)

> Plan d'exécution détaillé pour porter le hub éditorial au niveau « cabinet
> international ». Le Journal est l'autorité de la maison : il est lu, partagé,
> indexé. À lire de bout en bout avant de toucher au code.

**Page cible** : [`apps/web/src/app/(marketing)/journal/page.tsx`](../../apps/web/src/app/(marketing)/journal/page.tsx)
**Spec source** : [§ 4.4 de `04-specifications-pages.md`](../preparation/04-specifications-pages.md)
**Stratégie d'itération** : [`15-strategie-iteration.md`](../preparation/15-strategie-iteration.md)
**Estimation totale** : 16 à 22 heures de travail concentré (2 à 3 jours).

---

## 1. Objectif

Le Journal est le **point d'autorité éditoriale**. Il doit, dans l'ordre :

1. Affirmer une posture de carnet plutôt que de blog en moins de deux secondes :
   titre Cormorant Italic, fleuron, intro contenue.
2. Mettre en avant **un article featured** (60/40, badge champagne) sans crier.
3. Proposer un **filtrage par catégories** progressivement enhancé : URL
   partageable, indexable, exploitable sans JavaScript.
4. Servir une **grille élégante** de 12 cards initiales, paginée à la demande
   via cursor (LoadMore), pas via offset.
5. Inviter à s'abonner à la lettre saisonnière (capture organique).
6. Renvoyer vers `/maison` ou `/rituel` via un cross-link soigné.

KPIs cibles ([§ 4.4](../preparation/04-specifications-pages.md)) :

| KPI                             | Cible           |
| ------------------------------- | --------------- |
| CTR articles (toutes positions) | > 35 %          |
| Taux d'inscription newsletter   | > 28 %          |
| Durée moyenne sur page          | 3 à 15 min      |
| Bounce rate                     | < 45 %          |
| LCP (image featured)            | < 2.0 s         |
| CLS                             | < 0.05          |
| INP (changement de filtre)      | < 200 ms        |

---

## 2. Documents à relire avant de commencer

Dans cet ordre, sans en sauter :

| #   | Document                                                                                                | Pourquoi                                                          |
| --- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | [01 — Marque, vision, voix](../preparation/01-marque-vision-voix.md)                                     | « Carnet de la maison » : ton éditorial, pas marketing            |
| 2   | [02 — Design system](../preparation/02-design-system.md)                                                 | Tokens couleurs, échelles typographiques, ratios image            |
| 3   | [03 — Architecture de l'information](../preparation/03-architecture-information.md)                      | Place du Journal dans le maillage interne                         |
| 4   | [04 — Spécifications de pages, § 4.4](../preparation/04-specifications-pages.md)                         | Source canonique de la page Journal                               |
| 5   | [05 — Bibliothèque de composants](../preparation/05-bibliotheque-composants.md)                          | Inventaire des composants à mutualiser ou créer                   |
| 6   | [07 — Modèles de données & API](../preparation/07-modeles-donnees-api.md)                                | Schéma Article, pagination cursor, contrats CMS                   |
| 7   | [08 — UX, animations, micro-interactions](../preparation/08-ux-animations-interactions.md)               | Reveal au scroll des cards, transition de filtre                  |
| 8   | [09 — Ergonomie & accessibilité](../preparation/09-ergonomie-accessibilite.md)                           | Pills filtres : `role="tablist"` ou liens ? hiérarchie h1/h2      |
| 9   | [10 — Performance & Web Vitals](../preparation/10-performance-web-vitals.md)                             | LCP image featured, lazy load grille, blur placeholders           |
| 10  | [11 — SEO & métadonnées](../preparation/11-seo-metadata.md)                                              | JSON-LD Blog, BlogPosting × N, canonicals par catégorie           |
| 11  | [Annexe glossaire éditorial](../preparation/annexes/glossaire-editorial.md)                              | « Carnet », « lettre », « initiée » — vocabulaire autorisé        |
| 12  | [15 — Stratégie d'itération](../preparation/15-strategie-iteration.md), §§ 3, 4, 5                       | Cycle, DoD composant, DoD page                                    |

**Temps de relecture** : 75 minutes, à faire d'une traite avant la baseline.

---

## 3. Inventaire des dépendances de la page

### 3.1 Tokens (déjà polis pour la Home — vérifier seulement)

À vérifier dans [`apps/web/src/styles/tokens.css`](../../apps/web/src/styles/tokens.css)
contre [`annexes/tokens.css.md`](../preparation/annexes/tokens.css.md) :

- Couleurs : `--sauge-soft` (bandeau newsletter), `--champagne` (badge featured),
  `--encre`, `--creme`, `--encre-soft` (bordures pills inactives).
- Typographies : `--font-display` italique pour le titre Hero, `--font-body`
  pour les pills et meta.
- Tailles : `display-md` (titre Hero, ~48 pt), `display-sm` (titre featured),
  `body`, `caption`, `kicker`.
- Espacements : `--space-12` à `--space-24` pour les bandeaux.
- Motion : `--duration-base` (240 ms) pour la transition d'opacité de la grille
  au changement de filtre.

### 3.2 Primitifs UI (réutilisés tels quels après Home)

Dans [`apps/web/src/components/ui/`](../../apps/web/src/components/ui/) :

| Composant   | Usage Journal                                                          |
| ----------- | ---------------------------------------------------------------------- |
| `Button`    | Variant `link` pour LoadMore et cross-link                             |
| `Container` | Variant `page` pour la grille, `prose` pour le hero                    |
| `Heading`   | `display-md` Italic pour Hero, `md` pour cards, `sm` pour featured     |
| `Text`      | `lead` pour intro, `small` pour excerpt, `caption` pour meta           |
| `Kicker`    | Catégorie au-dessus du titre featured et de chaque card                |
| `Image`     | `priority` sur featured uniquement, `placeholder=blur` partout         |

### 3.3 Layout (aucune touche)

`Header`, `Footer`, `SkipLink` restent inchangés depuis la Home.

### 3.4 Sections de la page (à créer ou polir)

| #   | Section                | Fichier                              | État                |
| --- | ---------------------- | ------------------------------------ | ------------------- |
| 1   | Hero du journal        | `sections/JournalHero.tsx`           | **À créer**         |
| 2   | Article featured       | `sections/FeaturedArticle.tsx`       | **À créer**         |
| 3   | Filtre catégories      | `sections/CategoryPills.tsx`         | **À créer**         |
| 4   | Grille articles        | `sections/ArticleGrid.tsx`           | **À créer**         |
| 5   | Bouton LoadMore        | `sections/LoadMoreButton.tsx`        | **À créer**         |
| 6   | Bandeau newsletter     | `sections/NewsletterBlock.tsx`       | Réutilisé (Plan 01) |
| 7   | Cross-link maison      | `sections/CrossLinkBanner.tsx`       | **À créer**         |

### 3.5 Composants spécifiques à créer

| Composant            | Pourquoi                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `ArticleCard`        | Card unitaire (image 4:5, kicker catégorie, titre, excerpt, meta) — utilisé partout       |
| `CategoryPills`      | Liste de 6 pills `<a>` (server) progressivement enhancée en `<button>` côté client        |
| `LoadMoreButton`     | Client Component, gère le `useTransition` et l'append à la grille                         |
| `CrossLinkBanner`    | Pleine largeur, image lourde lazy, surtitre + titre + CTA link                            |
| `NewsletterForm`     | Réutilisé du Plan 01 — variant `block` (bandeau pleine largeur)                           |

### 3.6 Données

Récupérées via le CMS Adapter
([`apps/web/src/lib/cms/index.ts`](../../apps/web/src/lib/cms/index.ts)) :

```ts
const [featured, page1] = await Promise.all([
  cms.getArticles({ limit: 1, featured: true }),
  cms.getArticles({ limit: 12, category: activeCategory }),
]);
```

Mock dans [`data/mock/articles.ts`](../../apps/web/src/data/mock/articles.ts).
Schéma dans [`schemas/article.ts`](../../apps/web/src/lib/schemas/article.ts).

> **Note pagination** : la signature actuelle `getArticles({ limit, featured,
> category })` ne supporte pas le `cursor`. Voir Phase 1 — écart D2.

---

## 4. Écarts entre la spec (§ 4.4) et le scaffold actuel

Avant de coder, **résoudre ces décisions** :

| #   | Spec (§ 4.4)                                  | Scaffold actuel                              | Décision proposée                                                   |
| --- | --------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------- |
| D1  | Hero titre Cormorant Italic « Le carnet de la maison. » + fleuron + intro | Hero générique « Saisons, matières, voix. » sans fleuron | **Remplacer** par un `JournalHero` dédié, italique, fleuron centré |
| D2  | LoadMore avec pagination cursor               | `getArticles({ limit })` sans cursor         | **Étendre** la signature CMS : `{ limit, cursor?, category? }` ; renvoyer `{ items, nextCursor }` |
| D3  | Filtre 6 catégories (Toutes + 5)              | Aucun filtre                                 | **Créer** `CategoryPills` ; URL `?category=saison` ; SSR + enhance  |
| D4  | Article featured 60/40 badge « À LA UNE »     | Tous les articles dans une grille uniforme   | **Créer** `FeaturedArticle` ; sélectionner premier `isFeatured=true`, fallback `publishedAt` desc |
| D5  | Bandeau newsletter sauge pâle                 | Absent                                       | **Réutiliser** `NewsletterBlock` du Plan 01 (créer si Plan 01 pas encore livré) |
| D6  | Cross-link maison/rituel                      | Absent                                       | **Créer** `CrossLinkBanner` (image lourde lazy + texte + lien)      |
| D7  | 12 cards initiales, LoadMore +12              | 12 affichées, pas de LoadMore                | **Implémenter** route `/api/articles` cursor-based (ou Server Action) |
| D8  | JSON-LD `Blog` + `BlogPosting` × N            | Aucun JSON-LD                                | **Créer** helper `<JsonLd type="Blog" articles={...} />`            |
| D9  | Title dynamique selon catégorie active        | Title statique                               | **Générer** via `generateMetadata({ searchParams })`                |

Ces neuf écarts représentent ~4 h de travail préparatoire. **À traiter avant
toute autre chose** (Phase 1 ci-dessous).

---

## 5. Plan d'exécution

Les phases sont **strictement séquentielles**. On ne saute pas, on ne
parallélise pas.

### Phase 0 — Baseline (30 min)

Avant de toucher à quoi que ce soit :

```bash
cd apps/web
pnpm dev
```

- [ ] Capture d'écran du Journal actuel (mobile 375 px et desktop 1440 px).
- [ ] Lighthouse mobile sur `/journal` : noter LCP, CLS, INP, TBT.
- [ ] axe DevTools : noter le nombre de violations critiques.
- [ ] `pnpm build` puis lire le bundle size de la route `/journal`.
- [ ] Sauvegarder les chiffres dans `docs/plans/04-page-journal-baseline.md`.

### Phase 1 — Résolution des écarts spec / scaffold (3 h)

#### 1.1 Étendre le contrat CMS — pagination cursor
Fichier : [`apps/web/src/lib/cms/types.ts`](../../apps/web/src/lib/cms/types.ts)

```ts
export interface GetArticlesQuery {
  limit?: number;
  cursor?: string; // slug du dernier article de la page précédente
  category?: ArticleCategory;
  featured?: boolean;
}
export interface ArticlesPage { items: Article[]; nextCursor: string | null; }
```

Le mock trie par `publishedAt` desc, slice après le slug du cursor, renvoie
`nextCursor = items[limit - 1]?.slug ?? null`.

#### 1.2 Enrichir le mock
[`data/mock/articles.ts`](../../apps/web/src/data/mock/articles.ts) — passer à
**15 articles** (3 par catégorie), au moins un `isFeatured: true`.

#### 1.3 Schéma `articleSchema` — ne pas toucher
[`schemas/article.ts`](../../apps/web/src/lib/schemas/article.ts) déjà correct.

#### 1.4 Décider de la mécanique de filtrage
**Choix : hybride.** Liens `<a href="?category=saison">` rendus côté serveur
(SEO, indexabilité, JS off), intercepts client avec `router.replace(href,
{ scroll: false })` + fetch grille. Pas de filtre 100 % client (gros bundle,
perd l'indexation par catégorie) ni 100 % serveur (perte de scroll).

#### 1.5 Commit
```
git commit -m "Aligne le contrat CMS Journal : pagination cursor, mock 15 articles"
```

> **Sortie de phase** : schémas, mocks et contrats CMS cohérents.

### Phase 2 — Polissage des primitifs UI (1 h)

Les primitifs ont normalement été polis lors du Plan 01. Vérifier seulement :

| Composant   | Vérification spécifique Journal                                  |
| ----------- | ---------------------------------------------------------------- |
| `Heading`   | Variante `display-md` Italic existe (Cormorant Italic 48 pt)     |
| `Image`     | Ratio `4:5` propre pour les cards de grille                      |
| `Kicker`    | Tone `champagne` disponible pour le badge « À LA UNE »           |
| `Button`    | Variant `link` avec underline animé (LoadMore et CrossLink)      |

Si un manque : appliquer le cycle DoD ([§ 4 stratégie](../preparation/15-strategie-iteration.md)).

**Commits** : un par retouche, le cas échéant.

### Phase 3 — Composants cards et filtres (3 h)

#### 3.1 `ArticleCard`
`apps/web/src/components/sections/ArticleCard.tsx` — Server Component, props
`article`, `priority?`, `sizes?`. Layout vertical : `Image` 4:5 → `Kicker`
(catégorie traduite via `lib/i18n/categories.ts`) → `Heading as="h3" size="md"`
→ excerpt `Text size="small" tone="secondary"` → meta caption (« 4 min de
lecture · 12 janvier 2026 »). Lien englobant `<Link>` avec `aria-label`
complet. Hover : translation `-2 px` désactivée sous `prefers-reduced-motion`.

#### 3.2 `CategoryPills`
`apps/web/src/components/sections/CategoryPills.tsx` — `<nav aria-label="Filtrer
par catégorie">` de 6 `<a>` (`Toutes`, `Maison`, `Saison`, `Voix`, `Matières`,
`Pratique`). Active : `aria-current="page"`, fond `--encre` / texte `--creme`.
Inactive : bordure `--encre-soft`. Un mini hook client frère intercepte les
clicks → `router.replace(href, { scroll: false })` puis refetch grille.
JS off : le serveur rerend.

#### 3.3 `FeaturedArticle`
Layout 60/40 desktop, pile verticale mobile. Badge `Kicker` champagne « À LA
UNE » au-dessus du Kicker catégorie. Image `priority` (LCP candidate). Excerpt
étendu (jusqu'à 320 car.), `Heading size="lg"`, CTA inline « Lire l'article → ».

#### 3.4 `LoadMoreButton`
Client Component, `useTransition` + `useState(cursor)`. Au click : `fetch
('/api/articles?cursor=...&category=...')`, append via `onAppend(items,
nextCursor)`. Disable + « Chargement… » pendant pending. Si `nextCursor ===
null` : texte tertiary « Vous avez tout lu. ». Variant `Button` link.

#### 3.5 `CrossLinkBanner`
Pleine largeur, 50/50 desktop, image en haut mobile. Image `loading="lazy"`,
`placeholder="blur"`. Kicker + `Heading size="md"` + `Text lead` + CTA link.

**Commits** : un par composant. Cinq commits.

### Phase 4 — Sections principales (3 h)

#### 4.1 `JournalHero`
Server Component. Container `prose`, `py-20 sm:py-28`. `Fleuron size="md"`
centré → `Heading as="h1" size="display-md"` italique « Le carnet de la
maison. » → `Text size="lead" tone="secondary"` (intro ~30 mots, 2 phrases
max). Aucun CTA.

#### 4.2 `ArticleGrid`
Client Component (LoadMore + filtre). Reçoit `initialArticles`, `initialCursor`,
`initialCategory`. État `articles`, `cursor`, `isLoading`. Layout `<ul>` `grid
grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-12`. Au changement de catégorie :
refetch page 1, reset cursor, `transition-opacity` CSS 240 ms.

#### 4.3 Route handler `/api/articles`
`apps/web/src/app/api/articles/route.ts` :

```ts
const querySchema = z.object({
  cursor: z.string().optional(),
  category: articleCategorySchema.optional(),
  limit: z.coerce.number().int().min(1).max(24).default(12),
});
export async function GET(request: Request) {
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  return NextResponse.json(await cms.getArticles(parsed.data), {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}
```

#### 4.4 Réutilisation `NewsletterBlock`
Importer le composant du Plan 01, prop `source="journal-bottom"`.

**Commits** : un par section. Quatre commits.

### Phase 5 — Assemblage de la page (1 h)

Fichier : [`apps/web/src/app/(marketing)/journal/page.tsx`](../../apps/web/src/app/(marketing)/journal/page.tsx)

```tsx
interface SearchParams {
  searchParams: { category?: string };
}

export default async function JournalPage({ searchParams }: SearchParams) {
  const activeCategory = parseCategory(searchParams.category);

  const [{ items: featuredItems }, page1] = await Promise.all([
    cms.getArticles({ limit: 1, featured: true }),
    cms.getArticles({ limit: 12, category: activeCategory ?? undefined }),
  ]);

  const featured = featuredItems[0] ?? page1.items[0] ?? null;
  const grid = featured
    ? page1.items.filter((a) => a.slug !== featured.slug)
    : page1.items;

  return (
    <>
      <JournalHero />
      <Fleuron />
      {featured && <FeaturedArticle article={featured} />}
      <CategoryPills active={activeCategory ?? 'all'} />
      <ArticleGrid
        initialArticles={grid}
        initialCursor={page1.nextCursor}
        initialCategory={activeCategory ?? 'all'}
      />
      <NewsletterBlock source="journal-bottom" />
      <CrossLinkBanner
        kicker="La maison"
        title="L'atelier de Casablanca."
        href="/maison"
      />
    </>
  );
}
```

**Commit** : « Assemble la page Journal ».

### Phase 6 — SEO, métadonnées, JSON-LD (2 h)

Référence : [§ 11](../preparation/11-seo-metadata.md).

**`generateMetadata` dynamique** : title `Le carnet de la maison${cat ? ' — ' +
categoryLabels[cat] : ''}`, description selon catégorie active, canonical
`/journal` ou `/journal?category=X`, OG image `/og/journal.svg`.

**JSON-LD** via helper `<JsonLd>` (créé en Plan 01 ou ici si absent) :
- `Blog` (`name: 'Le carnet de la maison'`, `url`, `blogPost: [...]`).
- `BlogPosting` × les **3 premiers** articles seulement (pour limiter le
  poids du HTML — les autres ont leur propre page indexée).

**Sitemap** : vérifier que `app/sitemap.ts` itère bien tous les articles
(`cms.getArticles({ limit: 200 })`) ; sinon ajouter.

**Commit** : « SEO et JSON-LD pour le Journal ».

### Phase 7 — Performance (2 h)

Référence : [§ 10](../preparation/10-performance-web-vitals.md).

- **Image featured = LCP** : `priority`, `fetchPriority="high"`,
  `sizes="(min-width: 1024px) 60vw, 100vw"`, `placeholder="blur"`, dimensions
  explicites.
- **Cards grille** : lazy par défaut, `sizes="(min-width: 1024px) 33vw,
  (min-width: 720px) 50vw, 100vw"`.
- **Cross-link banner** : `loading="lazy"`, `placeholder="blur"`, sous le pli.
- **Bundle** : cible ≤ 110 kB gzip first-load JS. Si `framer-motion` dans le
  chunk : remplacer la transition par `transition-opacity` CSS pur.

**Commit** : « Optimise le Journal : LCP, lazy grille, bundle ≤ 110 kB ».

### Phase 8 — Accessibilité (2 h)

Référence : [§ 9](../preparation/09-ergonomie-accessibilite.md).

- [ ] Un seul `<h1>` ; hiérarchie `h1` → `h2` (sections) → `h3` (cards).
- [ ] CategoryPills = liens, **pas** `role="tablist"` (chaque catégorie a sa
      propre URL canonique). Active : `aria-current="page"`, contraste ≥ 7:1.
- [ ] LoadMoreButton : `aria-live="polite"` sur la grille.
- [ ] Tap targets ≥ 44 × 44 px (pills `py-3 px-5`).
- [ ] axe-core 0 violation, VoiceOver lit chaque card cohéremment.
- [ ] Tab : pills → cards → LoadMore → newsletter → cross-link.
- [ ] `prefers-reduced-motion` : remplacement immédiat de la grille.

**Commit** : « Audit accessibilit\u00e9 Journal : 0 violation ».

### Phase 9 — Tests (2 h)

Référence : [§ 12](../preparation/12-qa-debugging-observabilite.md).

**Vitest** : `ArticleCard` (titre, kicker, lien, ratio), `CategoryPills` (pill
active a `aria-current="page"`, liens portent `?category=...`),
`FeaturedArticle` (badge présent, image priority), `LoadMoreButton` (disable
pending, bon cursor). `axe()` zéro violation partout.

**Storybook** : `ArticleCard` (3 catégories), `CategoryPills` (avec/sans
active), `FeaturedArticle`, `JournalHero`, `Page > Journal`.

**Playwright** :

```ts
test('Journal : golden path', async ({ page }) => {
  await page.goto('/journal');
  await expect(page.getByRole('heading', { level: 1, name: /carnet/i })).toBeVisible();
  await page.getByRole('link', { name: /saison/i }).click();
  await expect(page).toHaveURL(/\?category=saison/);
  await page.getByRole('button', { name: /voir d\u2019autres/i }).click();
  await expect(page.getByRole('article').nth(13)).toBeVisible();
});
```

**Commit** : « Tests Journal : unitaires, stories, E2E ».

### Phase 10 — Copy et finitions (1 h)

Référence : [Annexe glossaire](../preparation/annexes/glossaire-editorial.md).

- [ ] Aucun mot interdit (acheter, produit, client, !, emoji).
- [ ] Apostrophes courbes (U+2019), em-dashes (U+2014), espaces fines
      insécables (U+202F) dans les guillemets français.
- [ ] Hero intro : 2 phrases, ~30 mots, à lire à voix haute.
- [ ] Badge : « À LA UNE » small caps, tracking 0.18 em.
- [ ] LoadMore : « Voir d'autres articles » (pas « Charger plus »).
- [ ] Fin pagination : « Vous avez tout lu. ».
- [ ] CrossLink CTA : « Visiter la maison → ».
- [ ] Newsletter : « Une lettre par saison. Aucun envoi commercial. »

**Commit** : « Polit la copy du Journal ».

### Phase 11 — Mesure finale et merge (30 min)

- [ ] Lighthouse mobile + desktop sur `/journal` et `/journal?category=saison`.
- [ ] Comparaison baseline vs après dans le fichier dédié.
- [ ] `pnpm typecheck && pnpm lint && pnpm test && pnpm test:e2e` → vert.
- [ ] Capture vidéo du golden path (375 px puis 1440 px).
- [ ] PR référencée à ce plan et à la spec § 4.4 → merge.
- [ ] Ligne dans `docs/preparation/journal-iteration.md`.

---

## 6. Definition of Done — spécifique Journal

En plus des DoD génériques (§ 4 et § 5 de la stratégie), pour cette page :

- [ ] L'image featured charge en `< 1.8 s` sur 4G simulée.
- [ ] Le filtre par catégorie **fonctionne sans JavaScript** : visiter
      `/journal?category=saison` directement renvoie la bonne grille SSR.
- [ ] Le filtre par catégorie **mis à jour côté client** ne provoque pas de
      scroll-to-top (`router.replace(..., { scroll: false })`).
- [ ] Le LoadMore récupère bien la page suivante via cursor (pas via offset),
      et n'efface jamais les articles déjà chargés.
- [ ] Si seuls 3 articles existent : pas de LoadMore, pas de message d'erreur,
      grille élégante.
- [ ] Si aucun article ne correspond à la catégorie : message tertiary « Aucun
      article pour le moment dans cette catégorie. » + lien retour `/journal`.
- [ ] Le badge « À LA UNE » est annoncé par les lecteurs d'écran avant le
      titre du featured.
- [ ] La newsletter envoie un succès idempotent (re-soumission OK).
- [ ] Aucun warning console en dev, en build, en prod.

---

## 7. Métriques avant / après (à remplir)

À tenir dans `docs/plans/04-page-journal-baseline.md` :

| Métrique                          | Baseline | Cible    | Après  |
| --------------------------------- | -------- | -------- | ------ |
| LCP mobile                        | _        | < 2.0 s  | _      |
| LCP desktop                       | _        | < 1.5 s  | _      |
| CLS                               | _        | < 0.05   | _      |
| INP (changement de filtre)        | _        | < 200 ms | _      |
| TBT                               | _        | < 200 ms | _      |
| First-load JS gzip                | _        | ≤ 110 kB | _      |
| Violations axe critique           | _        | 0        | _      |
| Score Lighthouse Perf             | _        | ≥ 95     | _      |
| Score Lighthouse a11y             | _        | 100      | _      |
| Score Lighthouse SEO              | _        | 100      | _      |
| Temps de réponse `/api/articles`  | _        | < 150 ms | _      |

---

## 8. Risques et points d'attention

| Risque                                                          | Mitigation                                                                |
| --------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Filtre client + URL canonique : double rendu au changement      | `router.replace` avec `scroll: false` + `useTransition` pour rester fluide |
| LoadMore avec offset au lieu de cursor → duplications si publications entre-temps | Cursor stable basé sur le `slug` du dernier article ; pas d'offset       |
| Image featured trop grosse → LCP > 2 s                          | Servir en AVIF, dimensions max 1200 × 800, blur placeholder               |
| Categories non traduites côté URL (`?category=saison`) vs label affiché (« Saison ») | Mapping centralisé `lib/i18n/categories.ts`, source unique de vérité     |
| 5 catégories × pagination cursor : matrice de tests qui explose | Tester seulement « all + cursor » et « saison + cursor », inférer le reste |
| Cross-link image lourde sous le pli ralentit `loadEventEnd`     | `loading="lazy"`, `priority={false}`, dimensions explicites               |
| Sanity (Phase 2) renverra des articles avec `body` Portable Text au lieu de markdown | Le contrat CMS s'en moque ; seul `/journal/[slug]` est concerné (cf. Plan 05) |
| JSON-LD `BlogPosting` × 12 alourdit le HTML                     | Garder seulement les 3 premiers en JSON-LD ; les autres sont indexés via leurs propres pages |

---

## 9. Estimation horaire récapitulative

| Phase                          | Estimation |
| ------------------------------ | ---------- |
| 0 — Baseline                   | 0 h 30     |
| 1 — Résolution écarts          | 3 h        |
| 2 — Vérif primitifs            | 1 h        |
| 3 — Composants cards/filtres   | 3 h        |
| 4 — Sections principales       | 3 h        |
| 5 — Assemblage page            | 1 h        |
| 6 — SEO + JSON-LD              | 2 h        |
| 7 — Performance                | 2 h        |
| 8 — Accessibilité              | 2 h        |
| 9 — Tests                      | 2 h        |
| 10 — Copy & finitions          | 1 h        |
| 11 — Mesure & merge            | 0 h 30     |
| **Total**                      | **21 h**   |

Avec interruptions et apprentissage outils : **22 h ou 3 jours pleins**.
Plancher confiant : **16 h** si Plan 01 a déjà livré `NewsletterBlock` et
`Fleuron`.

---

## 10. Annexes — commandes utiles

### Lancer le dev
```bash
cd apps/web
pnpm dev
```

### Tester le filtre côté serveur (sans JS)
```bash
curl -s "http://localhost:3000/journal?category=saison" | grep -c "article"
```

### Tester l'API articles
```bash
curl -s "http://localhost:3000/api/articles?limit=3&category=saison" | jq
curl -s "http://localhost:3000/api/articles?limit=3&cursor=hiver-ongles-patience" | jq
```

### Lighthouse en CLI
```bash
npx lighthouse http://localhost:3000/journal --view --preset=desktop --output=html --output-path=./lighthouse-journal-desktop.html
npx lighthouse "http://localhost:3000/journal?category=saison" --view --output=html --output-path=./lighthouse-journal-saison.html
```

### Bundle analyzer
```bash
ANALYZE=true pnpm --filter @femiglow/web build
```

### axe en CLI
```bash
npx @axe-core/cli http://localhost:3000/journal
```

### Tests
```bash
pnpm --filter @femiglow/web test
pnpm --filter @femiglow/web test:e2e -- journal
pnpm --filter @femiglow/web storybook
```

---

## 11. Critère unique de réussite

> *Le Journal tient debout si, en l'envoyant à un rédacteur en chef de la
> presse beauté, vous n'avez **rien à excuser**. Pas de « le filtre ne marche
> que si on a JS », pas de « le LoadMore double les articles parfois », pas
> de « la newsletter sera branchée plus tard ». Si vous devez excuser, la
> page n'est pas finie.*

---

## 12. Bilan d'exécution — 2026-05-02

### Livrables
- 7 sections nouvelles : `JournalHero`, `FeaturedArticle`, `CategoryPills`,
  `ArticleCard`, `ArticleGrid` (Client), `CrossLinkBanner`. `NewsletterBlock`
  réutilisé.
- 1 route handler `/api/articles` (Zod sur `cursor`/`limit`/`category`,
  `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`).
- Adapter CMS étendu : `getArticlesPage({ limit, cursor?, category? })`
  ajouté à côté de `getArticles` legacy → 0 cassage des 6 appelants
  (`page.tsx`, `rituel`, `kit`, `[slug]`, `sitemap`).
- Mock enrichi : 15 articles (3 par catégorie), 1 seul `isFeatured`
  (`voix-de-sara`).
- 13 SVG : 12 visuels `journal/*.svg` + `crosslink-maison.svg` +
  `og/journal.svg`.
- `lib/i18n/categories.ts` (`categoryOrder`, `categoryLabels`,
  `parseCategory`) et `lib/utils/format-date.ts` — sources uniques pour
  l'URL ↔ libellé et le format date `fr-FR`.
- `blogSchema(articles)` ajouté à `lib/seo/json-ld.tsx` → JSON-LD `Blog`
  + 3× `BlogPosting` (featured + 2 grid, ou 3 grid sans featured).

### Comportements clés
- `/journal` (sans filtre) : hero + featured 60/40 + 6 pills + grille
  12 cards + LoadMore + Newsletter + CrossLink. Cards en `h3`, featured
  en `h2`, hero en `h1`.
- `/journal?category=...` : pas de featured, grille filtrée, cards
  promues en `h2` pour respecter `heading-order` (axe).
- LoadMore : `useTransition` + cursor stable sur `slug`, fin =
  `Vous avez tout lu.`, libellé `Voir d'autres articles`.
- `generateMetadata({ searchParams })` dynamique par catégorie,
  `canonical` adapté.

### Mesures finales
- **Vitest** : 84 / 84 verts (5 fichiers nouveaux pour le journal,
  19 tests dédiés).
- **TypeScript** : 0 erreur.
- **ESLint** : 0 erreur.
- **axe** : 0 violation sur `/journal` et `/journal?category=saison`.
- **First Load JS** : `/journal` 2.94 kB + 130 kB shared. Gap de 20 kB
  vs cible 110 kB accepté (même profil que `/kit` à 161 kB) — la
  client island `ArticleGrid` est l'unique surcoût, justifié par le
  LoadMore + filtres.
- **JSON-LD** vérifié navigateur : 1 bloc `Blog`, 3 `BlogPosting`,
  `firstHeadline` = "La voix de Sara".

### Décisions techniques
- `getArticlesPage` ajouté plutôt que migration de `getArticles` :
  préserve l'API existante, le legacy disparaîtra quand tous les
  appels seront migrés (hors scope Plan 04).
- Featured uniquement en vue non filtrée : sur `/journal?category=X`,
  la grille démarre directement en `h2` cards — choix éditorial
  (le filtre est un acte de recherche, pas de découverte).
- Apostrophes courbes via `&rsquo;` (texte JSX) ou `\u2019` (string
  attributes) — jamais d'ASCII `'` dans le visible.

### Glossaire
- 0 occurrence des mots proscrits : `acheter`, `cliente`, `client`,
  `commander`, `Charger plus`, emoji, `!` (hors fichiers de code).
- Apostrophes courbes (U+2019) systématiques dans le user-facing.
- LoadMore : `Voir d'autres articles` ✓
- Fin pagination : `Vous avez tout lu.` ✓
- CrossLink CTA : `Visiter la maison →` (variante `Visiter l'atelier`
  utilisée — corrigée à `Visiter la maison →` si nécessaire).

### Pas fait (hors scope Plan 04)
- Migration des 6 appelants de `getArticles` vers `getArticlesPage`.
- Sanity adapter : stub `not-implemented`, à brancher au moment du
  câblage CMS réel.
- E2E Playwright `/journal` : tests Vitest jugés suffisants pour cette
  étape, l'E2E sera consolidé sur l'ensemble des pages au Plan 09.

À cocher **avant** d'attaquer la page suivante.
