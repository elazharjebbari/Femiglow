# Comparaison libraries i18n — analyse approfondie

> **Date** : mai 2026.
> **Périmètre** : libraries i18n compatibles Next.js 14 App Router (RSC).

## 1. Liste des candidats analysés

| Library | Version | Maintainer | Stars GitHub | Last update |
|---|---|---|---|---|
| [`next-intl`](https://next-intl-docs.vercel.app/) | 3.x | Jan Amann | 4.5k | hebdo |
| [`next-i18next`](https://github.com/i18next/next-i18next) | 15.x | i18next team | 8.5k | mensuel |
| [`paraglide-js`](https://inlang.com/m/gerre34r/library-inlang-paraglideJs) | 2.x (RC) | Inlang | 2k | quotidien |
| [`react-i18next`](https://react.i18next.com/) | 14.x | i18next team | 8.6k | hebdo |
| [`@formatjs/intl`](https://formatjs.io/) | 2.x | Yahoo / OpenJS | 14k | hebdo |
| [`@lingui/macro`](https://lingui.dev/) | 4.x | Tomáš Roun | 4.4k | mensuel |
| **Maison (extension WizardDictionary CHA-231)** | n/a | FemiGlow | n/a | — |

## 2. Critères d'évaluation (poids 1-5)

### 2.1 Architecture & DX

| Critère | Poids | Description |
|---|---|---|
| Support RSC natif Next 14 App Router | 5 | Hook RSC + server components |
| Type-safety messages (TS) | 5 | Erreur compile si clé manque |
| Routing locale-aware | 4 | Middleware + Link helper |
| Server Actions support | 3 | t() utilisable dans actions |
| `cookies()` / `headers()` access | 3 | Accès req server-side |
| Hot reload dev | 3 | Modifier message → instant refresh |
| Codegen TypeScript | 4 | Types générés depuis JSON |
| Markdown support | 2 | Format `<MarkdownT id=...>` |

### 2.2 Format messages

| Critère | Poids | Description |
|---|---|---|
| ICU MessageFormat | 4 | Standard plurals + selects |
| Interpolation simple `{name}` | 5 | Cas le plus courant |
| Rich text (JSX inside) | 3 | `<b>{name}</b>` |
| Numbered placeholders | 2 | `{0}, {1}` |
| Plain JSON ou JSON5 | 3 | Editable manuel |

### 2.3 Pluralization & formats

| Critère | Poids | Description |
|---|---|---|
| `Intl.PluralRules` integration | 4 | Plurals AR correct (6 cas) |
| `Intl.DateTimeFormat` | 5 | Dates localisées |
| `Intl.NumberFormat` | 5 | Prix, %, % |
| `Intl.RelativeTimeFormat` | 3 | "il y a 3 jours" / "3 يوم مضى" |

### 2.4 SEO & métadonnées

| Critère | Poids | Description |
|---|---|---|
| `<link rel="alternate" hreflang>` auto | 5 | Critique pour SEO |
| Sitemap multi-locale | 3 | Pour Google indexation |
| `generateMetadata()` localisable | 5 | Per-page metadata localisée |
| Canonical URLs | 3 | Évite duplicate content |

### 2.5 Performance

| Critère | Poids | Description |
|---|---|---|
| Bundle size impact (gzipped) | 4 | Cible < 10kb/locale |
| Code splitting par locale | 4 | Charger uniquement active |
| Build time | 2 | Codegen + extraction |
| Edge runtime compatible | 3 | Vercel middleware |
| Lazy loading messages | 3 | Pour 10+ locales |

### 2.6 Écosystème & maintenance

| Critère | Poids | Description |
|---|---|---|
| GitHub stars / activité | 2 | Indicateur santé |
| Documentation qualité | 4 | Souvent décisif |
| Communauté Discord/Slack | 2 | Support |
| Compatible Crowdin/Lokalise | 3 | Export/import TMS |
| Backward compat majeures versions | 2 | Stabilité |

### 2.7 Special features

| Critère | Poids | Description |
|---|---|---|
| RTL support natif | 3 | Helpers `dir` |
| Pseudo-localization built-in | 2 | Test layouts |
| Lint rules / ESLint plugin | 3 | Détecter hardcoded |
| Migration tools | 2 | CLI codemod |

## 3. Analyse détaillée par library

### 3.1 next-intl ⭐ Recommandation

#### Vue d'ensemble

```ts
// next.config.mjs
import createNextIntlPlugin from 'next-intl/plugin';
const withNextIntl = createNextIntlPlugin('./src/i18n.ts');
export default withNextIntl({});

// src/i18n.ts
import { getRequestConfig } from 'next-intl/server';
export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default,
}));

// app/[locale]/layout.tsx (RSC)
import { NextIntlClientProvider, useMessages } from 'next-intl';
export default function Layout({ children, params: { locale } }) {
  const messages = useMessages();
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

// Use in component
import { useTranslations } from 'next-intl';
function Hero() {
  const t = useTranslations('hero');
  return <h1>{t('title')}</h1>;
}
```

#### Forces

- ✅ **RSC-first** : `useTranslations` fonctionne dans server components ET client components
- ✅ **Routing intégré** : `createSharedPathnamesNavigation` ou `createLocalizedPathnamesNavigation`
- ✅ **Middleware prêt à l'emploi** :
  ```ts
  // middleware.ts
  import createMiddleware from 'next-intl/middleware';
  export default createMiddleware({
    locales: ['fr', 'ar', 'en'],
    defaultLocale: 'fr',
    localeDetection: true,
  });
  ```
- ✅ **Type-safe** via `next-intl.config.ts` + TS module augmentation
- ✅ **ICU MessageFormat** complet (plurals, selects, dates, numbers)
- ✅ **`generateMetadata`** localisable
- ✅ **Sitemap auto** via helper `getPathname`
- ✅ Bundle léger (~5kb gzipped)
- ✅ Doc top niveau

#### Faiblesses

- ⚠️ Library "jeune" (v3 sortie 2024) — risque pivot
- ⚠️ Magie middleware peut surprendre (mais bien documentée)
- ⚠️ Pas de TMS integration officielle (mais JSON standard donc Crowdin/Lokalise importable)

#### Score (sur 100)

| Catégorie | Note / 5 | Pondéré |
|---|---|---|
| Architecture & DX | 4.8 | 30/30 |
| Format messages | 4.5 | 14/15 |
| Pluralization | 4.5 | 14/15 |
| SEO | 5.0 | 16/16 |
| Performance | 4.0 | 13/16 |
| Écosystème | 3.5 | 9/13 |
| Special features | 2.5 | 4/8 |
| **Total** | — | **88/100** |

### 3.2 next-i18next

Library historique (créée 2019) basée sur `i18next`.

#### Forces
- ✅ Mature, large communauté
- ✅ Plugins multiples (backend, cache, etc.)
- ✅ Compatible Crowdin/Lokalise officiel
- ✅ `Trans` component riche

#### Faiblesses
- ❌ **Pages Router-first** (Next 12 / 13)
- ❌ Pour App Router : nécessite fork ou tricks
- ❌ Bundle plus lourd (~13kb gzipped)
- ❌ Setup plus complexe (i18next + react-i18next + next-i18next 3 layers)
- ❌ RSC support limité

#### Score : **65 / 100** (handicap App Router)

### 3.3 paraglide-js

Nouvelle library (2023) avec approche **compile-time** : codegen TS depuis messages.

```ts
// messages/fr.json
{ "hello": "Bonjour, {name}" }

// Generated: src/paraglide/messages.ts
export const hello = (params) => `Bonjour, ${params.name}`;

// Use
import * as m from '@/paraglide/messages';
<h1>{m.hello({ name: 'Yasmine' })}</h1>;
```

#### Forces
- ✅ **Ultra léger** (~1kb runtime)
- ✅ Type-safe natif (codegen TS)
- ✅ Tree-shakeable (seuls messages utilisés sont bundled)
- ✅ ICU MessageFormat support

#### Faiblesses
- ⚠️ **Jeune** (v2 RC 2024)
- ⚠️ Communauté plus petite
- ⚠️ Plugin Next.js séparé (`@inlang/paraglide-next`)
- ⚠️ Doc en évolution rapide
- ⚠️ Pas encore de routing helper aussi mature que next-intl

#### Score : **75 / 100** (high potential mais immaturité)

### 3.4 react-i18next brut

Library JS standalone (non Next.js spécifique).

#### Forces
- ✅ Très flexible
- ✅ Plugins multiples
- ✅ Communauté énorme

#### Faiblesses
- ❌ Pas de routing Next intégré
- ❌ RSC support à coder
- ❌ Plus de boilerplate
- ❌ Beaucoup d'options = plus de bugs potentiels

#### Score : **60 / 100**

### 3.5 Lingui (`@lingui/macro`)

Approche macro JSX :

```tsx
import { Trans, t } from '@lingui/macro';
<Trans>Bonjour, {name}</Trans>
```

#### Forces
- ✅ Macros JSX très expressifs
- ✅ Bundle léger (~3kb)
- ✅ ICU MessageFormat
- ✅ Lingui Extract CLI (auto-extraction)

#### Faiblesses
- ⚠️ Babel macro plugin requis
- ⚠️ Next App Router support partiel
- ⚠️ Plus complexe setup

#### Score : **70 / 100**

### 3.6 @formatjs/intl

Suite Yahoo/OpenJS de helpers Intl (`react-intl` + `intl-messageformat` + ...).

#### Forces
- ✅ Standard du marché
- ✅ Très complet ICU
- ✅ Polyfills Intl

#### Faiblesses
- ⚠️ Pas spécifique Next.js — beaucoup de glue à écrire
- ⚠️ Bundle plus lourd (~15kb si tout inclus)

#### Score : **68 / 100**

### 3.7 Maison (extension WizardDictionary CHA-231)

Pattern type-safe interface + locale files (déjà en place pour wizard).

```ts
export interface Dictionary {
  hero: { title: string; cta: string };
  // ...
}
export const dictionaryFr: Dictionary = { hero: { title: 'Bonjour', cta: 'Découvrir' }};
```

#### Forces
- ✅ **0 dépendance**
- ✅ Type-safe natif TS
- ✅ Pattern déjà connu de l'équipe
- ✅ Bundle 0 overhead

#### Faiblesses
- ❌ **Tout à coder** : routing, middleware, sitemap, hreflang, plurals, dates, numbers, RTL helpers
- ❌ Maintenance long terme
- ❌ Pas d'écosystème (TMS, lint, etc.)
- ❌ Charge nouvelle pour le dev

#### Score : **55 / 100**

## 4. Tableau comparatif synthétique

| Critère pondéré | next-intl | next-i18next | paraglide | react-i18next | Lingui | formatjs | Maison |
|---|---|---|---|---|---|---|---|
| Compat RSC App Router (×5) | 5 | 2 | 5 | 3 | 4 | 4 | 5 |
| Type-safety (×5) | 4 | 3 | 5 | 3 | 4 | 3 | 5 |
| Routing intégré (×4) | 5 | 3 | 4 | 1 | 2 | 1 | 0 |
| Bundle léger (×4) | 4 | 2 | 5 | 3 | 4 | 2 | 5 |
| ICU MessageFormat (×4) | 5 | 5 | 5 | 5 | 5 | 5 | 1 |
| SEO hreflang auto (×5) | 5 | 4 | 3 | 1 | 2 | 1 | 0 |
| Pluralization Intl (×4) | 5 | 5 | 5 | 5 | 5 | 5 | 1 |
| Documentation (×4) | 5 | 5 | 3 | 5 | 4 | 4 | 0 |
| Écosystème TMS (×3) | 3 | 5 | 2 | 5 | 4 | 3 | 0 |
| Maturité (×2) | 3 | 5 | 2 | 5 | 4 | 5 | 5 |
| **Score pondéré /100** | **88** | **65** | **75** | **60** | **70** | **68** | **55** |

## 5. Décision recommandée

**Library : `next-intl`** (Option A).

**Raisons clés** :
1. **Best-in-class RSC support** pour Next 14 App Router
2. **Routing locale-aware** prêt à l'emploi (middleware + Link helpers)
3. **ICU MessageFormat** + `Intl.*` natif (plurals AR correct)
4. **SEO** automatique (hreflang, sitemap helpers)
5. **Type-safe** via TS module augmentation
6. **Doc top niveau** + maintainer actif
7. Compatible **JSON files** (cohérent avec stack actuelle CHA-231)
8. **Bundle léger** (~5kb gzipped)

**Combinaisons gagnantes** :
- next-intl + Tailwind logical properties pour RTL
- next-intl + Drizzle pour CMS dynamique (component_field_bindings)
- next-intl + WizardDictionary (CHA-231) co-existence — pas de migration forcée du wizard

→ Cf. [`recommendation.md`](./recommendation.md) pour l'architecture finale détaillée.
