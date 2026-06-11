# URL strategy — Path-based routing

> Décision : `/[locale]/page` (path-based), cf. ADR-002.

## 1. Structure URL cible

### 1.1 Routes principales

| Avant | Après |
|---|---|
| `/` | `/fr/` (default) ou `/ar/`, `/en/` |
| `/maison` | `/fr/maison`, `/ar/maison`, `/en/maison` |
| `/kit` | `/fr/kit`, `/ar/kit`, `/en/kit` |
| `/rituel` | `/fr/rituel`, `/ar/rituel`, `/en/rituel` |
| `/contact` | `/fr/contact`, `/ar/contact`, `/en/contact` |
| `/journal` | `/fr/journal`, `/ar/journal`, `/en/journal` |
| `/journal/[slug]` | `/fr/journal/[slug]`, `/ar/journal/[slug]`, etc. |
| `/legal/mentions-legales` | `/fr/legal/mentions-legales`, etc. |
| `/admin/...` | **PAS de préfixe** (admin = FR seul) |
| `/api/...` | **PAS de préfixe** (API agnostique) |

### 1.2 Localized pathnames (optionnel V2)

Pour SEO encore meilleur, traduire les segments :

| FR | AR | EN |
|---|---|---|
| `/fr/kit` | `/ar/الكيت` (ou `/ar/kit`) | `/en/kit` |
| `/fr/journal` | `/ar/المجلة` | `/en/journal` |

→ **V1** : on garde les pathnames identiques (`kit`, `journal`) pour simplicité.
→ **V2** : on peut customiser via `next-intl` `createLocalizedPathnamesNavigation`.

## 2. Cas limites

### 2.1 URL `/` racine

**Décision** : redirect 301 vers `/{detected_locale}/`.

**Algorithme** :
1. Path est `/`
2. Middleware détecte locale via cookie/header/default
3. Redirect `/` → `/fr/` (ou `/ar/`, `/en/`)
4. Cookie `NEXT_LOCALE` persisté

### 2.2 URL `/legacy-page` (sans préfixe)

**Décision** : redirect 301 vers `/fr/legacy-page` (avec default locale).

**Implémentation** : middleware vérifie si le 1er segment est une locale connue. Sinon, ajoute la locale détectée.

### 2.3 Switch de langue depuis `/fr/kit`

**Décision** : navigate vers `/ar/kit` (même slug, langue différente).

**Implémentation** :
```tsx
import { useRouter, usePathname } from 'next-intl/client';
const router = useRouter();
const pathname = usePathname(); // '/kit'
router.replace(pathname, { locale: 'ar' });
// → navigates to '/ar/kit'
```

### 2.4 URLs admin / API non préfixées

**Décision** : `admin/*` et `api/*` ne reçoivent **PAS** de préfixe locale.

**Configuration `middleware.ts`** :
```ts
export const config = {
  matcher: [
    // Match all paths except admin, api, _next, static files
    '/((?!admin|api|_next|_vercel|.*\\..*).*)',
  ],
};
```

### 2.5 Liens externes (Instagram, emails marketing)

**Décision** : utiliser sites canonical par défaut (`/fr/...`).
Si on connaît la langue du destinataire (email), envoyer dans cette langue.

### 2.6 URLs partagées (réseau social)

**Décision** : l'URL contient la locale → la page s'ouvre dans cette langue.
Exemple : un user partage `/ar/kit` sur Twitter → quiconque clique voit le pack en AR (même si visiteur est FR).

C'est l'intention recherchée du path-based routing.

## 3. SEO impact

### 3.1 hreflang tags

Sur chaque page, le middleware/RSC injecte :

```html
<link rel="alternate" hreflang="fr" href="https://femiglow.ma/fr/kit" />
<link rel="alternate" hreflang="ar" href="https://femiglow.ma/ar/kit" />
<link rel="alternate" hreflang="en" href="https://femiglow.ma/en/kit" />
<link rel="alternate" hreflang="x-default" href="https://femiglow.ma/fr/kit" />
```

`x-default` = locale par défaut (`fr`).

### 3.2 Canonical URL

**Décision** : canonical = URL avec locale (pas URL sans locale).

```html
<link rel="canonical" href="https://femiglow.ma/fr/kit" />
```

### 3.3 Sitemap multi-locale

`sitemap.xml` liste TOUTES les URLs × TOUTES les locales :

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
  <url>
    <loc>https://femiglow.ma/fr/kit</loc>
    <xhtml:link rel="alternate" hreflang="fr" href="https://femiglow.ma/fr/kit"/>
    <xhtml:link rel="alternate" hreflang="ar" href="https://femiglow.ma/ar/kit"/>
    <xhtml:link rel="alternate" hreflang="en" href="https://femiglow.ma/en/kit"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="https://femiglow.ma/fr/kit"/>
  </url>
  <url>
    <loc>https://femiglow.ma/ar/kit</loc>
    <xhtml:link rel="alternate" hreflang="fr" href="https://femiglow.ma/fr/kit"/>
    ...
  </url>
  ...
</urlset>
```

next-intl fournit `getPathname` helper pour générer ces URLs.

## 4. Redirects et legacy

### 4.1 Strategy redirects existants

Si une URL `/legacy-page` redirige vers `/new-page` (sans locale), middleware doit :
1. Détecter locale
2. Appliquer redirect avec locale → `/fr/new-page`

### 4.2 Old URLs sans locale en prod

Pour les URLs déjà indexées Google sans locale :
```
/kit → 301 /fr/kit
/maison → 301 /fr/maison
```

→ Préserve le SEO existant.

## 5. Architecture Next.js App Router

### 5.1 Structure folder

```
src/app/
├── [locale]/                # Layout localized
│   ├── layout.tsx           # <html lang dir>
│   ├── (marketing)/
│   │   ├── page.tsx         # /[locale]/
│   │   ├── kit/
│   │   │   └── page.tsx     # /[locale]/kit
│   │   ├── maison/
│   │   │   └── page.tsx
│   │   └── ...
│   └── legal/
│       └── [slug]/
│           └── page.tsx     # /[locale]/legal/[slug]
├── admin/                   # Pas de locale prefix (FR seul)
│   └── ...
├── api/                     # Pas de locale prefix
│   └── ...
├── layout.tsx               # Root layout (minimal)
└── middleware.ts            # next-intl middleware
```

### 5.2 Middleware

```ts
// middleware.ts
import createMiddleware from 'next-intl/middleware';
import { locales, defaultLocale } from './i18n.config';

export default createMiddleware({
  locales: ['fr', 'ar', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'always', // Always prefix (vs 'as-needed')
  localeDetection: true,  // Auto detect via cookie + Accept-Language
});

export const config = {
  matcher: ['/((?!admin|api|_next|_vercel|.*\\..*).*)'],
};
```

### 5.3 Root layout

```tsx
// src/app/[locale]/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';
import { getLocaleConfig } from '@/lib/i18n/config';

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const messages = await getMessages();
  const localeConfig = getLocaleConfig(locale);

  return (
    <html lang={locale} dir={localeConfig.direction}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

## 6. Performance

| Aspect | Stratégie |
|---|---|
| **Static generation** | `generateStaticParams` génère 3 versions par page au build |
| **ISR** | Cache régénération à la demande pour pages CMS |
| **Edge middleware** | < 50ms latency ajoutée |
| **Bundle splitting** | Chaque locale = chunk séparé |

## 7. Migration progressive

### 7.1 Phase 1 — Setup parallèle

- Garder routes actuelles `/kit` etc.
- Créer routes `/[locale]/kit` en parallèle
- Feature flag : si `I18N_ENABLED=true`, redirect old to new

### 7.2 Phase 2 — Switch

- Toutes routes migrées vers `/[locale]/`
- Old routes deviennent redirects 301
- Sitemap updated

### 7.3 Phase 3 — Cleanup

- Supprimer les old routes
- Cleanup redirects (garder seulement pour SEO transition)
