# 11 — SEO & métadonnées

> *Le SEO chez FemiGlow n'est pas une couche posée — c'est l'écriture même.*

---

## 1. Posture SEO

FemiGlow ne joue pas l'attaque par volume de keywords. La marque s'inscrit dans une niche éditoriale (rituel de soin éthique au Maroc) et travaille **trois leviers** :

1. **SEO éditorial** — `/journal` produit du contenu de qualité (long-form, original, ancré saison) qui attire un trafic qualifié sur des requêtes longue traîne
2. **SEO produit** — `/kit` répond à une intention transactionnelle précise (« kit soin ongles maroc », « base soin transparente »)
3. **SEO marque** — `/` et `/maison` capturent les recherches « FemiGlow », notamment via les schémas `Organization` et `Brand`

Pas de course aux backlinks artificiels. Pas de farm de pages. Une page = une intention.

## 2. Mots-clefs cibles (Phase 1)

| Page | Mot-clé principal | Variantes longue traîne | Volume estimé Maroc |
|---|---|---|---|
| `/` | rituel soin ongles maroc | rituel ongles maison, soin ongles naturel | 200-400 |
| `/rituel` | rituel ongles 5 minutes | étapes soin ongles, rituel manucure naturelle | 150-300 |
| `/kit` | kit soin ongles maroc | base soin ongles transparente, fortifiant ongles maroc | 300-500 |
| `/journal` | journal soin ongles, beauté lente | conseils saison ongles | 100-200 |
| `/journal/[slug]` | varie selon article | longue traîne saisonnière | 50-150 par article |
| `/maison` | femiglow casablanca | maison femiglow, marque ongles maroc | 50-100 |

**Stratégie** : ne pas toucher aux requêtes hyper-concurrentielles (« vernis », « manucure ») mais détenir le sémantique « rituel ongles » + « beauté lente » + « ongles naturels Maroc ».

## 3. Metadata API Next.js

### 3.1 Layout racine

```ts
// app/layout.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  metadataBase: new URL('https://femiglow.ma'),
  title: {
    template: '%s — FemiGlow',
    default: 'FemiGlow — Le rituel ongles, en cinq minutes',
  },
  description: 'FemiGlow — maison marocaine de soin pour les ongles. Un rituel saisonnier, en cinq minutes, à la maison.',
  keywords: ['rituel ongles', 'soin ongles maroc', 'beauté lente', 'manucure naturelle'],
  authors: [{ name: 'FemiGlow' }],
  creator: 'FemiGlow',
  publisher: 'FemiGlow',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  alternates: {
    canonical: '/',
    languages: {
      'fr-MA': '/',
      // Phase 2 : 'ar-MA': '/ar'
    },
  },
  openGraph: {
    type: 'website',
    locale: 'fr_MA',
    url: 'https://femiglow.ma',
    siteName: 'FemiGlow',
    images: [{
      url: '/og/og-default.png',
      width: 1200,
      height: 630,
      alt: 'FemiGlow — Le rituel ongles',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@femiglow',
    creator: '@femiglow',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
};
```

### 3.2 Pages dynamiques

```ts
// app/(marketing)/journal/[slug]/page.tsx
import type { Metadata } from 'next';
import { cms } from '@/lib/cms';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = await cms.getArticleBySlug(params.slug);
  if (!article) return { title: 'Article introuvable' };

  return {
    title: article.seo.title ?? article.title,
    description: article.seo.description ?? article.excerpt,
    keywords: article.seo.keywords,
    alternates: { canonical: `/journal/${article.slug}` },
    openGraph: {
      type: 'article',
      title: article.seo.ogTitle ?? article.title,
      description: article.seo.ogDescription ?? article.excerpt,
      publishedTime: article.publishedAt.toISOString(),
      modifiedTime: article.updatedAt.toISOString(),
      authors: [article.author.name],
      images: [{
        url: article.featuredImage.src,
        width: article.featuredImage.width,
        height: article.featuredImage.height,
        alt: article.featuredImage.alt,
      }],
    },
  };
}
```

## 4. Title et description : règles d'écriture

### 4.1 Title (50-60 caractères)

| Bonne pratique | Exemple FemiGlow |
|---|---|
| Inclure mot-clé principal | « Le rituel ongles, en cinq minutes — FemiGlow » |
| Ton éditorial cohérent | « Hiver, ongles, patience — Journal FemiGlow » |
| Pas d'ALL CAPS | jamais |
| Pas d'emoji | jamais |
| Pas de point d'exclamation | jamais |
| Séparateur élégant | `—` (em dash) |

### 4.2 Description (140-160 caractères)

- Promesse claire en première phrase
- Verbe d'action implicite (« Découvrez », « Lisez ») — sans formules vendeuses
- Pas de point d'exclamation
- Citer le bénéfice concret, jamais l'argument de vente

**Exemple `/kit`** : *« Le kit FemiGlow réunit la base, le fortifiant et la lime. Trois gestes, cinq minutes, un rituel saisonnier pensé à Casablanca. »*

## 5. Sitemap.xml dynamique

```ts
// app/sitemap.ts
import { MetadataRoute } from 'next';
import { cms } from '@/lib/cms';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = 'https://femiglow.ma';
  const articles = await cms.getArticles({ limit: 100 });

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${base}/rituel`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/kit`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.95 },
    { url: `${base}/journal`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.85 },
    { url: `${base}/maison`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/contact`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.5 },
  ];

  const articleRoutes: MetadataRoute.Sitemap = articles.map(a => ({
    url: `${base}/journal/${a.slug}`,
    lastModified: a.updatedAt,
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...articleRoutes];
}
```

**Exclus** du sitemap : `/panier`, `/commander`, `/merci` (transactionnels), pages légales (linkés depuis footer).

## 6. robots.txt

```ts
// app/robots.ts
import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/panier', '/commander', '/merci', '/api/', '/_next/'],
      },
      {
        userAgent: 'GPTBot',
        disallow: '/', // Phase 1 : refus indexation IA générative
      },
      {
        userAgent: 'CCBot',
        disallow: '/',
      },
    ],
    sitemap: 'https://femiglow.ma/sitemap.xml',
    host: 'https://femiglow.ma',
  };
}
```

**Décision Phase 1** : refus de scraping par bots IA tant que la posture éditoriale n'est pas explicitement négociée (cf. politique fondatrice).

## 7. Schémas structurés (JSON-LD)

### 7.1 Organization (site-wide, dans `layout.tsx`)

```tsx
const organizationSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'FemiGlow',
  url: 'https://femiglow.ma',
  logo: 'https://femiglow.ma/logo.png',
  sameAs: [
    'https://www.instagram.com/femiglow',
  ],
  contactPoint: {
    '@type': 'ContactPoint',
    contactType: 'customer service',
    email: 'contact@femiglow.ma',
    areaServed: 'MA',
    availableLanguage: ['French', 'Arabic'],
  },
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Casablanca',
    addressCountry: 'MA',
  },
};

<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
/>
```

### 7.2 Product (sur `/kit`)

```ts
const productSchema = {
  '@context': 'https://schema.org',
  '@type': 'Product',
  name: 'Le rituel FemiGlow',
  description: 'Kit soin ongles complet : base, fortifiant, lime.',
  brand: { '@type': 'Brand', name: 'FemiGlow' },
  image: ['https://femiglow.ma/products/kit-1200.jpg'],
  sku: 'FG-KIT-001',
  offers: {
    '@type': 'Offer',
    url: 'https://femiglow.ma/kit',
    priceCurrency: 'MAD',
    price: '320.00',
    availability: 'https://schema.org/InStock',
    priceValidUntil: '2026-12-31',
    shippingDetails: {
      '@type': 'OfferShippingDetails',
      shippingRate: { '@type': 'MonetaryAmount', value: '40', currency: 'MAD' },
      shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'MA' },
    },
  },
  aggregateRating: ratings.length > 0 ? {
    '@type': 'AggregateRating',
    ratingValue: averageRating,
    reviewCount: ratings.length,
  } : undefined,
};
```

### 7.3 Article (sur `/journal/[slug]`)

```ts
const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: article.title,
  description: article.excerpt,
  image: [article.featuredImage.src],
  datePublished: article.publishedAt.toISOString(),
  dateModified: article.updatedAt.toISOString(),
  author: { '@type': 'Person', name: article.author.name },
  publisher: {
    '@type': 'Organization',
    name: 'FemiGlow',
    logo: { '@type': 'ImageObject', url: 'https://femiglow.ma/logo.png' },
  },
  mainEntityOfPage: { '@type': 'WebPage', '@id': `https://femiglow.ma/journal/${article.slug}` },
  wordCount: article.wordCount,
  inLanguage: 'fr-MA',
  articleSection: article.category,
};
```

### 7.4 BreadcrumbList (toutes les pages internes)

```ts
const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://femiglow.ma' },
    { '@type': 'ListItem', position: 2, name: 'Journal', item: 'https://femiglow.ma/journal' },
    { '@type': 'ListItem', position: 3, name: article.title },
  ],
};
```

### 7.5 FAQPage (sur `/kit`)

```ts
const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqItems.map(item => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  })),
};
```

### 7.6 WebSite + SearchAction (Phase 2)

```ts
const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'FemiGlow',
  url: 'https://femiglow.ma',
  potentialAction: {
    '@type': 'SearchAction',
    target: 'https://femiglow.ma/journal?q={search_term_string}',
    'query-input': 'required name=search_term_string',
  },
};
```

## 8. Open Graph et Twitter Cards

### 8.1 OG images : règles

| Page | Image OG | Stratégie |
|---|---|---|
| `/` | OG default 1200×630 | Pose graphique : wordmark + photo contextuelle + tagline |
| `/kit` | OG produit | Photo produit centrée, fond Crème, étiquette saison visible |
| `/journal/[slug]` | OG article | Image hero article + titre overlay typographique |
| `/maison` | OG fondatrice | Portrait main + signature scriptée |
| Autres | OG default | Variations chromatiques |

**Génération dynamique** : `app/journal/[slug]/opengraph-image.tsx` via `next/og` :

```tsx
import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OGImage({ params }: Props) {
  const article = await cms.getArticleBySlug(params.slug);
  return new ImageResponse(
    <div style={{ /* Tailwind-like */ }}>
      <h1>{article.title}</h1>
      <p>FemiGlow — Journal</p>
    </div>,
    size
  );
}
```

### 8.2 Twitter Cards

`summary_large_image` partout. `@femiglow` réservé même si le compte n'est pas actif Phase 1.

## 9. URLs canoniques

| Cas | Stratégie |
|---|---|
| URL de référence | `<link rel="canonical" href="https://femiglow.ma/...">` |
| Paramètres tracking (`?utm_*`, `?fbclid`) | Canonical pointe vers URL nue |
| Pagination journal (Phase 2) | `rel="canonical"` vers page 1, `rel="prev"`/`rel="next"` (déprécié mais toujours utile) |
| Variations couleur produit (n/a Phase 1) | une seule URL canonique |

## 10. Hreflang (Phase 2)

```html
<link rel="alternate" hreflang="fr-MA" href="https://femiglow.ma/" />
<link rel="alternate" hreflang="ar-MA" href="https://femiglow.ma/ar/" />
<link rel="alternate" hreflang="x-default" href="https://femiglow.ma/" />
```

Configuré dans `Metadata.alternates.languages`.

## 11. Linking interne

| Règle | Application |
|---|---|
| **3+ liens entrants** par page importante | `/kit` reçoit liens depuis `/`, `/rituel`, `/journal/*`, `/maison` |
| **Anchor text descriptive** | « Découvrir le rituel » plutôt que « cliquez ici » |
| **Pas de liens orphelins** | toute page accessible en 3 clics depuis `/` |
| **Cross-links éditoriaux** | 3 articles cross en bas de chaque article |
| **Footer dense** | toutes les pages utilitaires linkées en footer |
| **Breadcrumb** | sur articles journal et pages profondes |

## 12. Pagination & filtres

`/journal` Phase 1 : 12 articles featured + lien « Voir tout le journal ». Pas de pagination encore.

Phase 2 : pagination cursor-based (`?cursor=...`) ou pages numériques (`/journal/page/2`). Décision selon volume.

## 13. Pages d'erreur 404 / 410 / 301

| Cas | Réponse |
|---|---|
| Article supprimé | 410 Gone (volontaire) |
| URL changée | 301 vers nouvelle URL (configuration `next.config.mjs.redirects`) |
| URL inexistante | 404 (pas indexée) |

```ts
// next.config.mjs
export default {
  async redirects() {
    return [
      { source: '/products/:slug', destination: '/kit', permanent: true },
      { source: '/blog/:slug', destination: '/journal/:slug', permanent: true },
    ];
  },
};
```

## 14. Indexation et Search Console

| Étape | Action |
|---|---|
| Property setup | `https://femiglow.ma` (HTTPS, www-less) |
| Sitemap soumis | `https://femiglow.ma/sitemap.xml` |
| URL inspection | Vérifier indexation `/`, `/kit`, `/rituel` Phase 1 launch |
| Coverage report | Surveillance hebdo |
| Mobile Usability | 0 erreurs |
| Core Web Vitals | sync avec doc 10 |

Bing Webmaster Tools également configuré (Maroc utilise marginalement Bing).

## 15. Données structurées : validation

| Outil | Usage |
|---|---|
| Google Rich Results Test | À chaque modification de schema |
| Schema.org Validator | Validation contre vocab |
| Lighthouse SEO audit | CI |
| `next-seo` ou implémentation maison | choix : maison via `<script type="application/ld+json">` (zero dep) |

## 16. Performance SEO (rappel)

Google utilise CWV comme signal de classement. Voir doc 10 pour budgets. Cibles SEO-critiques :

- LCP < 2.5 s
- CLS < 0.1
- INP < 200 ms
- HTTPS (Vercel auto)
- Mobile-friendly (responsive)

## 17. Contenu : règles éditoriales SEO-aware

| Règle | Détail |
|---|---|
| **Un h1 par page**, mot-clé principal inclus | « Le rituel ongles, en cinq minutes » |
| **Hiérarchie h2/h3 logique** | aide le crawler |
| **Mot-clé dans 100 premiers mots** | mais sans bourrage |
| **Texte alt images** | descriptif, pas keyword-stuffing |
| **Liens internes** depuis paragraphe | anchors variés |
| **Pas de duplicate content** | chaque article unique |
| **Articles ≥ 800 mots** | pour densité éditoriale |
| **Mise à jour dates `updatedAt`** | freshness signal |

## 18. Anti-patterns SEO

- ❌ Keyword stuffing dans alt, titles, meta
- ❌ Duplicate meta titles entre pages
- ❌ Pages thin content (< 300 mots)
- ❌ Cloaking (contenu différent crawler / user)
- ❌ Hidden text (color: white)
- ❌ Pages doorway
- ❌ Liens achetés / fermes de liens
- ❌ `<title>` qui dépasse 70 caractères (tronqué)
- ❌ Multi-h1 par page
- ❌ Iframes de contenu indexable
- ❌ JS-only navigation sans fallback (App Router gère bien)

## 19. Checklist SEO par page

- [ ] `<title>` 50-60 caractères, mot-clé principal
- [ ] `<meta description>` 140-160 caractères
- [ ] `<link rel="canonical">` correct
- [ ] OG tags + Twitter card
- [ ] OG image 1200×630 < 200 kB
- [ ] Schémas JSON-LD pertinents
- [ ] Hiérarchie h1 → h2 → h3
- [ ] Alt sur toutes les images
- [ ] Liens internes pertinents
- [ ] Pas d'erreurs Lighthouse SEO
- [ ] Mobile-friendly testé
- [ ] Core Web Vitals dans cible

> *Document suivant : [12 — QA, debugging & observabilité](./12-qa-debugging-observabilite.md)*
