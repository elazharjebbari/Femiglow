# SEO et canonicals — Metadata multilingue

> Tout ce qu'il faut pour que Google, Bing, et les réseaux sociaux comprennent que FemiGlow existe en plusieurs langues et servent la bonne version à chaque utilisateur.

## 1. Enjeux SEO multilingue

### 1.1 Les 4 signaux Google pour l'i18n

| Signal | Rôle | Implementation |
|---|---|---|
| **`hreflang`** | Dit à Google "ces pages sont des versions traduites les unes des autres" | `<link rel="alternate" hreflang="..." />` dans `<head>` ou sitemap |
| **Canonical URL** | Dit "voici l'URL maître de cette version" | `<link rel="canonical" href="..." />` |
| **`<html lang>`** | Dit "le contenu de cette page est dans cette langue" | `<html lang="ar" dir="rtl">` |
| **Sitemap multi-locale** | Liste exhaustive des URLs par langue | `sitemap.xml` avec balises `xhtml:link` |

### 1.2 Erreurs SEO classiques (à éviter)

- **Canonical identique pour toutes les locales** : Google déduplique → seule une version est indexée
- **`hreflang` sans réciprocité** : `/fr/kit` pointe `/ar/kit`, mais `/ar/kit` ne pointe pas `/fr/kit` → Google ignore le signal
- **`hreflang` avec URLs absolues incohérentes** : `http` vs `https`, `www` vs sans `www`
- **`<html lang>` faux** : `<html lang="en">` sur une page en arabe → confond les screen readers et bots
- **Sitemap avec `priority` faux** : toutes les locales doivent avoir la même priorité
- **Robots.txt qui bloque `/ar/`** : oublie d'un crawler config

## 2. Metadata par page

### 2.1 Helper `generateMetadata` Next.js

```tsx
// apps/web/src/app/[locale]/(marketing)/kit/page.tsx
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { LOCALES, type Locale } from '@/i18n.config';
import { buildAlternates, buildCanonical } from '@/lib/seo/metadata-helpers';

interface Props {
  params: { locale: Locale };
}

export async function generateMetadata({ params: { locale } }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'seo.kit' });

  return {
    title: t('title'),
    description: t('description'),
    keywords: t('keywords')
      .split(',')
      .map((k) => k.trim()),
    alternates: {
      canonical: buildCanonical(locale, '/kit'),
      languages: buildAlternates('/kit'),
    },
    openGraph: {
      title: t('og_title'),
      description: t('og_description'),
      url: buildCanonical(locale, '/kit'),
      siteName: 'FemiGlow',
      locale: mapToOgLocale(locale),
      alternateLocale: LOCALES.filter((l) => l !== locale).map(mapToOgLocale),
      images: [
        {
          url: t('og_image'),
          width: 1200,
          height: 630,
          alt: t('og_alt'),
        },
      ],
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: t('twitter_title'),
      description: t('twitter_description'),
      images: [t('twitter_image')],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-snippet': -1,
        'max-image-preview': 'large',
        'max-video-preview': -1,
      },
    },
  };
}
```

### 2.2 Helpers `buildCanonical` et `buildAlternates`

```ts
// apps/web/src/lib/seo/metadata-helpers.ts
import { LOCALES, type Locale } from '@/i18n.config';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://femiglow.ma';

export function buildCanonical(locale: Locale, path: string): string {
  // path doit commencer par '/' (ex: '/kit', '/journal/article-1')
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}/${locale}${normalized}`;
}

export function buildAlternates(path: string): Record<string, string> {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const result: Record<string, string> = {};

  for (const loc of LOCALES) {
    result[loc] = `${BASE_URL}/${loc}${normalized}`;
  }
  // x-default : FR par défaut
  result['x-default'] = `${BASE_URL}/fr${normalized}`;

  return result;
}

// Map BCP-47 → OpenGraph locale (ISO 15924 ish)
const OG_LOCALE_MAP: Record<Locale, string> = {
  fr: 'fr_FR',
  ar: 'ar_MA',
  en: 'en_US',
};

export function mapToOgLocale(locale: Locale): string {
  return OG_LOCALE_MAP[locale] ?? 'fr_FR';
}
```

### 2.3 Rendu HTML résultat

Pour `/fr/kit` :

```html
<head>
  <title>Pack FemiGlow — Le kit rituel ongles</title>
  <meta name="description" content="Découvrez le pack FemiGlow : trois gestes, un rituel ongles ancré au Maroc.">
  <link rel="canonical" href="https://femiglow.ma/fr/kit">
  <link rel="alternate" hreflang="fr" href="https://femiglow.ma/fr/kit">
  <link rel="alternate" hreflang="ar" href="https://femiglow.ma/ar/kit">
  <link rel="alternate" hreflang="en" href="https://femiglow.ma/en/kit">
  <link rel="alternate" hreflang="x-default" href="https://femiglow.ma/fr/kit">

  <meta property="og:title" content="Pack FemiGlow — Le rituel ongles">
  <meta property="og:description" content="Trois gestes, une saison. Maison FemiGlow.">
  <meta property="og:url" content="https://femiglow.ma/fr/kit">
  <meta property="og:site_name" content="FemiGlow">
  <meta property="og:locale" content="fr_FR">
  <meta property="og:locale:alternate" content="ar_MA">
  <meta property="og:locale:alternate" content="en_US">
  <meta property="og:image" content="https://femiglow.ma/og/kit-fr.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Pack FemiGlow">
  <meta name="twitter:description" content="Trois gestes, une saison.">
</head>
```

## 3. Sitemap multi-locale

### 3.1 Implémentation `app/sitemap.ts`

```ts
// apps/web/src/app/sitemap.ts
import type { MetadataRoute } from 'next';
import { db } from '@/lib/db';
import { legalPages } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { LOCALES } from '@/i18n.config';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://femiglow.ma';

// Routes statiques principales
const STATIC_ROUTES = [
  { path: '', priority: 1.0, changeFreq: 'daily' as const },
  { path: '/maison', priority: 0.9, changeFreq: 'weekly' as const },
  { path: '/kit', priority: 1.0, changeFreq: 'weekly' as const },
  { path: '/rituel', priority: 0.9, changeFreq: 'weekly' as const },
  { path: '/contact', priority: 0.5, changeFreq: 'monthly' as const },
  { path: '/journal', priority: 0.7, changeFreq: 'weekly' as const },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // 1. Routes statiques × locales
  for (const route of STATIC_ROUTES) {
    for (const locale of LOCALES) {
      entries.push({
        url: `${BASE_URL}/${locale}${route.path}`,
        lastModified: new Date(),
        changeFrequency: route.changeFreq,
        priority: route.priority,
        alternates: {
          languages: LOCALES.reduce(
            (acc, l) => ({ ...acc, [l]: `${BASE_URL}/${l}${route.path}` }),
            { 'x-default': `${BASE_URL}/fr${route.path}` } as Record<string, string>,
          ),
        },
      });
    }
  }

  // 2. Pages légales depuis DB
  const legal = await db
    .select({
      slug: legalPages.slug,
      locale: legalPages.locale,
      updatedAt: legalPages.updatedAt,
    })
    .from(legalPages)
    .where(eq(legalPages.status, 'published'));

  for (const page of legal) {
    entries.push({
      url: `${BASE_URL}/${page.locale}/legal/${page.slug}`,
      lastModified: page.updatedAt,
      changeFrequency: 'yearly',
      priority: 0.4,
      alternates: {
        languages: LOCALES.reduce(
          (acc, l) => ({ ...acc, [l]: `${BASE_URL}/${l}/legal/${page.slug}` }),
          { 'x-default': `${BASE_URL}/fr/legal/${page.slug}` } as Record<string, string>,
        ),
      },
    });
  }

  // 3. Articles journal (CMS dynamique)
  // const articles = await db.select(...).from(journalArticles)...
  // ... pareil

  return entries;
}
```

### 3.2 Rendu XML

Next.js génère automatiquement le `sitemap.xml` à `/sitemap.xml` :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://femiglow.ma/fr/kit</loc>
    <lastmod>2026-05-27T15:00:00.000Z</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
    <xhtml:link rel="alternate" hreflang="fr" href="https://femiglow.ma/fr/kit"/>
    <xhtml:link rel="alternate" hreflang="ar" href="https://femiglow.ma/ar/kit"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://femiglow.ma/en/kit"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://femiglow.ma/fr/kit"/>
  </url>
  <url>
    <loc>https://femiglow.ma/ar/kit</loc>
    <!-- mêmes alternates -->
  </url>
  <!-- ... -->
</urlset>
```

### 3.3 Sitemap index pour gros sites

Si le sitemap dépasse 50k URLs ou 50MB :

```ts
// apps/web/src/app/sitemap.xml/route.ts (sitemap index)
export async function GET() {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${BASE_URL}/sitemaps/marketing.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${BASE_URL}/sitemaps/journal.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${BASE_URL}/sitemaps/legal.xml</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>
</sitemapindex>`, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
```

## 4. Robots.txt

```ts
// apps/web/src/app/robots.ts
import type { MetadataRoute } from 'next';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://femiglow.ma';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/'],
        disallow: [
          '/admin/',
          '/api/',
          '/_next/',
          '/checkout/wizard/', // pas d'indexation du tunnel
          '/*/checkout/wizard/', // mêmes paths localisés
        ],
      },
      {
        userAgent: 'GPTBot',
        disallow: '/', // optionnel : interdire IA scrapers
      },
    ],
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
```

**Note** : NE PAS faire `Disallow: /ar/` ou autre locale — toutes les versions linguistiques doivent être crawlables.

## 5. JSON-LD localisé

### 5.1 Organization

```tsx
// apps/web/src/components/seo/json-ld-organization.tsx
import type { Locale } from '@/i18n.config';

interface Props {
  locale: Locale;
}

export function OrganizationJsonLd({ locale }: Props) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'https://femiglow.ma';

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${baseUrl}/#organization`,
    name: 'FemiGlow',
    url: `${baseUrl}/${locale}`,
    logo: `${baseUrl}/logo.png`,
    inLanguage: locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR',
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'MA',
      addressLocality: 'Casablanca',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: ['French', 'Arabic', 'English'],
    },
    sameAs: [
      'https://instagram.com/femiglow',
      // ...
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

### 5.2 Product (pour /kit)

```tsx
// apps/web/src/components/seo/json-ld-product.tsx
import { getTranslations } from 'next-intl/server';
import type { Locale } from '@/i18n.config';

export async function ProductJsonLd({ locale }: { locale: Locale }) {
  const t = await getTranslations({ locale, namespace: 'seo.kit' });

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${BASE_URL}/${locale}/kit#product`,
    name: t('product_name'),
    description: t('product_description'),
    inLanguage: locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR',
    brand: {
      '@type': 'Brand',
      name: 'FemiGlow',
    },
    image: [
      `${BASE_URL}/products/kit-1.jpg`,
      `${BASE_URL}/products/kit-2.jpg`,
    ],
    offers: {
      '@type': 'Offer',
      url: `${BASE_URL}/${locale}/kit`,
      priceCurrency: 'MAD',
      price: '199.00',
      availability: 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '4.8',
      reviewCount: '127',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

### 5.3 BreadcrumbList localisé

```tsx
// apps/web/src/components/seo/json-ld-breadcrumb.tsx
import { getTranslations } from 'next-intl/server';

interface Breadcrumb {
  name: string;
  url: string;
}

export async function BreadcrumbJsonLd({ items, locale }: { items: Breadcrumb[]; locale: Locale }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, idx) => ({
      '@type': 'ListItem',
      position: idx + 1,
      name: item.name,
      item: item.url,
    })),
    inLanguage: locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR',
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
```

Usage dans page `/[locale]/kit` :

```tsx
const t = await getTranslations({ locale, namespace: 'navigation' });
<BreadcrumbJsonLd
  locale={locale}
  items={[
    { name: t('home'), url: `${BASE_URL}/${locale}` },
    { name: t('kit'), url: `${BASE_URL}/${locale}/kit` },
  ]}
/>
```

### 5.4 Article (pour /journal/[slug])

```tsx
export async function ArticleJsonLd({ article, locale }: { article: Article; locale: Locale }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.summary,
    image: article.coverImage,
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    inLanguage: locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-US' : 'fr-FR',
    author: {
      '@type': 'Organization',
      name: 'FemiGlow',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${BASE_URL}/${locale}/journal/${article.slug}`,
    },
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}
```

## 6. OpenGraph par locale

### 6.1 Images OG localisées

Idéalement, chaque locale a sa propre image OG (sinon, partage social rend mal en arabe avec image FR).

Structure :
```
public/og/
├── fr/
│   ├── home.jpg
│   ├── kit.jpg
│   └── maison.jpg
├── ar/
│   ├── home.jpg     # texte arabe RTL incorporé
│   ├── kit.jpg
│   └── maison.jpg
└── en/
    ├── home.jpg
    ├── kit.jpg
    └── maison.jpg
```

Helper :
```ts
export function getOgImagePath(locale: Locale, page: string): string {
  return `${BASE_URL}/og/${locale}/${page}.jpg`;
}
```

### 6.2 OG dynamique avec `@vercel/og`

Si on veut générer les OG côté server-side :

```tsx
// apps/web/src/app/[locale]/kit/opengraph-image.tsx
import { ImageResponse } from 'next/og';
import { getTranslations } from 'next-intl/server';

export const runtime = 'edge';
export const alt = 'Pack FemiGlow';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/jpeg';

export default async function OgImage({ params: { locale } }: { params: { locale: Locale } }) {
  const t = await getTranslations({ locale, namespace: 'seo.kit' });
  const isRtl = locale === 'ar';

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #F5E6D3, #C9A87C)',
          fontFamily: isRtl ? 'Cairo' : 'Inter',
          direction: isRtl ? 'rtl' : 'ltr',
        }}
      >
        <h1 style={{ fontSize: 72, color: '#4A2C2A' }}>{t('og_title')}</h1>
        <p style={{ fontSize: 32 }}>{t('og_subtitle')}</p>
      </div>
    ),
    {
      ...size,
      fonts: isRtl
        ? [{ name: 'Cairo', data: await fetchFont('cairo'), weight: 700 }]
        : [{ name: 'Inter', data: await fetchFont('inter'), weight: 700 }],
    },
  );
}
```

Next.js 14 utilise le fichier `opengraph-image.tsx` automatiquement pour les meta OG.

### 6.3 Twitter card

```ts
// dans generateMetadata
twitter: {
  card: 'summary_large_image',
  title: t('twitter_title'),
  description: t('twitter_description'),
  images: [getOgImagePath(locale, 'kit')],
  creator: '@femiglow',
  site: '@femiglow',
}
```

## 7. Canonical URLs — Règles précises

### 7.1 Une URL canonical par page localisée

```
/fr/kit → canonical: /fr/kit
/ar/kit → canonical: /ar/kit
/en/kit → canonical: /en/kit
```

**Justification** : chaque version traduite est un contenu distinct, pas un duplicate. Google encourage des canonicals séparés en i18n.

### 7.2 Pas de canonical cross-locale

❌ Mauvais :
```html
<!-- /ar/kit -->
<link rel="canonical" href="https://femiglow.ma/fr/kit">
```

✅ Bon :
```html
<!-- /ar/kit -->
<link rel="canonical" href="https://femiglow.ma/ar/kit">
<link rel="alternate" hreflang="fr" href="https://femiglow.ma/fr/kit">
```

### 7.3 Query params et fragments

Canonical doit ignorer les query params marketing (`?utm_source=...`) :

```ts
import { headers } from 'next/headers';

function getCleanCanonical(locale: Locale, path: string): string {
  // path = '/kit' (sans query params)
  return `${BASE_URL}/${locale}${path}`;
}
```

Si Next.js inclut les query par défaut, override via `alternates.canonical`.

### 7.4 Trailing slash

**Décision FemiGlow** : pas de trailing slash sauf pour la racine.

```
✅ /fr/kit
✅ /fr/ (racine locale)
❌ /fr/kit/   (sera redirigé 301 vers /fr/kit)
```

Config Next.js :
```js
// next.config.mjs
const nextConfig = {
  trailingSlash: false,
};
```

## 8. Indexation et Search Console

### 8.1 Soumission du sitemap

```
Google Search Console → Sitemaps → Submit
URL: https://femiglow.ma/sitemap.xml
```

### 8.2 Vérification multi-domaine (V2)

Si on déploie sur `femiglow.fr` ou `femiglow.ae`, configurer :

```html
<meta name="google-site-verification" content="..." />
```

Pour chaque hostname.

### 8.3 hreflang validation tools

- **Google Search Console** : section "International Targeting"
- **Aleyda Solis hreflang tool** : <https://hreflang.org/>
- **Sistrix** : audit hreflang automatique

### 8.4 Audit automatique

```ts
// scripts/seo/audit-hreflang.ts
import fetch from 'node-fetch';
import { JSDOM } from 'jsdom';
import { LOCALES } from '../../apps/web/src/i18n.config';

async function auditPage(path: string) {
  const errors: string[] = [];

  for (const locale of LOCALES) {
    const url = `https://femiglow.ma/${locale}${path}`;
    const html = await fetch(url).then(r => r.text());
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // 1. Vérifier hreflang count
    const hreflangs = doc.querySelectorAll('link[rel="alternate"][hreflang]');
    if (hreflangs.length < LOCALES.length + 1) {
      errors.push(`${url}: missing hreflang (${hreflangs.length} found, expected ${LOCALES.length + 1})`);
    }

    // 2. Vérifier canonical
    const canonical = doc.querySelector('link[rel="canonical"]');
    if (!canonical || canonical.getAttribute('href') !== url) {
      errors.push(`${url}: canonical mismatch`);
    }

    // 3. Vérifier <html lang>
    const htmlLang = doc.documentElement.getAttribute('lang');
    if (htmlLang !== locale) {
      errors.push(`${url}: <html lang> is "${htmlLang}", expected "${locale}"`);
    }

    // 4. Vérifier réciprocité
    for (const otherLocale of LOCALES) {
      const link = doc.querySelector(`link[rel="alternate"][hreflang="${otherLocale}"]`);
      if (!link) errors.push(`${url}: missing hreflang for ${otherLocale}`);
    }
  }

  return errors;
}

// Run sur les principales pages
const paths = ['', '/maison', '/kit', '/rituel', '/contact', '/journal'];
for (const path of paths) {
  const errors = await auditPage(path);
  if (errors.length) {
    console.error(`Errors for ${path}:`, errors);
    process.exit(1);
  }
}
```

À runner en CI avant deploy.

## 9. Cas spécifiques FemiGlow

### 9.1 Pages légales

Si une page légale (ex: CGV) n'existe qu'en FR :

```tsx
// /ar/legal/cgv → fallback FR
// Métadata : canonical FR + hreflang fr only
// (pas de hreflang ar puisque la page n'existe pas en AR)

export async function generateMetadata({ params: { locale, slug } }) {
  const page = await getLegalPage(slug, locale);
  if (!page) return notFound();

  const effectiveLocale = page.locale; // 'fr' si fallback

  return {
    alternates: {
      canonical: `${BASE_URL}/${effectiveLocale}/legal/${slug}`,
      languages: {
        [effectiveLocale]: `${BASE_URL}/${effectiveLocale}/legal/${slug}`,
        // ... seulement les locales pour lesquelles la page existe vraiment
      },
    },
  };
}
```

### 9.2 Wizard checkout (pas indexé)

```tsx
// apps/web/src/app/[locale]/checkout/wizard/layout.tsx
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
};
```

### 9.3 Admin (pas indexé)

```tsx
// apps/web/src/app/admin/layout.tsx
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};
```

Et bloqué dans `robots.txt`.

## 10. Anti-patterns

1. **`hreflang` sans `x-default`** : Google peut hésiter sur quelle langue servir aux utilisateurs hors de tous les marchés ciblés.

2. **`hreflang="es-MX"` pour `es`** : trop spécifique. Si on n'a qu'une variante `es`, utiliser `hreflang="es"` simple.

3. **OG image partagée entre locales avec texte FR** : un user arabe partage un lien, l'image OG affiche du texte FR → mauvais UX.

4. **JSON-LD non localisé** (`inLanguage` manquant) : Google peut indexer la page mais ne pas la classer correctement par langue.

5. **Sitemap qui n'est pas regénéré** : la table `legal_pages` se met à jour, mais le sitemap reste obsolète. Solution : régénérer via ISR (`revalidate` sur `sitemap.ts`) ou cron.

6. **Robots.txt qui bloque `/ar/`** : oubli classique en suivant un tuto i18n mal écrit. Vérifier en prod.

7. **`<html lang>` figé** : si on a un layout qui force `<html lang="fr">`, les autres locales sont mal annoncées aux screen readers. Toujours dynamique.

8. **Mélanger `og:locale` avec mauvais format** : utiliser `fr_FR` (underscore), pas `fr-FR` (tiret). C'est une convention OG, pas BCP-47.

## 11. Monitoring SEO

### 11.1 Métriques à tracker

| Métrique | Outil | Cible |
|---|---|---|
| Pages indexées par locale | Google Search Console | 100% des pages publiques |
| Taux d'impression par locale | Search Console | Cohérent avec part de marché |
| Erreurs hreflang | Search Console > International | 0 |
| Mobile usability par locale | Search Console > Mobile | Pas d'erreur AR/EN spécifique |
| Core Web Vitals par locale | PageSpeed Insights | LCP < 2.5s, CLS < 0.1 |

### 11.2 Alerts

- **Indexation drop** : si une locale passe de 100% à < 90% d'indexation, alerter
- **hreflang errors** : si Search Console signale 5+ erreurs, alerter
- **Sitemap fail** : si `/sitemap.xml` retourne 500, page critique

## 12. Checklist à tester / à vérifier

### Metadata
- [ ] `/fr/kit` a `<title>` en français
- [ ] `/ar/kit` a `<title>` en arabe
- [ ] `/en/kit` a `<title>` en anglais
- [ ] `<html lang="fr">` sur `/fr/*`
- [ ] `<html lang="ar" dir="rtl">` sur `/ar/*`
- [ ] `<html lang="en">` sur `/en/*`

### Canonicals
- [ ] `/fr/kit` → canonical `/fr/kit`
- [ ] `/ar/kit` → canonical `/ar/kit`
- [ ] `/en/kit` → canonical `/en/kit`
- [ ] Pas de canonical cross-locale

### Hreflang
- [ ] 4 balises hreflang sur chaque page (fr, ar, en, x-default)
- [ ] URLs absolues et cohérentes (https, sans www)
- [ ] Réciprocité : `/fr/kit` ↔ `/ar/kit` ↔ `/en/kit`
- [ ] `x-default` pointe sur FR

### Sitemap
- [ ] `/sitemap.xml` accessible
- [ ] Liste toutes les pages × toutes les locales
- [ ] Chaque entrée a ses `<xhtml:link>` alternates
- [ ] `<lastmod>` est cohérent avec la DB
- [ ] Pas de page admin/wizard dans le sitemap

### Robots.txt
- [ ] `/robots.txt` autorise toutes les locales
- [ ] Bloque `/admin/` et `/api/`
- [ ] Référence le sitemap

### OpenGraph
- [ ] `og:locale` cohérent avec la page
- [ ] `og:alternate_locale` liste les autres locales
- [ ] `og:image` localisée si possible
- [ ] Twitter card valide (test : Twitter Card Validator)

### JSON-LD
- [ ] Organization avec `inLanguage`
- [ ] Product avec `inLanguage` + `priceCurrency` MAD
- [ ] BreadcrumbList localisée
- [ ] Validation : <https://search.google.com/test/rich-results>

### Pages spéciales
- [ ] Wizard a `robots: noindex`
- [ ] Admin a `robots: noindex`
- [ ] Pages légales fallback FR ne génèrent PAS de hreflang AR/EN faux

### Audit automatique
- [ ] Script `audit-hreflang.ts` passe en CI
- [ ] Pas d'erreur Search Console > International depuis 30 jours

## 13. Références croisées

- API contracts : [`02-design-conception/api-contracts.md`](../02-design-conception/api-contracts.md)
- URL strategy : [`02-design-conception/url-strategy.md`](../02-design-conception/url-strategy.md)
- RSC patterns : [`./server-rendering.md`](./server-rendering.md)
- Monitoring SEO : [`10-monitoring/seo-metrics.md`](../10-monitoring/seo-metrics.md)
- Tests SEO Playwright : [`07-tests/seo-tests.md`](../07-tests/seo-tests.md)
