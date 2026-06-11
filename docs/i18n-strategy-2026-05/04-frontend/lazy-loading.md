# Lazy loading & bundle splitting

> Comment ne charger que les traductions de la locale courante (au lieu des 3) et préserver les budgets Lighthouse. Stratégies dynamic import, chunking, SSR vs CSR.

## 1. Pourquoi pas tout précharger

### 1.1 Coût naïf

Sans optimisation :
```ts
// MAUVAIS
import frMessages from '@/messages/fr.json';
import arMessages from '@/messages/ar.json';
import enMessages from '@/messages/en.json';

const messages = { fr: frMessages, ar: arMessages, en: enMessages };
```

→ Chaque page envoie **les 3 messages bundle** au client. Pour 600 strings × 3 locales = bundle JS gonflé inutilement.

Estimation FemiGlow V1 :
- `messages/fr.json` ≈ 40 KB (raw), ≈ 12 KB gzipped
- × 3 locales = 36 KB gzipped pour rien si user reste en FR

### 1.2 Coût Lighthouse

Plus de JS = plus de **parse + execute time**, surtout sur mobile bas de gamme (FemiGlow cible Maroc, devices variés).

Budget Lighthouse FemiGlow (cf. `lighthouserc.json`) :
- LCP < 2.5s
- FCP < 1.8s
- TBT < 200ms
- Bundle JS initial < 200 KB gzipped

→ Précharger 3 locales = ~10% du budget brûlé en pure perte.

### 1.3 Solution

Charger seulement la locale active du request, via dynamic `import()`.

## 2. Stratégie `next-intl`

### 2.1 Configuration de base

```ts
// src/i18n.ts
import { getRequestConfig } from 'next-intl/server';
import { LOCALES, DEFAULT_LOCALE } from '@/lib/i18n/config';

export default getRequestConfig(async ({ locale }) => {
  if (!LOCALES.includes(locale as never)) {
    locale = DEFAULT_LOCALE;
  }
  return {
    messages: (await import(`@/messages/${locale}.json`)).default,
    timeZone: 'Africa/Casablanca',
  };
});
```

Le `import(\`@/messages/${locale}.json\`)` est **dynamique** : Webpack crée 3 chunks séparés (un par locale), et seul le chunk de la locale courante est servi.

### 2.2 Vérification chunking

Après build :
```
$ pnpm build
...
chunks/
  ├── messages-fr-abc123.js  (12 KB gzip)
  ├── messages-ar-def456.js  (14 KB gzip)
  └── messages-en-ghi789.js  (10 KB gzip)
```

Un user qui visite `/fr/kit` ne télécharge **que** `messages-fr-abc123.js`. Économie ~22 KB gzipped vs précharger les 3.

### 2.3 Webpack config explicite (rare)

Si on veut nommer les chunks pour debug :

```ts
const messages = (await import(
  /* webpackChunkName: "messages-[request]" */
  `@/messages/${locale}.json`
)).default;
```

Pas nécessaire avec next-intl par défaut, mais utile pour analyse de bundle (`@next/bundle-analyzer`).

## 3. Chargement SSR vs CSR

### 3.1 RSC (Server Components)

`getMessages()` côté serveur charge le JSON depuis le filesystem (zero coût client) :

```tsx
// app/[locale]/layout.tsx
import { getMessages } from 'next-intl/server';

export default async function LocaleLayout({ children, params: { locale } }) {
  const messages = await getMessages(); // file read serveur
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

→ Pour les composants RSC, les strings sont rendus dans le HTML serveur. **Zero JS lié à i18n** envoyé au client.

### 3.2 Client Components

`<NextIntlClientProvider messages>` sérialise les messages dans le HTML payload (sous `<script>` next), puis hydrate le contexte côté client.

```html
<!-- HTML envoyé au browser -->
<script id="__NEXT_DATA__" type="application/json">
  { "messages": { "common": {...}, "marketing": {...} } }
</script>
```

Taille ≈ taille du JSON (12-14 KB gzipped). C'est **inévitable** pour que les Client Components puissent appeler `useTranslations`.

### 3.3 Réduire le payload Client

Si on a 40 KB de messages mais qu'une page n'utilise que `marketing.kit.*`, on peut filtrer :

```tsx
import { NextIntlClientProvider, useMessages } from 'next-intl';
import pick from 'lodash/pick';

export default function KitPage() {
  const messages = useMessages();
  return (
    <NextIntlClientProvider messages={pick(messages, ['marketing.kit', 'common'])}>
      <KitClientIsland />
    </NextIntlClientProvider>
  );
}
```

→ Payload Client réduit à ~3-5 KB.

**Trade-off** : double Provider (layout global + page local). Acceptable si page lourde (kit a beaucoup de strings).

## 4. Préload de la locale critique

### 4.1 `<link rel="preload">` pour le chunk locale

next-intl ne le fait pas automatiquement (le chunk est chargé dans le code path RSC, pas en client). Mais on peut hint le browser pour le `_next/data` JSON :

```tsx
// app/[locale]/layout.tsx
export default async function LocaleLayout({ params: { locale }, children }) {
  return (
    <html lang={locale}>
      <head>
        <link
          rel="preload"
          href={`/_next/static/chunks/messages-${locale}.json`}
          as="fetch"
          crossOrigin="anonymous"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

À ajuster selon le path réel généré par Next.js (vérifier via `next build` output).

### 4.2 Préchargement des locales adjacentes

Si on sait que l'user va probablement switcher (ex: stats Mixpanel montrent que 20% des users FR essaient AR), on peut prefetch :

```tsx
'use client';
import { useEffect } from 'react';
import { useLocale } from 'next-intl';

export function PrefetchOtherLocales() {
  const currentLocale = useLocale();
  useEffect(() => {
    const others = ['fr', 'ar', 'en'].filter((l) => l !== currentLocale);
    others.forEach((locale) => {
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = `/_next/static/chunks/messages-${locale}.json`;
      link.as = 'fetch';
      document.head.appendChild(link);
    });
  }, [currentLocale]);
  return null;
}
```

À utiliser seulement si data justifie (sinon on gaspille la bande passante).

### 4.3 Idle prefetch

Plus subtil : prefetch quand le browser est idle :

```ts
useEffect(() => {
  const handle = window.requestIdleCallback?.(() => {
    // prefetch ici
  });
  return () => window.cancelIdleCallback?.(handle);
}, []);
```

## 5. Split par route — namespace ciblé

### 5.1 Pourquoi

Une page marketing simple (`/kit`) n'a pas besoin des messages du wizard checkout, ni de l'admin, ni du chat.

### 5.2 Pattern — fichiers messages par feature

Option A : un seul `messages/fr.json` (recommandé V1, simple).

Option B : fichiers par feature (V2 si bundle devient gros) :
```
messages/
├── common/fr.json
├── marketing/fr.json
├── wizard/fr.json
└── admin/fr.json
```

Chargement sélectif :
```ts
const baseMessages = await import('@/messages/common/fr.json');
const pageMessages = await import('@/messages/marketing/fr.json');
const messages = { ...baseMessages.default, ...pageMessages.default };
```

Coût : maintenance plus complexe pour traducteurs (Crowdin doit gérer plusieurs fichiers). **À éviter en V1**, à considérer en V2 si messages dépassent 100 KB.

### 5.3 Décision FemiGlow

- **V1** : un seul `messages/[locale].json` par locale. ~40 KB chacun.
- **V2** : si bundle > 80 KB, split par namespace top-level (`common`, `marketing`, `wizard`, `legal`, `email`).

## 6. Cache et CDN

### 6.1 Cache headers JSON

Les chunks messages sont des fichiers static Next.js, servis avec hash dans le nom :
```
/_next/static/chunks/messages-fr-abc123.js
```

→ Cache-Control: `public, max-age=31536000, immutable` (1 an). Renouvellement uniquement quand le hash change (i.e. quand le contenu change).

### 6.2 Cache CDN

Vercel CDN cache automatiquement ces chunks. Pour Cloudflare ou autre, vérifier :
```
Cache-Control: public, immutable, max-age=31536000
```

### 6.3 Cache busting

Quand on update `messages/fr.json` :
- Next.js regenère un nouveau hash
- Le HTML servi pointe vers le nouveau chunk
- L'ancien chunk reste accessible (URL hashed) mais plus référencé
- CDN purge automatique selon TTL (1 an, donc nettoyage lent)

## 7. Mesures et budgets Lighthouse

### 7.1 Budget cible FemiGlow

| Métrique | Mobile Cible | Desktop Cible |
|---|---|---|
| LCP | < 2.5s | < 1.5s |
| FCP | < 1.8s | < 1s |
| TBT | < 200ms | < 100ms |
| CLS | < 0.1 | < 0.1 |
| Bundle JS initial gzipped | < 200 KB | < 200 KB |
| Bundle messages chunk gzipped | < 15 KB par locale | < 15 KB |

### 7.2 Outils de mesure

```bash
# Lighthouse CI
pnpm exec lhci autorun --config=lighthouserc.json
```

`lighthouserc.json` :
```json
{
  "ci": {
    "collect": {
      "url": [
        "http://localhost:3000/fr/",
        "http://localhost:3000/fr/kit",
        "http://localhost:3000/ar/",
        "http://localhost:3000/ar/kit",
        "http://localhost:3000/en/"
      ],
      "numberOfRuns": 3
    },
    "assert": {
      "preset": "lighthouse:recommended",
      "assertions": {
        "categories:performance": ["error", { "minScore": 0.9 }],
        "categories:accessibility": ["error", { "minScore": 0.95 }],
        "largest-contentful-paint": ["error", { "maxNumericValue": 2500 }],
        "first-contentful-paint": ["error", { "maxNumericValue": 1800 }],
        "total-blocking-time": ["error", { "maxNumericValue": 200 }]
      }
    }
  }
}
```

### 7.3 Analyse de bundle

```bash
# next.config.mjs
import bundleAnalyzer from '@next/bundle-analyzer';
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === 'true' });
export default withBundleAnalyzer(nextConfig);

# Run
ANALYZE=true pnpm build
```

→ Ouvre un treemap dans le navigateur, on voit les chunks messages-XX par locale.

### 7.4 Métriques i18n custom

```ts
// src/lib/i18n/metrics.ts
export function trackLocaleLoadTime(locale: string, ms: number) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('locale-load', { detail: { locale, ms } }));
  // Forward to Mixpanel/Sentry
}

// Dans NextIntlClientProvider wrapper :
const start = performance.now();
// ... messages loaded
trackLocaleLoadTime(locale, performance.now() - start);
```

## 8. Stratégies avancées (V2+)

### 8.1 Stream messages par chunks

Si messages > 50 KB, charger les "common" en SSR + lazy load le reste :

```tsx
const MessagesProvider = dynamic(() => import('./MessagesProvider'), {
  ssr: true,
  loading: () => <div>Chargement…</div>,
});
```

→ Plus complexe, à valider seulement si Lighthouse signale un problème.

### 8.2 Edge runtime middleware

Next.js middleware tourne sur Edge (rapide). Si le middleware lit les messages pour le HTML initial, garder le JSON léger.

next-intl middleware ne lit pas les messages — il fait juste du routing. Donc rien à craindre.

### 8.3 Service worker preload

PWA-style : précharger toutes les locales en arrière-plan via service worker pour offline.

```js
// public/sw.js
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('messages-v1').then((cache) =>
      cache.addAll([
        '/_next/static/chunks/messages-fr.js',
        '/_next/static/chunks/messages-ar.js',
        '/_next/static/chunks/messages-en.js',
      ]),
    ),
  );
});
```

→ Pas en V1 (FemiGlow n'est pas PWA), V2 si demande UX.

## 9. Cas particuliers FemiGlow

### 9.1 Pages CMS dynamiques (composants admin-driven)

Les composants CMS (`component_field_bindings.locale`) ne passent pas par messages.json mais par DB.

→ Pas de problème de chunking : ces strings sont rendues côté serveur dans le HTML directement, zero impact bundle JS.

### 9.2 Pages légales

`legal_pages.body_md` est markdown stocké en DB par locale. Server-rendered.

→ Idem, pas dans le bundle JS.

### 9.3 Wizard checkout

`WizardDictionary` est dans `src/lib/checkout/i18n/locales/[locale].ts`. Importé statiquement dans le bundle wizard.

```ts
// src/lib/checkout/i18n/use-wizard-translation.ts
import { dictionaryFr } from './locales/fr';
import { dictionaryAr } from './locales/ar';

const dictionaries = { fr: dictionaryFr, ar: dictionaryAr };
```

→ Si l'user est en FR, est-ce qu'on charge aussi le AR ? **Oui** car import statique. Coût : ~5-8 KB pour le second dictionary.

**Optimisation V2** : convertir en dynamic import :

```ts
const dictionaries = {
  fr: () => import('./locales/fr').then((m) => m.dictionaryFr),
  ar: () => import('./locales/ar').then((m) => m.dictionaryAr),
};

async function loadDictionary(locale: 'fr' | 'ar') {
  return await dictionaries[locale]();
}
```

→ À mesurer avant : si gain < 5 KB, ne pas complexifier.

### 9.4 Chat widget

`chat_faq_entry.language` etc. en DB. Loaded on-demand quand user ouvre le widget.

→ Pas de coût initial.

## 10. Mesure terrain — exemple chiffré

### 10.1 Avant optimisation (hypothétique naïf)

Page `/fr/kit` :
- HTML : 80 KB
- JS initial : 250 KB gzipped (incluant 36 KB de messages tous loaded)
- Total transfer : 330 KB
- LCP : 2.8s sur 4G médian
- TBT : 280ms

### 10.2 Après optimisation (next-intl + dynamic + RSC)

Page `/fr/kit` :
- HTML : 90 KB (légèrement plus car strings inlinées dans le HTML serveur)
- JS initial : 180 KB gzipped (juste FR messages, ~12 KB)
- Total transfer : 270 KB
- LCP : 2.1s sur 4G médian
- TBT : 150ms

**Gain** : -60 KB transfer, -25% TBT, -25% LCP.

### 10.3 Outils de validation

```bash
# Webpagetest (avant/après)
npx wpt-cli https://femiglow.ma/fr/kit --location Paris_4G --runs 3
```

## 11. Anti-patterns

### 11.1 Import statique de toutes les locales

```ts
// MAUVAIS
import fr from '@/messages/fr.json';
import ar from '@/messages/ar.json';
import en from '@/messages/en.json';
const messages = { fr, ar, en };
```

→ Triple le bundle pour rien.

**Bon** : dynamic `import(\`@/messages/${locale}.json\`)`.

### 11.2 Tout client-side

```tsx
// MAUVAIS
'use client';
export default function KitPage() {
  const t = useTranslations('marketing.kit');
  return <h1>{t('title')}</h1>;
}
```

→ Force toute la page en Client, multiplie le JS hydraté.

**Bon** : page en RSC + isoler les islands Client.

### 11.3 Provider global avec tous les namespaces

```tsx
// MAUVAIS — un Provider qui envoie 100% messages au client même si une page utilise 10%
<NextIntlClientProvider messages={messages}>
```

→ OK en V1 (simplicité), mais à splitter en V2 si bundle JSON > 50 KB serialisé.

### 11.4 Pas de measure Lighthouse en CI

Sans gate Lighthouse, on peut ajouter 30 KB de bundle sans s'en rendre compte. Toujours setup `lhci` en CI.

### 11.5 Trop préprévoir l'utilisateur

```ts
// MAUVAIS — précharge AR au cas où, alors que user n'utilisera jamais
useEffect(() => {
  prefetchLocale('ar');
  prefetchLocale('en');
}, []);
```

→ Gaspille la bande passante de l'user mobile 4G.

**Bon** : prefetch sur hover du switcher (intent signal).

```tsx
<button onMouseEnter={() => prefetchLocale('ar')}>AR</button>
```

## 12. Tests perf

### 12.1 Vitest — bundle size assertions

```ts
// scripts/perf/check-bundle.ts
import fs from 'node:fs';
import path from 'node:path';

const messagesDir = path.join(process.cwd(), 'apps/web/.next/static/chunks');
const messageChunks = fs.readdirSync(messagesDir).filter((f) => f.startsWith('messages-'));

for (const chunk of messageChunks) {
  const size = fs.statSync(path.join(messagesDir, chunk)).size;
  const gzipped = require('zlib').gzipSync(fs.readFileSync(path.join(messagesDir, chunk))).length;
  console.log(`${chunk}: ${size}B raw, ${gzipped}B gzip`);
  if (gzipped > 15_000) {
    console.error(`❌ ${chunk} exceeds 15 KB budget`);
    process.exit(1);
  }
}
```

À lancer en post-build CI.

### 12.2 Playwright — Network observation

```ts
test('only loads current locale messages chunk', async ({ page }) => {
  const requests: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('messages-')) requests.push(req.url());
  });

  await page.goto('/fr/kit');
  await page.waitForLoadState('networkidle');

  const messageReqs = requests.filter((u) => u.includes('messages-'));
  expect(messageReqs).toHaveLength(1);
  expect(messageReqs[0]).toContain('messages-fr');
  expect(messageReqs.some((u) => u.includes('messages-ar'))).toBe(false);
  expect(messageReqs.some((u) => u.includes('messages-en'))).toBe(false);
});
```

### 12.3 Lighthouse CI assertion

```yaml
# .github/workflows/lighthouse.yml
- run: pnpm exec lhci autorun --config=lighthouserc.json
- run: pnpm exec lhci upload --target=temporary-public-storage
```

Configuration `lighthouserc.json` (cf. §7.2) bloque le PR si budgets dépassés.

### 12.4 K6 perf load

```js
// apps/web/k6/i18n-load.js
import http from 'k6/http';
import { check } from 'k6';

export const options = { vus: 50, duration: '30s' };

export default function () {
  const r = http.get('https://staging.femiglow.ma/fr/kit');
  check(r, {
    'status 200': (res) => res.status === 200,
    'no error in body': (res) => !res.body.includes('IntlMessages'),
    'response size < 100 KB': (res) => res.body.length < 100_000,
  });
}
```

## 13. Checklist lazy loading

- [ ] `i18n.ts` utilise `await import(\`@/messages/${locale}.json\`)` (dynamic)
- [ ] Build genère 3 chunks séparés `messages-fr|ar|en.js` (vérifier via `next build` output)
- [ ] Webpack bundle analyzer confirme : chunks indépendants
- [ ] Pages marketing en RSC par défaut (pas `'use client'` global)
- [ ] Client islands isolés pour réduire hydration
- [ ] `NextIntlClientProvider` posé une fois dans layout `[locale]` (pas dupliqué)
- [ ] Pages lourdes (kit, wizard) utilisent éventuellement `pick(messages, ['namespace'])`
- [ ] Cache-Control sur chunks messages : `immutable, max-age=31536000`
- [ ] Lighthouse CI configuré avec budget mobile + desktop
- [ ] `messages/*.json` chacun < 50 KB raw, < 15 KB gzipped
- [ ] Bundle JS initial total < 200 KB gzipped
- [ ] LCP mobile < 2.5s sur les 3 locales
- [ ] TBT mobile < 200ms sur les 3 locales
- [ ] Tests Playwright : vérifient qu'un seul chunk locale est téléchargé
- [ ] Pas d'import statique de toutes les locales dans un même fichier
- [ ] Prefetch des autres locales seulement sur hover/intent (pas systématique)
- [ ] Mesure trimestrielle bundle size + Lighthouse score (gardes-fou)
