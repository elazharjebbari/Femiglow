# 05 — Frontend public (rendu, metadata, JSON-LD, sitemap, robots)

Conception du rendu SEO côté public Next.js App Router. Détaille les modifs à apporter aux pages, helpers, sitemap et robots.

## 1. Pattern `generateMetadata` par route

### 1.1 Pattern standard (existant, à généraliser)

```ts
// apps/web/src/app/<route>/page.tsx
import type { Metadata } from 'next';
import { resolveSeoMetadata } from '@/lib/seo/resolve';
import { toNextMetadata } from '@/lib/seo/to-next-metadata';

export async function generateMetadata(): Promise<Metadata> {
  const resolved = await resolveSeoMetadata('page', '<routeKey>');
  return toNextMetadata(resolved, { canonicalPath: '/<route>' });
}
```

Helper `toNextMetadata` (à factoriser s'il n'existe pas déjà sous une autre forme) :

```ts
// apps/web/src/lib/seo/to-next-metadata.ts
export function toNextMetadata(
  resolved: ResolvedSeoMetadata,
  opts: { canonicalPath: string; alternates?: Record<string, string> },
): Metadata {
  return {
    title: resolved.title,
    description: resolved.description,
    alternates: {
      canonical: opts.canonicalPath,
      languages: opts.alternates,
    },
    openGraph: {
      title: resolved.og.title,
      description: resolved.og.description,
      images: resolved.og.image ? [resolved.og.image] : undefined,
      type: 'website',
      locale: 'fr_MA',
    },
    twitter: {
      card: resolved.twitter.card,
      title: resolved.og.title,
      description: resolved.og.description,
      images: resolved.og.image ? [resolved.og.image.url] : undefined,
    },
    robots: {
      index: resolved.robots.index,
      follow: resolved.robots.follow,
    },
    keywords: resolved.keywords,
  };
}
```

### 1.2 Fix phase 0 — `/commander` et `/merci`

Ajouter `export const metadata: Metadata` statique (pas besoin de cascade, ce sont des pages non-indexées) :

```ts
// apps/web/src/app/(commerce)/commander/page.tsx
export const metadata: Metadata = {
  title: 'Commander — FemiGlow',
  description: 'Finalisez votre commande du Rituel d\'Éclat. Livraison Casablanca et Rabat sous 48 h.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/commander' },
};

// apps/web/src/app/(commerce)/merci/page.tsx
export const metadata: Metadata = {
  title: 'Merci pour votre commande — FemiGlow',
  description: 'Votre commande a bien été enregistrée. Vous recevrez bientôt un message de la maison.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/merci' },
};
```

Ces strings respectent la charte (pas d'emoji, pas d'urgence, ton maison).

## 2. Intégration phase 5 — composants CMS

### 2.1 Cas d'usage `/kit`

La page `/kit` doit fusionner le SEO du **produit** (scope `product`, targetKey `le-kit`) avec celui du **composant hero** (scope `component`, targetKey `kit-hero`).

```ts
// apps/web/src/app/kit/page.tsx
export async function generateMetadata(): Promise<Metadata> {
  const resolved = await resolvePageWithComponents(
    'product',
    'le-kit',
    [
      { componentKey: 'kit-hero', overridableFields: ['title', 'ogImageMediaId'] },
    ],
  );
  return toNextMetadata(resolved, { canonicalPath: '/kit' });
}
```

Règles :

- Si l'override `kit-hero` (composant) écrase `title` et qu'un override `le-kit` (produit) écrase aussi `title`, le **composant gagne** (assomption : le composant est plus spécifique).
- Si aucun override composant, la résolution est identique à aujourd'hui.
- Le feature flag `NEXT_PUBLIC_SEO_COMPONENT_OVERRIDES` désactive l'appel `resolvePageWithComponents` au profit de `resolveSeoMetadata` standard.

### 2.2 Cas d'usage `/rituel`, `/journal`, `/maison`

Pattern identique avec la composante hero correspondante. Liste exhaustive dans `03-data-model.md` §2.1.

## 3. JSON-LD

### 3.1 Helpers existants à conserver

`lib/seo/json-ld.tsx` expose :

- `organizationSchema()`, `websiteSchema()`
- `productSchema(product, reviews?)`
- `faqSchema(items)`
- `howToSchema(steps)`
- `blogPostingSchema(article)`
- `breadcrumbSchema(items)`
- `localBusinessSchema()`, `contactPointSchema()`

### 3.2 Pattern d'injection

```tsx
import Script from 'next/script';
import { productSchema } from '@/lib/seo/json-ld';

export default function KitPage() {
  return (
    <>
      <Script
        id="ld-product"
        type="application/ld+json"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema(product, reviews)) }}
      />
      ...
    </>
  );
}
```

### 3.3 Override CMS de `structuredData`

Si un override SEO contient `structuredData` non null, il **remplace** le JSON-LD auto-généré pour la cible concernée (déjà implémenté dans `lib/seo/json-ld.tsx`). Documenter clairement dans l'admin que c'est une opération avancée.

## 4. Sitemap

### 4.1 État actuel et fix phase 1

```ts
// apps/web/src/app/sitemap.ts (refonte ciblée)
import type { MetadataRoute } from 'next';
import { env } from '@/lib/env';
import { getPublishedArticles, getSearchableLegalPages } from '@/lib/cms';

export const revalidate = 3600; // 1 h ; suffit pour les ISR

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: SITE_LAST_DEPLOY, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/kit`, lastModified: SITE_LAST_DEPLOY, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/rituel`, lastModified: SITE_LAST_DEPLOY, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/journal`, lastModified: SITE_LAST_DEPLOY, changeFrequency: 'daily', priority: 0.6 },
    { url: `${base}/maison`, lastModified: SITE_LAST_DEPLOY, changeFrequency: 'yearly', priority: 0.5 },
    { url: `${base}/contact`, lastModified: SITE_LAST_DEPLOY, changeFrequency: 'yearly', priority: 0.5 },
  ];

  const articles = await getPublishedArticles();
  const articleRoutes: MetadataRoute.Sitemap = articles.map((a) => ({
    url: `${base}/journal/${a.slug}`,
    lastModified: a.updatedAt,         // <-- fix F-04 : updatedAt réel
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  const legal = await getSearchableLegalPages();
  const legalRoutes: MetadataRoute.Sitemap = legal.map((p) => ({
    url: `${base}/legal/${p.slug}`,
    lastModified: p.updatedAt,         // <-- fix F-04
    changeFrequency: 'yearly',
    priority: 0.3,
  }));

  return [...staticRoutes, ...articleRoutes, ...legalRoutes];
}

// SITE_LAST_DEPLOY : constante de build (next build met la date)
const SITE_LAST_DEPLOY = new Date(process.env.NEXT_PUBLIC_BUILD_DATE ?? Date.now());
```

`NEXT_PUBLIC_BUILD_DATE` est injecté au build via `next.config.js` :

```js
// next.config.js
env: {
  NEXT_PUBLIC_BUILD_DATE: new Date().toISOString(),
},
```

Permet à Google de voir une `lastModified` stable entre déploiements sans changement réel — meilleur signal de fraîcheur.

### 4.2 Phase 6 — sitemap index si volume

Si la liste d'articles dépasse 5000, splitter en plusieurs fichiers (`sitemap-0.xml`, `sitemap-1.xml`) avec un sitemap index. Pas pertinent court terme.

## 5. Robots

État actuel correct, à conserver. Ajouts mineurs phase 6 :

- Documenter en commentaire les disallows liés à parsers IA.
- Ajouter `Disallow: /api/og/` ? Non — utile pour les crawlers qui ne respectent pas Cache-Control. À évaluer en monitoring.

## 6. Headers HTTP (phase 6, P2)

Ajout dans `next.config.js` :

```js
async headers() {
  return [
    {
      source: '/((?!api|admin|_next).*)',
      headers: [
        // Pages publiques : CDN cache court avec SWR long
        { key: 'cache-control', value: 'public, max-age=60, s-maxage=600, stale-while-revalidate=86400' },
      ],
    },
    // OG dynamic (déjà géré au niveau route handler)
    // Static assets et /_next/image conservent leur header existant.
  ];
}
```

Validation : le header ne doit pas s'appliquer aux routes admin (déjà en `no-store`), API (variable), ou pages POST.

## 7. Canonical normalisation (phase 6, P2)

Middleware Next.js :

```ts
// apps/web/src/middleware.ts (extrait)
export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // Strip UTM params for canonical purpose (redirect)
  const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  const hasUtm = utmKeys.some((k) => url.searchParams.has(k));
  if (hasUtm && req.method === 'GET' && !url.pathname.startsWith('/api')) {
    utmKeys.forEach((k) => url.searchParams.delete(k));
    return NextResponse.redirect(url, 301);
  }

  // Trailing slash normalization : on enlève, sauf '/'
  if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/$/, '');
    return NextResponse.redirect(url, 301);
  }

  // ... reste du middleware
}
```

**Attention** : les redirects 301 cassent le tracking d'origine UTM si on les strip avant analytics. Solution : firer l'analytics côté client AVANT le redirect (ou ne strip que si Googlebot UA détecté). Décision à arbitrer en phase 6 — peut être que le bénéfice SEO ne vaut pas la complexité.

## 8. Header de debug `x-seo-source` (phase 1)

Le helper `toNextMetadata` ne pose pas de header (limitation Next App Router). Solution : exposer une **API debug** `/api/_debug/seo?route=...` (cf. `04-backend-design.md` §6.1). Utilisable depuis l'admin et les tests Playwright.

Alternative : poser un meta tag `<meta name="seo-source" content="...">` quand `NODE_ENV === 'development'` ou flag debug actif :

```tsx
{resolved.source && process.env.NEXT_PUBLIC_SEO_DEBUG === 'true' && (
  <meta name="seo-source" content={resolved.source} />
)}
```

Solution retenue : **meta tag derrière flag**, complétée par l'endpoint debug. Pas de header (trop intrusif).

## 9. Images OG — résolution

Logique unifiée dans `resolveOgImageForRoute` (cf. `04-backend-design.md` §2.2) :

1. Si `ogImageMediaId` → URL média statique (`/uploads/...`).
2. Sinon si `ogImageTemplate` + flag `NEXT_PUBLIC_SEO_OG_DYNAMIC` actif → URL dynamique `/api/og/{template}?title=...&v=YYYY-MM`.
3. Sinon → fallback SVG statique par scope (`/og/kit.svg`, `/og/journal.svg`, etc.).

Dimensions garanties : 1200×630 PNG (dynamique) ou SVG/PNG selon le média. Toujours alt présent.

## 10. Tests frontend public

Liste détaillée dans `07-tests-strategy.md`. Aperçu :

- **Vitest** : snapshot de l'objet `Metadata` retourné par `generateMetadata` pour chaque route critique (`/`, `/kit`, `/journal/[slug]`).
- **Vitest** : snapshot du JSON-LD sérialisé pour `productSchema`, `blogPostingSchema`, etc.
- **Vitest** : `sitemap()` retourne le bon nombre de routes avec `lastModified` correct (mock de `getPublishedArticles`).
- **Playwright** : visite `/kit`, lit le `<title>`, la meta description, le canonical, le JSON-LD `application/ld+json`, l'OG image présente.
- **Playwright** : visite `/commander`, `/merci` après fix phase 0 et valide titre distinct + `robots: noindex`.

## 11. Invariants frontend

1. `generateMetadata` ne lance jamais. Try/catch interne avec fallback defaults.
2. Aucun `dynamic = 'force-dynamic'` sur pages SEO-critiques (sauf justifié).
3. JSON-LD valide selon Rich Results Test pour `Product`, `BlogPosting`, `BreadcrumbList`, `FAQPage`, `HowTo`, `LocalBusiness`.
4. Canonical absolue côté HTML (Next ajoute `metadataBase` automatiquement).
5. OG image dimensions exactes 1200×630, alt non vide.
6. Pas de couplage entre logique SEO et logique UI : `resolveSeoMetadata` ne dépend pas du DOM.
