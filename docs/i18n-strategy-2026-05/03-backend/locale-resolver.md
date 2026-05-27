# Locale resolver — Middleware et algorithme de résolution

> Détail complet de l'algorithme de détection de locale au edge runtime, configuration `createMiddleware` de next-intl, custom resolver pour cas particuliers, et performance.

## 1. Vue d'ensemble

À chaque requête arrivant sur le site FemiGlow, on doit décider **quelle locale servir**. Cette décision se prend dans un **middleware edge** (Vercel ou Cloudflare) qui s'exécute avant que la requête n'atteigne le serveur Next.js.

### 1.1 Pourquoi edge

| Critère | Edge (Vercel/CF) | Server Node.js |
|---|---|---|
| Latence | < 20 ms (POP proche) | ~ 100-300 ms (cold start) |
| Scaling | Auto, infini | Limité |
| Cache CDN | Compatible immédiat | Plus complexe |
| Code | Subset JS/TS (Web API only) | Full Node.js |
| Coût | Très bas | Plus cher |

→ Le resolver i18n est purement déterministe (lecture headers + cookies) et n'a besoin d'aucune lib Node-only. **Idéal pour l'edge**.

### 1.2 Position dans la stack

```
[Visiteur] → DNS → [Vercel Edge POP]
                     │
                     ▼
              [Middleware edge]   ← LOCALE RESOLVER
                     │
                     ▼
              [Cache CDN check]
                     │
                     ▼
              [Origin Vercel Function]
                     │
                     ▼
              [Page RSC + getMessages]
                     │
                     ▼
              [HTML stream]
```

## 2. Algorithme de résolution complet

### 2.1 Diagramme

```
┌─────────────────────────────────────────────────────────────┐
│ Incoming request: GET https://femiglow.ma/<path>             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 0 — Static file or excluded route?                      │
│   /api/*, /_next/*, /favicon.ico, /og/*.jpg, /sitemap.xml    │
└────────────────────┬────────────────────────────────────────┘
        Yes ─────────┤ Bypass middleware → serve as-is
        No  │         │
            ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 1 — Path contains valid locale prefix?                  │
│   /fr/path, /ar/path, /en/path                              │
└────────────────────┬────────────────────────────────────────┘
        Yes ─────────┤ Use path locale → SetHeader x-locale →
                     │   Continue to origin
        No  │         │
            ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2 — Locale in admin/api scope?                          │
│   /admin/*, /api/* → not localized                          │
└────────────────────┬────────────────────────────────────────┘
        Yes ─────────┤ Continue to origin (no redirect)
        No  │         │
            ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3 — Cookie NEXT_LOCALE present and valid?               │
└────────────────────┬────────────────────────────────────────┘
        Yes ─────────┤ Use cookie → Redirect 307 to /[cookie]/path
        No  │         │
            ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 4 — Accept-Language header                              │
│   Parse, match best supported locale                         │
└────────────────────┬────────────────────────────────────────┘
        Match ───────┤ Use header → Redirect 307 → SetCookie
        No  │         │
            ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 5 — IP geolocation (optional, V2)                       │
│   MA → fr, SA → ar, US → en                                 │
└────────────────────┬────────────────────────────────────────┘
        Match ───────┤ Use geo → Redirect 307 → SetCookie
        No  │         │
            ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 6 — Default locale: fr                                  │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼ Redirect 307 to /fr/<path> → SetCookie
                    END
```

### 2.2 Décisions clés

| Décision | Choix V1 | Justification |
|---|---|---|
| Codes de redirect | 307 (Temporary) | Préserve la méthode HTTP, permet de tester sans risque SEO. Passer en 301 (Permanent) après stabilisation. |
| Cookie name | `NEXT_LOCALE` | Convention next-intl + Next.js |
| Cookie persistence | 1 an | Bonne durée pour persister la préférence |
| Cookie SameSite | `lax` | Permet la navigation depuis Google, GitHub, etc. |
| Cookie Secure | `true` en prod | HTTPS obligatoire en prod |
| Cookie httpOnly | `false` | Lisible côté client pour switcher UI |
| Skip step 5 (geo) en V1 | Oui | Latence + non requis (Accept-Language est suffisant) |

## 3. Implémentation `middleware.ts`

### 3.1 Configuration de base avec next-intl

```ts
// apps/web/middleware.ts
import createMiddleware from 'next-intl/middleware';
import { LOCALES, DEFAULT_LOCALE } from '@/i18n.config';

export default createMiddleware({
  // Liste des locales supportées
  locales: LOCALES,

  // Locale par défaut
  defaultLocale: DEFAULT_LOCALE,

  // Stratégie de prefix : 'always' = /fr/path, 'as-needed' = / pour default, /ar/ pour autres
  localePrefix: 'always',

  // Active la détection automatique via Accept-Language
  localeDetection: true,

  // Préfère le cookie sur Accept-Language
  // (next-intl le fait par défaut)
});

export const config = {
  // Matcher exclut les routes non-localisées
  matcher: [
    // Match all except :
    // - /api/*
    // - /admin/*
    // - /_next/*
    // - /_vercel/*
    // - Files with extensions (.png, .jpg, .css, ...)
    '/((?!api|admin|_next|_vercel|.*\\..*).*)',
  ],
};
```

### 3.2 Custom middleware (pour cas avancés)

Si besoin de logique custom (audit log, geo, A/B test sur le resolver) :

```ts
// apps/web/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { LOCALES, DEFAULT_LOCALE } from '@/i18n.config';

const intlMiddleware = createMiddleware({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
  localeDetection: true,
});

export default async function middleware(req: NextRequest) {
  const start = Date.now();

  // 1. Bypass certains paths
  const path = req.nextUrl.pathname;
  if (shouldBypass(path)) {
    return NextResponse.next();
  }

  // 2. Custom geo detection (V2) — fallback si Accept-Language manque
  const acceptLanguage = req.headers.get('accept-language');
  if (!acceptLanguage || acceptLanguage === '*/*') {
    const country = req.geo?.country;
    if (country) {
      const geoLocale = mapCountryToLocale(country);
      if (geoLocale) {
        // Inject header Accept-Language synthétique pour aiguiller next-intl
        const headers = new Headers(req.headers);
        headers.set('accept-language', `${geoLocale};q=0.9, fr;q=0.5`);
        const newReq = new NextRequest(req.url, { headers, ...req });
        const response = intlMiddleware(newReq);
        response.headers.set('x-locale-source', 'geo');
        response.headers.set('x-locale-resolver-ms', String(Date.now() - start));
        return response;
      }
    }
  }

  // 3. Standard next-intl resolution
  const response = intlMiddleware(req);

  // 4. Annotations debug (utiles en dev)
  response.headers.set('x-locale-resolver-ms', String(Date.now() - start));

  // 5. Audit log (sampled 1%)
  if (Math.random() < 0.01) {
    // edge-safe logger (e.g., Axiom / Logflare)
    await edgeLog({
      type: 'locale_resolved',
      path,
      country: req.geo?.country,
      acceptLanguage,
      cookie: req.cookies.get('NEXT_LOCALE')?.value,
      duration_ms: Date.now() - start,
    });
  }

  return response;
}

function shouldBypass(path: string): boolean {
  return (
    path.startsWith('/api/') ||
    path.startsWith('/admin/') ||
    path.startsWith('/_next/') ||
    path.startsWith('/_vercel/') ||
    /\.[a-z0-9]+$/i.test(path) // fichier avec extension
  );
}

const COUNTRY_TO_LOCALE: Record<string, string> = {
  // Maghreb francophone
  MA: 'fr',
  DZ: 'fr',
  TN: 'fr',
  // Europe francophone
  FR: 'fr',
  BE: 'fr',
  CH: 'fr',
  LU: 'fr',
  // Pays arabophones
  SA: 'ar',
  AE: 'ar',
  EG: 'ar',
  QA: 'ar',
  KW: 'ar',
  BH: 'ar',
  OM: 'ar',
  JO: 'ar',
  LB: 'ar',
  // Anglophones
  US: 'en',
  GB: 'en',
  CA: 'en',
  AU: 'en',
  NZ: 'en',
  IE: 'en',
};

function mapCountryToLocale(country: string): string | null {
  return COUNTRY_TO_LOCALE[country] ?? null;
}

export const config = {
  matcher: ['/((?!api|admin|_next|_vercel|.*\\..*).*)'],
};
```

### 3.3 Configuration `i18n.config.ts`

```ts
// apps/web/src/i18n.config.ts
export const LOCALES = ['fr', 'ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'fr';

export const LOCALE_LABELS: Record<Locale, string> = {
  fr: 'Français',
  ar: 'العربية',
  en: 'English',
};

export const LOCALE_DIRECTIONS: Record<Locale, 'ltr' | 'rtl'> = {
  fr: 'ltr',
  ar: 'rtl',
  en: 'ltr',
};

export const LOCALE_FALLBACKS: Record<Locale, Locale | null> = {
  fr: null,
  ar: 'fr',
  en: 'fr',
};
```

## 4. Parsing Accept-Language

### 4.1 Format BCP-47

L'entête HTTP `Accept-Language` ressemble à :
```
Accept-Language: ar-MA, ar;q=0.9, fr-FR;q=0.8, fr;q=0.7, en;q=0.5
```

Format générique : `<locale-tag>;q=<quality>`. La quality va de 0 à 1 (1 par défaut si absent).

### 4.2 Algorithme de matching (implementation de référence)

next-intl fait ça en interne. Pour comprendre / customiser :

```ts
// apps/web/src/lib/i18n/match-locale.ts
interface ParsedLocale {
  locale: string;
  quality: number;
}

export function parseAcceptLanguage(header: string): ParsedLocale[] {
  return header
    .split(',')
    .map((part) => {
      const [tag, ...directives] = part.trim().split(';');
      const qDirective = directives.find((d) => d.trim().startsWith('q='));
      const quality = qDirective ? parseFloat(qDirective.split('=')[1]) : 1.0;
      return { locale: tag.trim().toLowerCase(), quality };
    })
    .filter((p) => p.locale && !isNaN(p.quality) && p.quality > 0)
    .sort((a, b) => b.quality - a.quality);
}

export function matchLocale(
  acceptLanguage: string | null | undefined,
  supportedLocales: readonly string[],
  defaultLocale: string,
): string {
  if (!acceptLanguage) return defaultLocale;

  const parsed = parseAcceptLanguage(acceptLanguage);
  const supported = new Set(supportedLocales.map((l) => l.toLowerCase()));

  // 1. Exact match (ar-MA → ar-MA si supporté)
  for (const p of parsed) {
    if (supported.has(p.locale)) return p.locale;
  }

  // 2. Base language match (ar-MA → ar)
  for (const p of parsed) {
    const base = p.locale.split('-')[0];
    if (supported.has(base)) return base;
  }

  // 3. Fallback
  return defaultLocale;
}
```

### 4.3 Tests unitaires

```ts
// apps/web/src/lib/i18n/match-locale.test.ts
import { describe, it, expect } from 'vitest';
import { matchLocale, parseAcceptLanguage } from './match-locale';

describe('parseAcceptLanguage', () => {
  it('parses standard header', () => {
    expect(parseAcceptLanguage('ar-MA, ar;q=0.9, fr;q=0.8')).toEqual([
      { locale: 'ar-ma', quality: 1.0 },
      { locale: 'ar', quality: 0.9 },
      { locale: 'fr', quality: 0.8 },
    ]);
  });

  it('sorts by quality descending', () => {
    expect(parseAcceptLanguage('en;q=0.5, fr;q=0.9, ar')).toEqual([
      { locale: 'ar', quality: 1.0 },
      { locale: 'fr', quality: 0.9 },
      { locale: 'en', quality: 0.5 },
    ]);
  });

  it('ignores q=0 entries', () => {
    expect(parseAcceptLanguage('fr;q=0, en')).toEqual([{ locale: 'en', quality: 1.0 }]);
  });
});

describe('matchLocale', () => {
  const supported = ['fr', 'ar', 'en'];

  it('exact match wins', () => {
    expect(matchLocale('en', supported, 'fr')).toBe('en');
  });

  it('base language match for region tags', () => {
    expect(matchLocale('ar-MA', supported, 'fr')).toBe('ar');
    expect(matchLocale('en-US', supported, 'fr')).toBe('en');
  });

  it('returns default if no match', () => {
    expect(matchLocale('zh-CN', supported, 'fr')).toBe('fr');
  });

  it('returns default if no Accept-Language', () => {
    expect(matchLocale(null, supported, 'fr')).toBe('fr');
    expect(matchLocale(undefined, supported, 'fr')).toBe('fr');
    expect(matchLocale('', supported, 'fr')).toBe('fr');
  });

  it('respects quality order', () => {
    expect(matchLocale('en;q=0.5, ar;q=0.9, fr;q=0.7', supported, 'fr')).toBe('ar');
  });
});
```

## 5. Edge cases

### 5.1 Bot / crawler

Bots envoient souvent `Accept-Language: */*` ou rien :

```ts
// Détection bot via User-Agent
function isBot(userAgent: string | null): boolean {
  if (!userAgent) return false;
  const botPatterns = /googlebot|bingbot|yandex|baiduspider|duckduckbot|facebookexternalhit|twitterbot/i;
  return botPatterns.test(userAgent);
}

// Dans le middleware
if (isBot(req.headers.get('user-agent'))) {
  // Si le path n'a pas de locale, redirect vers default
  if (!hasLocalePrefix(path)) {
    return NextResponse.redirect(new URL(`/${DEFAULT_LOCALE}${path}`, req.url), 301);
  }
  // Sinon, laisser le path tel quel (bot crawl /ar/ explicitement)
  return NextResponse.next();
}
```

→ Pour les bots, on utilise 301 (permanent) au lieu de 307, car Google traite mieux les redirects permanents.

### 5.2 Missing locale parameter

Si le path ressemble à `/xx/kit` avec `xx` invalide :

```ts
// next-intl middleware le gère : si locale invalide, fallback sur defaultLocale
// Pour custom : afficher 404
import { notFound } from 'next/navigation';

// apps/web/src/app/[locale]/layout.tsx
import { LOCALES } from '@/i18n.config';

export default async function LocaleLayout({ params: { locale } }) {
  if (!LOCALES.includes(locale as any)) {
    notFound();
  }
  // ...
}
```

### 5.3 URL avec query params

Si user va à `/kit?utm_source=newsletter`, on doit préserver les query lors du redirect :

```ts
// next-intl le fait correctement par défaut
// /kit?utm_source=newsletter → /fr/kit?utm_source=newsletter
```

### 5.4 URL avec fragment (#)

Les fragments sont gérés côté client, pas envoyés au serveur. Pas de souci.

### 5.5 Cookie corrompu

Si `NEXT_LOCALE=xxx` (valeur invalide) :

```ts
// next-intl ignore le cookie invalide et passe au next step (Accept-Language)
// Custom : on peut clear le cookie corrompu
const cookieLocale = req.cookies.get('NEXT_LOCALE')?.value;
if (cookieLocale && !LOCALES.includes(cookieLocale as any)) {
  // Clear cookie
  const response = NextResponse.next();
  response.cookies.delete('NEXT_LOCALE');
  return response;
}
```

### 5.6 Concurrent locale switch

Si un user fait 2 clics rapides sur le switcher :

```
Click 1: /fr/kit → POST /api/i18n/locale/switch {locale:'ar'} → cookie set ar → redirect /ar/kit
Click 2 (avant render): /fr/kit → POST {locale:'en'} → cookie set en → redirect /en/kit
```

Cookie final = `en`, page rendue en `/en/kit`. Comportement attendu, pas de bug.

### 5.7 Cross-domain

Si on a `femiglow.ma` et `femiglow.fr` séparés :

```
Visiteur sur .ma avec cookie NEXT_LOCALE=ar
  → ne sera PAS hérité sur .fr (cookies sont scoped au domaine)
```

→ V1 : un seul domaine `femiglow.ma`. V2 si multi-domaine : utiliser localStorage + JS pour partager via paramètre URL au cross-domain.

### 5.8 SPA-like navigation

Avec Next.js App Router, la navigation interne via `<Link>` ne déclenche pas le middleware (c'est une navigation côté client). Le `useRouter().replace(path, {locale})` de next-intl s'en charge :

```tsx
const router = useRouter();
const pathname = usePathname();
router.replace(pathname, { locale: 'ar' });
// → navigation client + URL change → /ar/kit
```

## 6. Custom resolver (alternative à next-intl middleware)

Si le besoin dépasse ce que next-intl offre out-of-the-box :

### 6.1 Resolver function isolée

```ts
// apps/web/src/lib/i18n/resolver.ts
import { matchLocale } from './match-locale';
import { LOCALES, DEFAULT_LOCALE, type Locale } from '@/i18n.config';

interface ResolveContext {
  pathname: string;
  cookies: Map<string, string>;
  acceptLanguage: string | null;
  geoCountry: string | null;
  userAgent: string | null;
}

interface ResolveResult {
  locale: Locale;
  source: 'path' | 'cookie' | 'header' | 'geo' | 'default';
  shouldRedirect: boolean;
  redirectUrl?: string;
}

export function resolveLocale(ctx: ResolveContext): ResolveResult {
  // Step 1 — Path
  const pathMatch = ctx.pathname.match(/^\/([a-z]{2})(\/|$)/);
  if (pathMatch && LOCALES.includes(pathMatch[1] as Locale)) {
    return {
      locale: pathMatch[1] as Locale,
      source: 'path',
      shouldRedirect: false,
    };
  }

  // Step 2 — Cookie
  const cookieLocale = ctx.cookies.get('NEXT_LOCALE');
  if (cookieLocale && LOCALES.includes(cookieLocale as Locale)) {
    return {
      locale: cookieLocale as Locale,
      source: 'cookie',
      shouldRedirect: true,
      redirectUrl: `/${cookieLocale}${ctx.pathname}`,
    };
  }

  // Step 3 — Accept-Language
  if (ctx.acceptLanguage && ctx.acceptLanguage !== '*/*') {
    const matched = matchLocale(ctx.acceptLanguage, LOCALES, DEFAULT_LOCALE);
    if (matched !== DEFAULT_LOCALE || LOCALES.includes(matched as Locale)) {
      return {
        locale: matched as Locale,
        source: 'header',
        shouldRedirect: true,
        redirectUrl: `/${matched}${ctx.pathname}`,
      };
    }
  }

  // Step 4 — Geo (V2)
  if (ctx.geoCountry) {
    const geoLocale = countryToLocale(ctx.geoCountry);
    if (geoLocale) {
      return {
        locale: geoLocale,
        source: 'geo',
        shouldRedirect: true,
        redirectUrl: `/${geoLocale}${ctx.pathname}`,
      };
    }
  }

  // Step 5 — Default
  return {
    locale: DEFAULT_LOCALE,
    source: 'default',
    shouldRedirect: true,
    redirectUrl: `/${DEFAULT_LOCALE}${ctx.pathname}`,
  };
}
```

### 6.2 Usage dans middleware

```ts
import { resolveLocale } from '@/lib/i18n/resolver';

export default function middleware(req: NextRequest) {
  const result = resolveLocale({
    pathname: req.nextUrl.pathname,
    cookies: new Map(req.cookies.getAll().map((c) => [c.name, c.value])),
    acceptLanguage: req.headers.get('accept-language'),
    geoCountry: req.geo?.country ?? null,
    userAgent: req.headers.get('user-agent'),
  });

  if (result.shouldRedirect) {
    const url = new URL(result.redirectUrl!, req.url);
    // preserve query string
    url.search = req.nextUrl.search;
    const response = NextResponse.redirect(url, 307);
    response.cookies.set('NEXT_LOCALE', result.locale, {
      maxAge: 60 * 60 * 24 * 365,
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });
    response.headers.set('x-locale-source', result.source);
    return response;
  }

  // Pas de redirect : le path contient déjà la locale
  const response = NextResponse.next();
  response.headers.set('x-locale', result.locale);
  return response;
}
```

### 6.3 Avantages du custom resolver

- Plus de contrôle (logging, sampling, A/B)
- Geo detection sans dépendre de next-intl
- Custom logic pour bots / crawlers
- Test unitaire facile (resolver est une fonction pure)

### 6.4 Inconvénients

- Plus de code à maintenir
- Risque de divergence avec ce que next-intl fait côté server (page render)
- Doit re-synchroniser quand next-intl publie une nouvelle version

→ **Recommandation V1** : utiliser `createMiddleware` de next-intl. Considérer custom resolver V2 si besoin spécifique.

## 7. Performance edge runtime

### 7.1 Contraintes edge

| Contrainte | Limite Vercel Edge |
|---|---|
| Mémoire | 128 MB |
| CPU | < 50ms par request (target) |
| Bundle size | < 1 MB |
| Lib Node | Subset (pas de `fs`, `crypto.createHash` ok) |
| Dépendances | Doivent supporter Web API |

### 7.2 Optimisations

1. **Pas de lookup DB dans le middleware** : le middleware doit être stateless et rapide
2. **Pas de fetch externe** : pas d'appel à `/api/...` depuis le middleware
3. **Pas de parsing JSON lourd** : éviter de charger les messages dans le middleware
4. **Pas de regex complexe** : utiliser des matchers simples

### 7.3 Benchmarks attendus

| Métrique | Cible | Mesure (estimation) |
|---|---|---|
| Middleware overhead | < 15 ms | ~ 5-10 ms |
| Bundle middleware | < 100 KB | ~ 30-50 KB |
| Allocations mémoire | < 1 MB | < 500 KB |
| Cold start | < 50 ms | ~ 20-30 ms (Vercel edge) |

### 7.4 Mesure en prod

```ts
// Dans le middleware
const start = performance.now();
const response = intlMiddleware(req);
response.headers.set('Server-Timing', `i18n-resolver;dur=${performance.now() - start}`);
return response;
```

Browser DevTools → Network → Server-Timing → voir `i18n-resolver;dur=5.2`

## 8. Logging et observabilité

### 8.1 Events à logger

| Event | Sample rate | Stockage |
|---|---|---|
| `locale.resolved` | 1% (random) | Axiom / Logflare |
| `locale.redirect` | 100% (si redirect) | Axiom |
| `locale.cookie.invalid` | 100% (rare) | Sentry |
| `locale.bot.detected` | 1% | Axiom |

### 8.2 Schema log

```ts
interface LocaleResolvedEvent {
  type: 'locale_resolved';
  path: string;
  resolved_locale: Locale;
  source: 'path' | 'cookie' | 'header' | 'geo' | 'default';
  redirected: boolean;
  duration_ms: number;
  country?: string;
  user_agent_class?: 'browser' | 'bot' | 'unknown';
  timestamp: string;
}
```

### 8.3 Dashboards Vercel / Axiom

- % de requests par source de locale
- Top pays → locale assignée
- Latence p50/p95/p99 du middleware
- Taux d'erreur middleware

## 9. Cas spécifiques FemiGlow

### 9.1 Visiteur Maroc avec navigateur AR

```
GET /
Accept-Language: ar-MA, ar;q=0.9, fr;q=0.7
Cookie: (vide)
Geo.country: MA

→ Step 1 : path = '/' → pas de locale
→ Step 2 : pas admin/api
→ Step 3 : pas de cookie
→ Step 4 : Accept-Language → match 'ar' (base lang)
→ Redirect 307 /ar/
→ SetCookie NEXT_LOCALE=ar
```

### 9.2 Visiteur Maroc avec navigateur FR

```
GET /kit
Accept-Language: fr-FR, fr;q=0.9, en;q=0.7
Cookie: (vide)
Geo.country: MA

→ Step 4 : Accept-Language → match 'fr'
→ Redirect 307 /fr/kit
→ SetCookie NEXT_LOCALE=fr
```

### 9.3 Visiteur USA

```
GET /
Accept-Language: en-US, en;q=0.9
Cookie: (vide)
Geo.country: US

→ Step 4 : match 'en'
→ Redirect 307 /en/
```

### 9.4 Visiteur Chinese (zh-CN)

```
GET /
Accept-Language: zh-CN, zh;q=0.9
Cookie: (vide)
Geo.country: CN

→ Step 4 : pas de match (zh non supporté)
→ Step 5 (V1 skip)
→ Step 6 : default 'fr'
→ Redirect 307 /fr/
```

UX médiocre mais V1 acceptable. V2 : afficher banner "We don't speak Chinese yet" ou activer Crowdin/DeepL on-demand.

### 9.5 Visiteur déjà sur /ar/kit avec cookie FR

```
GET /ar/kit
Cookie: NEXT_LOCALE=fr

→ Step 1 : path 'ar' → match
→ Pas de redirect, on respecte le path
→ Render /ar/kit
→ Garder cookie 'fr' (l'utilisateur a explicitement cliqué sur AR via lien)

Optionnel : afficher banner "Cette page est en arabe alors que vous préférez le français.
Continuer en arabe ou passer en français ?"
```

### 9.6 Bot Googlebot crawl /ar/kit

```
GET /ar/kit
User-Agent: Googlebot/2.1
Accept-Language: */*

→ Step 0 : pas bypass (path normal)
→ isBot=true
→ Step 1 : path 'ar' → match
→ Render /ar/kit (200, pas de redirect)
→ Pas de SetCookie (bot)
```

## 10. Anti-patterns

1. **Faire un fetch DB dans le middleware** : bloque l'edge, casse la perf. Garder le middleware stateless.

2. **Detecter le locale dans la page (RSC) au lieu du middleware** : empêche le cache CDN par locale, double le travail.

3. **Utiliser 301 dès le V1** : un mauvais redirect 301 est gravé dans les caches navigateur 1 an. Utiliser 307 en V1, bumper en 301 après stabilisation.

4. **Cookie HttpOnly=true** : empêche le switcher client de lire la locale courante. Garder `httpOnly=false`.

5. **Matcher trop large** : `matcher: '/((?!api).*)'` matche aussi les images → middleware exécuté inutilement. Toujours exclure les fichiers avec extension.

6. **Pas de `localeDetection: true`** : sans ça, next-intl ne fait pas la résolution Accept-Language. Très facile à oublier.

7. **`localePrefix: 'as-needed'`** : pour FR par défaut, donne `/kit` au lieu de `/fr/kit`. Casse la cohérence hreflang. Utiliser `'always'`.

8. **Logger 100% des requests** : explose les coûts log. Sampler à 1-5%.

9. **Faire l'audit log dans le middleware avec `await`** : bloque la response. Utiliser `event.waitUntil()` :
   ```ts
   import { NextResponse } from 'next/server';
   import { unstable_after as after } from 'next/server';

   after(async () => {
     await edgeLog({ ... });
   });
   return response;
   ```

## 11. Failure modes et recovery

### 11.1 Middleware crash

Si le middleware throw, Next.js retourne 500. Comportement par défaut OK, mais on peut wrap :

```ts
export default async function middleware(req: NextRequest) {
  try {
    return await safeResolve(req);
  } catch (error) {
    console.error('[middleware] crash', error);
    // Fallback : laisser passer la request sans i18n
    return NextResponse.next();
  }
}
```

→ Mieux qu'un 500. La page peut être servie sans locale (le layout fera fallback FR).

### 11.2 Cookie qui ne s'écrit pas

Si le browser refuse les cookies (mode incognito strict ou ITP) :

→ Chaque visite re-lance la résolution Accept-Language. Pas optimal mais fonctionne.

### 11.3 Vercel edge down

Si Vercel edge a un incident, le middleware ne s'exécute pas. Next.js essayera de servir la page directement.

→ Sans middleware, `/` n'aura pas de locale → 404 ou affichage default layout. Mauvais.

**Mitigation** : avoir un fallback static `/index.html` qui redirect côté client via JS si pas de locale détectée :
```html
<script>
  const locale = navigator.language.split('-')[0];
  const target = ['fr','ar','en'].includes(locale) ? locale : 'fr';
  window.location.replace('/' + target + '/');
</script>
```

## 12. Checklist à tester / à vérifier

### Configuration
- [ ] `middleware.ts` utilise `createMiddleware` de next-intl
- [ ] `LOCALES = ['fr', 'ar', 'en']` dans `i18n.config.ts`
- [ ] `localePrefix: 'always'`
- [ ] `localeDetection: true`
- [ ] `matcher` exclut `/api`, `/admin`, `/_next`, `/_vercel`, fichiers avec extension

### Comportement
- [ ] GET `/` avec cookie FR → 307 `/fr/`
- [ ] GET `/` avec cookie AR → 307 `/ar/`
- [ ] GET `/` sans cookie + `Accept-Language: ar-MA` → 307 `/ar/`
- [ ] GET `/` sans cookie + `Accept-Language: en-US` → 307 `/en/`
- [ ] GET `/` sans cookie + `Accept-Language: zh-CN` → 307 `/fr/` (default)
- [ ] GET `/fr/kit` → 200 (pas de redirect)
- [ ] GET `/ar/kit` → 200
- [ ] GET `/xx/kit` → 404 ou redirect vers `/fr/kit`
- [ ] GET `/admin/users` → 200 (pas affecté par middleware)
- [ ] GET `/api/auth/session` → 200 (pas affecté)
- [ ] GET `/sitemap.xml` → 200 (bypass middleware)
- [ ] GET `/favicon.ico` → 200 (bypass)

### Cookie
- [ ] Redirect pose `Set-Cookie: NEXT_LOCALE=...`
- [ ] Cookie `Max-Age=31536000`, `Path=/`, `SameSite=Lax`
- [ ] Cookie `Secure` en prod
- [ ] Cookie pas `HttpOnly`

### Query params
- [ ] GET `/?utm_source=fb` → 307 `/fr/?utm_source=fb` (préservé)
- [ ] GET `/kit?foo=bar` → 307 `/fr/kit?foo=bar`

### Performance
- [ ] Middleware latency p50 < 10 ms (Server-Timing header)
- [ ] Middleware latency p99 < 30 ms
- [ ] Bundle middleware < 100 KB (vérifier `next build`)

### Edge cases
- [ ] Cookie corrompu (`NEXT_LOCALE=xxx`) → fallback Accept-Language
- [ ] Pas d'Accept-Language + cookie absent → default FR
- [ ] Bot Googlebot → pas de redirect inutile sur /ar/
- [ ] Concurrent switch → cookie final cohérent

### Observabilité
- [ ] Header `x-locale-source` présent en dev
- [ ] Logs Axiom reçoivent les events `locale_resolved`
- [ ] Dashboard montre la distribution des locales

## 13. Références croisées

- Algorithme : [`02-design-conception/locale-detection.md`](../02-design-conception/locale-detection.md)
- URL strategy : [`02-design-conception/url-strategy.md`](../02-design-conception/url-strategy.md)
- Translation store : [`./translation-store.md`](./translation-store.md)
- RSC patterns : [`./server-rendering.md`](./server-rendering.md)
- Tests middleware : [`07-tests/middleware-tests.md`](../07-tests/middleware-tests.md)
- Monitoring : [`10-monitoring/locale-detection-analytics.md`](../10-monitoring/locale-detection-analytics.md)
