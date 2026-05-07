# C5 — journal-article

> Layout d'une page d'article du journal. **Cas particulier** :
> les fiches de catalogue précédentes décrivent des composants
> dont l'instance est unique (un seul `home-hero`). Une page
> d'article est par essence **multi-instance** — il y a 15
> articles aujourd'hui (cf. `SITE_COMPONENT_REGISTRY`, lignes
> 484-516, qui crée déjà une entrée par article pour piloter la
> *cover image*).
>
> Cette fiche **clarifie le périmètre du Components-CMS** sur la
> page d'article et **renvoie** explicitement les champs
> per-article au système d'articles (table `articles`).

## 1. Identité

| Clé | Valeur |
|---|---|
| `componentKey` | `journal-article` |
| Nom affiché | Layout article (squelette éditorial) |
| Page-group | `journal` |
| RSC paths | `apps/web/src/components/sections/ArticleHero.tsx`, `apps/web/src/components/sections/ArticleProse.tsx`, `apps/web/src/components/sections/AuthorCard.tsx`, `apps/web/src/components/sections/RelatedArticlesBound.tsx`, `apps/web/src/components/sections/TableOfContents.tsx` |
| Wrapper RSC (data fetch) | `apps/web/src/app/(marketing)/journal/[slug]/page.tsx` |
| Route(s) consommatrice(s) | `/journal/[slug]` (15 instances aujourd'hui) |
| Statut | `planned` (hybride) |
| Source actuelle des littéraux par-article | `apps/web/src/data/mock/articles.ts` |
| Source actuelle des littéraux structurels | `apps/web/src/components/sections/*.tsx` (libellés ToC, related, share) |
| Dernière revue | 2026-05-05 — initiales |

## 2. Périmètre — qu'est-ce qui appartient au Components-CMS ?

> **Règle** : le Components-CMS gère ce qui est **structurel et
> partagé entre tous les articles**. Ce qui est **propre à un
> article** (titre, body, kicker, hero quote, related explicites)
> reste dans la table `articles` (système éditorial dédié).
>
> Cf. `architecture/01-overview.md` (A1) §non-goals : « le
> Components-CMS n'est pas un CMS d'articles ».

### Reste dans la table `articles` (NON géré ici)

| Donnée | Schéma actuel | Pourquoi pas Components-CMS |
|--------|---------------|------------------------------|
| `kicker` (catégorie de l'article) | `articleSchema.kicker` | Per-instance, varie article par article. |
| `title` | `articleSchema.title` | Per-instance, indexé pour SEO. |
| `excerpt` | `articleSchema.excerpt` | Per-instance, sert aussi de meta description. |
| `body` (markdown) | `articleSchema.body` | Per-instance. Édité dans `/admin/articles/[slug]`. |
| `featuredImage` | `articleSchema.featuredImage` | Per-instance, déjà piloté par Component-Media slot `cover` du composant `journal-article-<slug>` du registre. |
| `author` | `articleSchema.author` | Per-instance (à terme : table `authors`). |
| `publishedAt`, `updatedAt`, `readingTimeMinutes` | timestamps | Per-instance. |
| `seo.{title,description,ogTitle,…}` | `articleSchema.seo` | Per-instance. |

> Ces champs sont éditables dans le futur écran
> `/admin/articles/[slug]` ; le présent système n'en touche
> aucun.

### Géré par le Components-CMS (oui)

Tout ce qui est **libellé partagé** ou **paramètre de layout**
de la page article : libellés du ToC, du bloc related, des
boutons share, libellé fallback de l'auteur si absent, etc.
Ces valeurs sont uniques pour les 15 articles.

## 3. Champs éditoriaux

| key | label | type | required | defaultValue | description | group | config |
|-----|-------|------|----------|--------------|-------------|-------|--------|
| `tocHeading` | « Titre du sommaire » | `text` | non | `"Sur cette page"` | Libellé au-dessus du ToC en sidebar (xl+). Aujourd'hui codé en dur dans `TableOfContents.tsx` — **TBD** : à confirmer côté code (le composant n'a pas été lu en détail dans cet audit). | `Sidebar` | `{ maxLength: 30 }` |
| `relatedHeading` | « Titre related » | `text` | non | `"À lire ensuite"` | H2 au-dessus du bloc related. **TBD** : valeur exacte à reprendre de `RelatedArticles.tsx` — défaut proposé ici. | `Related` | `{ maxLength: 40 }` |
| `relatedLimit` | « Nombre d'articles related » | `number` | non | `3` | Code en dur `slice(0, 3)` dans `apps/web/src/app/(marketing)/journal/[slug]/page.tsx:85`. | `Related` | `{ min: 1, max: 6, step: 1 }` |
| `shareLabel` | « Libellé share » | `text` | non | `"Partager"` | Libellé au-dessus des boutons de partage. **TBD** : à confirmer dans `ShareButtons.tsx`. | `Share` | `{ maxLength: 30 }` |
| `authorFallbackBio` | « Bio par défaut auteur » | `multiline` | non | `"Plume invitée de la maison FemiGlow."` | Bio affichée si l'article n'a pas de `author.bio`. **TBD** : à confirmer dans `AuthorCard.tsx`. | `Author` | `{ maxLength: 240 }` |
| `dropCap` | « Lettrine activée » | `boolean` | non | `true` | Active la lettrine sur le premier paragraphe (`ArticleProse.tsx`, prop `dropCap`). | `Body` | – |
| `heroQuote` | « Citation héro layout » | `quote` | non | `null` | Citation optionnelle insérée entre le hero et le corps, **uniquement** si l'admin l'active globalement (ex: pendant un événement éditorial). N'est **pas** la même chose qu'une citation per-article (qui vit dans le markdown du body). | `Hero` | – |
| `breadcrumbRoot` | « Segment racine fil d'ariane » | `breadcrumb-segment` | non | `{ "label": "Journal", "href": "/journal" }` | Premier segment du fil d'ariane après « Accueil » — codé en dur dans `journal/[slug]/page.tsx:101`. | `Breadcrumb` | – |

> **Remarques**  
> - Tous les champs sont **non required** : l'absence renvoie au
>   default seedé.  
> - Aucun de ces fields n'a vocation à varier entre articles. Si
>   un besoin par-article apparaît (ex `relatedLimit` qui change
>   pour un long-form), on créera un champ surchargeant à l'échelle
>   de l'article via le système d'articles, **pas** ici.

> **TBD** : 4 champs marqués TBD ci-dessus n'ont pas pu être lus
> dans le code source pendant la rédaction de cette fiche
> (`TableOfContents.tsx`, `RelatedArticles.tsx`, `ShareButtons.tsx`,
> `AuthorCard.tsx`). Au moment de la migration, ouvrir chacun et
> remplacer la valeur proposée par le **littéral exact**.

### defaultValue (jsonb encodé)

```jsonc
// journal-article.tocHeading
{ "v": "Sur cette page" }

// journal-article.relatedHeading
{ "v": "À lire ensuite" }

// journal-article.relatedLimit
{ "v": 3 }

// journal-article.shareLabel
{ "v": "Partager" }

// journal-article.authorFallbackBio
{ "v": "Plume invitée de la maison FemiGlow." }

// journal-article.dropCap
{ "v": true }

// journal-article.heroQuote
null

// journal-article.breadcrumbRoot
{ "label": "Journal", "href": "/journal" }
```

## 4. Wireframe / contexte

```
┌──────────────  /journal/[slug] (viewport ≥ 1280)  ─────────────────┐
│  [ Header global ]                                                  │
│                                                                     │
│  ┌────────────────  ARTICLE HERO (per-article)  ──────────────────┐ │
│  │   image 16:9 pleine largeur (slot Component-Media)              │ │
│  │   ── kicker (catégorie, per-article) ──                         │ │
│  │   Heading display-md (per-article : article.title)              │ │
│  │   Auteur · date · 4 min de lecture                              │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌─────────────────  CORPS  ─────────────────┐  ┌── SIDEBAR (xl) ─┐ │
│  │                                            │  │ tocHeading        │ │
│  │  L  e froid sec de Casablanca…             │  │  ──────────       │ │
│  │  (drop-cap si dropCap=true)                │  │  • La saison      │ │
│  │                                            │  │  • Le rituel      │ │
│  │  ## La saison sèche, vraiment              │  │  • Ce que…        │ │
│  │  …                                          │  │                   │ │
│  │  > heroQuote (si non null)                  │  │                   │ │
│  │  …                                          │  └───────────────────┘ │
│  │                                            │                          │
│  │  shareLabel : [tw] [fb] [li] [copy]         │                          │
│  │                                            │                          │
│  │  ┌────  Auteur  ────────────────────────┐  │                          │
│  │  │  Salma F.                            │  │                          │
│  │  │  bio (ou authorFallbackBio)          │  │                          │
│  │  └──────────────────────────────────────┘  │                          │
│  └────────────────────────────────────────────┘                          │
│                                                                     │
│  [ NewsletterBlock — non couvert par cette fiche ]                  │
│                                                                     │
│  ┌─────────────  RELATED ARTICLES  ────────────────────────────────┐ │
│  │   relatedHeading (« À lire ensuite »)                           │ │
│  │   ┌──────┐  ┌──────┐  ┌──────┐                                  │ │
│  │   │ Card │  │ Card │  │ Card │   (relatedLimit=3)               │ │
│  │   └──────┘  └──────┘  └──────┘                                  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│  [ Footer global ]                                                   │
└──────────────────────────────────────────────────────────────────────┘
```

> **Capture de référence** : `apps/web/public/_screenshots/journal-article.png`
> (article `hiver-ongles-patience` recommandé comme spécimen).

## 5. Lignes éditoriales (voix FemiGlow)

- **tocHeading** : groupe nominal court (« Sur cette page »,
  « Au sommaire »). Pas de verbe. Pas de point final.
- **relatedHeading** : « À lire ensuite », « Pour prolonger »,
  « Dans le même atelier ». Court, doux, jamais
  « Articles similaires » (jargon SEO).
- **shareLabel** : « Partager » suffit. Pas de « Diffuser sur les
  réseaux ».
- **authorFallbackBio** : 1 phrase. Doit fonctionner pour tous
  les futurs auteurs invités.
- **heroQuote** : à utiliser **avec parcimonie**. Pertinent quand
  on veut donner une couleur événementielle à toute la
  rubrique (ex semaine de la fête des mères). Sinon : `null`.

### Bons exemples

```
tocHeading        : « Sur cette page »
relatedHeading    : « À lire ensuite »
relatedHeading    : « Dans le même atelier »
authorFallbackBio : « Plume invitée de la maison FemiGlow. »
```

### Contre-exemples

```
tocHeading      : « Table des matières »                — registre scolaire
relatedHeading  : « Articles similaires »               — jargon SEO
relatedHeading  : « Vous aimerez aussi… »               — registre marchand
shareLabel      : « Diffuser sur les réseaux sociaux »  — verbeux
heroQuote       : « N’oubliez pas de partager ! »       — injonction
```

## 6. Scénarios MSW (6)

```ts
// scenario: empty
// Cascade défaut, layout identique à la prod actuelle.
{ componentKey: 'journal-article', bindings: [] }

// scenario: default
// Tous les fields seedés en published, identiques au defaultValue.
{
  componentKey: 'journal-article',
  bindings: [
    { fieldKey: 'tocHeading',     status: 'published', value: { v: 'Sur cette page' } },
    { fieldKey: 'relatedHeading', status: 'published', value: { v: 'À lire ensuite' } },
    { fieldKey: 'relatedLimit',   status: 'published', value: { v: 3 } },
    { fieldKey: 'dropCap',        status: 'published', value: { v: true } },
    { fieldKey: 'breadcrumbRoot', status: 'published', value: { label: 'Journal', href: '/journal' } },
  ],
}

// scenario: rich-text-edge — N/A
// Aucun field rich-text dans cette fiche. Le body markdown reste
// dans articles.body, donc cette catégorie de scénario s'applique
// au système articles, pas ici. On la remplace par 'quote-set'.

// scenario: quote-set
// La fondatrice active heroQuote pour la semaine du 8 mars.
{
  fieldKey: 'heroQuote',
  status: 'published',
  value: { text: 'On lit lentement, ou on ne lit pas.', author: 'Salma F.' },
}

// scenario: special-chars
// Apostrophes courbes, espace fine insécable.
{
  fieldKey: 'relatedHeading',
  value: { v: 'À\u202flire\u202fensuite' },
}

// scenario: number-edge
// relatedLimit à 6 (borne haute), test que la grille tient sur 4
// articles disponibles seulement (graceful : afficher ce qui existe).
{
  fieldKey: 'relatedLimit',
  value: { v: 6 },
}

// scenario: scheduled-pending
// Reformulation de relatedHeading programmée pour le passage été.
{
  fieldKey: 'relatedHeading',
  status: 'scheduled',
  scheduledAt: '2026-06-21T05:00:00.000Z',
  value: { v: 'Dans la même saison' },
}
```

## 7. Notes de migration

1. **Ouvrir et confirmer les 4 TBD** :
   - `apps/web/src/components/sections/TableOfContents.tsx` → `tocHeading`
   - `apps/web/src/components/sections/RelatedArticles.tsx` ou
     `apps/web/src/components/sections/RelatedArticlesBound.tsx` →
     `relatedHeading`
   - `apps/web/src/components/sections/ShareButtons.tsx` → `shareLabel`
   - `apps/web/src/components/sections/AuthorCard.tsx` →
     `authorFallbackBio`
   Remplacer la valeur proposée par le **littéral exact**.
2. **Décider du sort de `breadcrumbRoot`** : si on veut éditer le
   libellé « Journal », ce field a sa place ici. Si jamais, à
   terme, on ajoute des sous-rubriques (« Journal / Saisons »),
   il faudra évoluer vers une `list<breadcrumb-segment>`.
3. **`relatedLimit`** : remplacer le `slice(0, 3)` codé en dur par
   `slice(0, fields.relatedLimit ?? 3)` dans
   `apps/web/src/app/(marketing)/journal/[slug]/page.tsx:85`.
4. **`heroQuote`** : ajouter au RSC `ArticleHero.tsx` un
   `<Quote>` conditionnel sous le bloc meta. Réfléchir à
   l'animation associée.
5. **`dropCap`** : `ArticleProse.tsx` accepte déjà la prop. Brancher.
6. **Ne pas migrer les champs per-article** ici. La fiche initiale
   listait `kicker`, `title`, `excerpt`, `body`, `relatedArticles`,
   `heroQuote per-article` : tout cela reste dans la table
   `articles`. Ouvrir un ticket distinct pour le futur écran
   `/admin/articles`.

> Procédure pas-à-pas : [`runbook/02-add-field.md`](../runbook/02-add-field.md) (R2).

## 8. Tests liés

| Niveau | Fichier | Couverture |
|--------|---------|------------|
| Unit (resolver) | `apps/web/src/lib/components/__tests__/journal-article.resolve.test.ts` | cascade, fallback `authorFallbackBio`. |
| RTL (RSC) | `apps/web/src/components/sections/ArticleHero.test.tsx`, `ArticleCard.test.tsx` (existants) + `TableOfContents.test.tsx` *(à créer)* | rendu avec/sans `heroQuote`, lettrine on/off. |
| RTL (admin éditeur) | `apps/web/src/app/admin/components/[key]/__tests__/journal-article.editor.test.tsx` | ajustement de `relatedLimit`, validation borne 1-6. |
| E2E | `apps/web/playwright/admin/journal-article.spec.ts` | éditer `relatedHeading`, publier, vérifier sur trois articles différents. |

## 9. Changelog

| Date | Auteur | Changement |
|------|--------|------------|
| 2026-05-05 | docs | Création initiale. Périmètre : fields **structurels** uniquement ; les fields per-article restent dans la table `articles`. 4 TBD à confirmer en lisant les composants `TableOfContents`, `RelatedArticles`, `ShareButtons`, `AuthorCard`. |
