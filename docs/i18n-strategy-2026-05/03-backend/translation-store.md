# Translation store — Stratégie de stockage des messages

> Où vivent les traductions FemiGlow et comment elles sont chargées au runtime.

## 1. Vue d'ensemble

FemiGlow utilise un **stockage hybride** combinant JSON statiques et tables PostgreSQL :

```
┌──────────────────────────────────────────────────────────────┐
│                     Translation store                         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌──────────────────┐         ┌─────────────────────────┐   │
│   │  JSON statiques  │         │   Tables PostgreSQL     │   │
│   │  (build-time)    │         │   (runtime, DB)         │   │
│   ├──────────────────┤         ├─────────────────────────┤   │
│   │ messages/fr.json │         │ component_field_bindings│   │
│   │ messages/ar.json │         │ legal_pages             │   │
│   │ messages/en.json │         │ seo_overrides           │   │
│   │ messages/_meta…  │         │ i18n_locales            │   │
│   └────────┬─────────┘         │ i18n_translation_keys   │   │
│            │                    │ i18n_translation_values │   │
│            │                    └────────┬────────────────┘   │
│            │                             │                   │
│            ▼                             ▼                   │
│   ┌──────────────────────────────────────────────────────┐   │
│   │  next-intl runtime (RSC + Client + middleware edge)  │   │
│   └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

| Type de contenu | Stockage | Raisons |
|---|---|---|
| Strings UI fixes (boutons, labels, navigation) | `messages/[locale].json` | Bundle statique, type-safe, edge-cache |
| Metadata SEO statique (`<title>`, `<meta>`) | `messages/[locale].json` (namespace `seo.*`) | Statique, lié à la page |
| Contenu CMS dynamique (hero, sections marketing) | `component_field_bindings.value` | Édité sans deploy, fetch DB |
| Pages légales longues (CGV, mentions, confidentialité) | `legal_pages.body_md` | Markdown, peut faire 50+ kB, hors bundle |
| Catalog des clés (coverage tool admin) | `i18n_translation_keys` (DB miroir) | Tracking coverage, optionnel |
| Wizard checkout (CHA-231) | `WizardDictionary` existant | Ne pas régresser, type-safe contractuel |

## 2. Stockage JSON — `messages/[locale].json`

### 2.1 Localisation des fichiers

```
apps/web/
├── messages/
│   ├── _schema.json         # JSON Schema partagé (voir 02-design-conception)
│   ├── _meta.json           # Métadonnées globales (versions, last_review)
│   ├── fr.json              # ~12 kB — source of truth
│   ├── ar.json              # ~14 kB — traduit
│   ├── en.json              # ~10 kB — traduit
│   └── _drafts/             # Brouillons en cours de relecture
│       └── es.json          # Espagnol V2
├── src/
│   ├── i18n.config.ts
│   └── i18n/
│       ├── request.ts       # getRequestConfig (next-intl)
│       └── messages.ts      # Loader + cache
└── next.config.mjs
```

### 2.2 Structure d'un fichier `messages/fr.json`

```json
{
  "$schema": "./_schema.json",
  "_meta": {
    "locale": "fr",
    "completeness_pct": 100,
    "last_reviewed_by": "founder@femiglow.local",
    "last_reviewed_at": "2026-05-27T14:30:00Z",
    "translator_notes": "Source FR — toute modification ici doit déclencher relecture AR/EN"
  },
  "common": {
    "back": "Retour",
    "continue": "Continuer",
    "cancel": "Annuler",
    "loading": "Chargement…",
    "error": "Une erreur est survenue",
    "retry": "Réessayer"
  },
  "navigation": {
    "home": "Accueil",
    "kit": "Le kit",
    "maison": "La maison",
    "rituel": "Le rituel",
    "journal": "Journal",
    "contact": "Contact"
  },
  "marketing": {
    "hero": {
      "title": "Le rituel ongles, en cinq minutes.",
      "subtitle": "Trois gestes, une saison.",
      "cta_primary": "Découvrir le rituel",
      "cta_secondary": "Voir le kit"
    },
    "kit": {
      "title": "Pack FemiGlow",
      "price_label": "{price, number, ::currency/MAD}",
      "stock_count": "{count, plural, =0 {Rupture} one {Plus qu'un en stock} other {# disponibles}}"
    }
  },
  "errors": {
    "404": {
      "title": "Page introuvable",
      "description": "Cette page n'existe pas ou n'est plus disponible.",
      "cta_home": "Retour à l'accueil"
    }
  },
  "seo": {
    "home": {
      "title": "FemiGlow — Rituel ongles maison, en 5 minutes",
      "description": "Le rituel ongles ancré au Maroc. Trois gestes, une saison. Découvrez le kit.",
      "og_title": "FemiGlow — Rituel ongles maison",
      "og_description": "Trois gestes, une saison."
    }
  }
}
```

### 2.3 Convention de versioning

Le fichier `_meta` permet de tracker la "qualité" de chaque locale :

```json
{
  "_meta": {
    "locale": "ar",
    "completeness_pct": 78,
    "missing_keys_count": 119,
    "last_reviewed_by": "translator-pro@external.com",
    "last_reviewed_at": "2026-05-15T10:00:00Z",
    "translator_notes": "Reste à traduire : marketing.kit.bullets.*, wizard.payment.method.*"
  }
}
```

Ce champ est lu par `/api/i18n/coverage` (voir `api-routes.md`).

### 2.4 Loader côté serveur — `i18n/request.ts`

next-intl charge le fichier au boot via un `getRequestConfig` :

```ts
// apps/web/src/i18n/request.ts
import { getRequestConfig } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { LOCALES, type Locale } from '../i18n.config';

export default getRequestConfig(async ({ locale }) => {
  // Validate locale
  if (!LOCALES.includes(locale as Locale)) {
    notFound();
  }

  // Dynamic import → code split par locale, chargement seul du JSON actif
  const messages = (await import(`../../messages/${locale}.json`)).default;

  return {
    messages,
    timeZone: 'Africa/Casablanca',
    now: new Date(),
    // Fallback locale au cas où une clé manque (logique gérée par next-intl)
    defaultTranslationValues: {
      // Helpers globaux dispo dans toutes les traductions
      brandName: 'FemiGlow',
    },
    // onError : log Sentry des clés manquantes
    onError(error) {
      if (error.code === 'MISSING_MESSAGE') {
        // Log mais ne pas throw — fallback géré par next-intl
        console.error(`[i18n] Missing key: ${error.message}`);
        // Sentry.captureException(error, { tags: { locale } });
      }
    },
    getMessageFallback({ namespace, key, error }) {
      const path = [namespace, key].filter(Boolean).join('.');
      if (error.code === 'MISSING_MESSAGE') {
        return `[${path}]`; // Affichage visible pour debug
      }
      return `[${path}] ${error.message}`;
    },
  };
});
```

**Points clés** :
- `import` dynamique avec template literal → next/webpack split chaque locale dans un chunk distinct
- `notFound()` si locale invalide → renvoie 404
- `onError` capture chaque clé manquante côté serveur (envoyé à Sentry)
- `getMessageFallback` retourne `[namespace.key]` pour rendre visible la clé manquante en dev (ou utiliser le fallback de la locale parent en prod)

### 2.5 Build-time bundling

Next.js (avec next-intl) génère :

```
.next/static/chunks/
├── pages-_locale_-layout-fr-abc123.js     # bundle FR
├── pages-_locale_-layout-ar-def456.js     # bundle AR
└── pages-_locale_-layout-en-ghi789.js     # bundle EN
```

Avec `output: 'standalone'` + `generateStaticParams`, on obtient **3 versions statiques** des pages publiques au build, déployées sur edge.

### 2.6 Lazy-loading par route (avancé)

Pour les pages très lourdes en traductions (admin, wizard) qui ne sont pas utilisées partout, on peut splitter les messages par scope :

```ts
// Lazy-load uniquement le namespace 'wizard' quand on entre le checkout
import { getMessages } from 'next-intl/server';

export default async function WizardLayout({ children }) {
  const messages = await getMessages();
  const wizardMessages = pick(messages, ['wizard', 'common']);
  // → Le client ne reçoit que ces namespaces dans le NextIntlClientProvider
  return (
    <NextIntlClientProvider messages={wizardMessages}>
      {children}
    </NextIntlClientProvider>
  );
}
```

Helper `pick` de next-intl :
```ts
import { pick } from 'next-intl';

const partial = pick(allMessages, ['wizard', 'common']);
// Retourne un nouveau objet avec uniquement ces namespaces
```

**Anti-pattern** : ne pas balancer `messages={fullMessagesObject}` à chaque page client si seule une portion est utilisée — ça gonfle le payload HTML.

## 3. Stockage DB — Tables Drizzle

### 3.1 Table `component_field_bindings` (existante)

Schéma actuel (voir `apps/web/src/lib/db/schema.ts`) :

```ts
export const componentFieldBindings = pgTable('component_field_bindings', {
  componentId: uuid('component_id').notNull(),
  fieldKey: text('field_key').notNull(),
  locale: text('locale').notNull().default('fr'),
  value: jsonb('value').notNull(),
  status: text('status').notNull().default('draft').$type<'draft' | 'published'>(),
  updatedBy: text('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.componentId, table.fieldKey, table.locale] }),
  idxComponent: index('idx_cfb_component').on(table.componentId, table.locale),
  idxStatus: index('idx_cfb_status').on(table.status),
}));
```

**Lecture i18n-aware** :

```ts
// apps/web/src/lib/cms/repos/component-binding.repo.ts
import { db } from '@/lib/db';
import { componentFieldBindings } from '@/lib/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

export async function getBindingsForComponent(
  componentId: string,
  locale: Locale,
): Promise<Record<string, unknown>> {
  // 1. Récupérer la locale demandée + le fallback
  const fallbackLocale = getLocaleConfig(locale).fallbackLocale ?? 'fr';
  const localesToFetch = locale === fallbackLocale ? [locale] : [locale, fallbackLocale];

  // 2. Une seule requête couvrant locale + fallback
  const rows = await db
    .select()
    .from(componentFieldBindings)
    .where(
      and(
        eq(componentFieldBindings.componentId, componentId),
        inArray(componentFieldBindings.locale, localesToFetch),
        eq(componentFieldBindings.status, 'published'),
      ),
    );

  // 3. Merge avec fallback : si la locale demandée n'a pas le field, on prend le fallback
  const result: Record<string, unknown> = {};
  for (const row of rows.filter(r => r.locale === fallbackLocale)) {
    result[row.fieldKey] = row.value;
  }
  for (const row of rows.filter(r => r.locale === locale)) {
    result[row.fieldKey] = row.value; // override par la locale demandée
  }

  return result;
}
```

### 3.2 Table `legal_pages` (existante)

```ts
export const legalPages = pgTable('legal_pages', {
  id: text('id').primaryKey(),
  slug: text('slug').notNull(),
  locale: text('locale').notNull().default('fr'),
  title: text('title').notNull(),
  bodyMd: text('body_md').notNull(),
  status: text('status').notNull().default('draft').$type<'draft' | 'published'>(),
  // ... autres champs
}, (table) => ({
  uniqueSlugLocale: uniqueIndex('uniq_legal_slug_locale').on(table.slug, table.locale),
}));
```

**Pattern de lecture** :

```ts
export async function getLegalPage(slug: string, locale: Locale) {
  // 1. Tentative locale demandée
  const direct = await db
    .select()
    .from(legalPages)
    .where(
      and(
        eq(legalPages.slug, slug),
        eq(legalPages.locale, locale),
        eq(legalPages.status, 'published'),
      ),
    )
    .limit(1);

  if (direct[0]) return direct[0];

  // 2. Fallback FR
  const fallback = await db
    .select()
    .from(legalPages)
    .where(
      and(
        eq(legalPages.slug, slug),
        eq(legalPages.locale, 'fr'),
        eq(legalPages.status, 'published'),
      ),
    )
    .limit(1);

  if (fallback[0]) {
    // Log : on a servi un fallback, alerte si trop fréquent
    logger.warn('legal_page.fallback_used', { slug, requested: locale, served: 'fr' });
    return fallback[0];
  }

  return null;
}
```

### 3.3 Nouvelle table `i18n_locales`

Spec dans `02-design-conception/data-model.md`. Drizzle schema :

```ts
// apps/web/src/lib/db/schema/i18n.ts
import { pgTable, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core';

export const i18nLocales = pgTable('i18n_locales', {
  code: text('code').primaryKey(),
  displayName: text('display_name').notNull(),
  displayNameNative: text('display_name_native').notNull(),
  direction: text('direction').notNull().default('ltr').$type<'ltr' | 'rtl'>(),
  enabled: boolean('enabled').notNull().default(false),
  isDefault: boolean('is_default').notNull().default(false),
  fallbackLocale: text('fallback_locale'),
  dateFormat: text('date_format').notNull().default('dd MMM yyyy'),
  numberFormat: text('number_format').notNull().default('fr-FR'),
  currencyCode: text('currency_code').notNull().default('MAD'),
  sortOrder: integer('sort_order').notNull().default(100),
  flagEmoji: text('flag_emoji'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**Helpers** :

```ts
// apps/web/src/lib/i18n/locales.repo.ts
import { unstable_cache } from 'next/cache';

export const getEnabledLocales = unstable_cache(
  async () => {
    return await db.select().from(i18nLocales).where(eq(i18nLocales.enabled, true)).orderBy(i18nLocales.sortOrder);
  },
  ['i18n-locales-enabled'],
  { revalidate: 3600, tags: ['i18n-locales'] }, // 1h cache, invalidé sur update
);
```

### 3.4 Tables `i18n_translation_keys` / `i18n_translation_values` (optionnelles)

Ces tables sont **un miroir DB des fichiers JSON** pour :
- Tracker la coverage en temps réel
- Permettre une UI admin d'édition sans rebuild
- Stocker les notes traducteur

Schéma :

```ts
export const i18nTranslationKeys = pgTable('i18n_translation_keys', {
  key: text('key').primaryKey(),
  namespace: text('namespace').notNull(),
  description: text('description'),
  context: text('context'),
  type: text('type').notNull().default('static').$type<'static' | 'pluralized' | 'rich'>(),
  sourceValue: text('source_value').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  addedAt: timestamp('added_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
}, (table) => ({
  idxNamespace: index('idx_keys_ns').on(table.namespace),
  idxActive: index('idx_keys_active').on(table.isActive),
}));

export const i18nTranslationValues = pgTable('i18n_translation_values', {
  key: text('key').notNull().references(() => i18nTranslationKeys.key, { onDelete: 'cascade' }),
  locale: text('locale').notNull().references(() => i18nLocales.code, { onDelete: 'cascade' }),
  value: text('value').notNull(),
  reviewed: boolean('reviewed').notNull().default(false),
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.key, table.locale] }),
  idxLocale: index('idx_values_locale').on(table.locale),
  idxReviewed: index('idx_values_reviewed').on(table.reviewed),
}));
```

**Workflow de sync** :
- Au build, un script `pnpm i18n:sync-to-db` lit `messages/*.json` et upsert dans la DB
- L'admin UI lit depuis la DB (admin tool seulement, pas en runtime production)
- Sur un import CSV → on update la DB **et** régénère le JSON via `pnpm i18n:sync-from-db`

→ V1 : on peut **commencer sans ces tables** et n'utiliser que les fichiers JSON. Les ajouter au moment où l'admin UI devient un besoin (Phase 5 du plan d'action).

## 4. Validation au boot

### 4.1 JSON Schema validation

Au démarrage de l'app (ou au build), valider la structure des fichiers messages :

```ts
// apps/web/src/i18n/validate.ts
import Ajv from 'ajv';
import schema from '../../messages/_schema.json';
import frMessages from '../../messages/fr.json';
import arMessages from '../../messages/ar.json';
import enMessages from '../../messages/en.json';

const ajv = new Ajv({ strict: false });
const validate = ajv.compile(schema);

export function validateAllLocales() {
  const locales = { fr: frMessages, ar: arMessages, en: enMessages };
  const errors: Record<string, unknown[]> = {};

  for (const [locale, messages] of Object.entries(locales)) {
    if (!validate(messages)) {
      errors[locale] = validate.errors ?? [];
    }
  }

  if (Object.keys(errors).length > 0) {
    throw new Error(`[i18n] Invalid messages: ${JSON.stringify(errors, null, 2)}`);
  }
}
```

Appelé dans :
- `pnpm dev` (Next.js server start) via `instrumentation.ts`
- `pnpm build` via `next.config.mjs.webpack`
- CI : `pnpm i18n:validate` comme étape PR

### 4.2 Coverage check au CI

```ts
// scripts/i18n/check-coverage.ts
import frMessages from '../../apps/web/messages/fr.json';
import arMessages from '../../apps/web/messages/ar.json';

function flatten(obj: object, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('$') || k.startsWith('_')) continue;
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null) {
      keys.push(...flatten(v, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

const frKeys = new Set(flatten(frMessages));
const arKeys = new Set(flatten(arMessages));

const missing = [...frKeys].filter(k => !arKeys.has(k));
const orphans = [...arKeys].filter(k => !frKeys.has(k));

if (missing.length > 0) {
  console.warn(`[i18n] AR missing ${missing.length} keys vs FR:`);
  missing.slice(0, 20).forEach(k => console.warn(`  - ${k}`));
}

if (orphans.length > 0) {
  console.error(`[i18n] AR has ${orphans.length} orphan keys not in FR:`);
  orphans.forEach(k => console.error(`  - ${k}`));
  process.exit(1); // Block CI
}
```

### 4.3 Type safety via TS module augmentation

```ts
// apps/web/src/types/next-intl.d.ts
import type fr from '../../messages/fr.json';

type Messages = typeof fr;

declare global {
  interface IntlMessages extends Messages {}
}

export {};
```

→ `useTranslations('marketing.hero').t('title')` est type-checké. Une faute de frappe `t('titel')` provoque une erreur TS.

## 5. Cache strategy

### 5.1 Cache JSON statiques

| Cache layer | TTL | Invalidation |
|---|---|---|
| Build-time bundle | Tant que le bundle est servi | Sur deploy |
| Vercel CDN edge | 1 an (immutable hash) | Sur deploy |
| Browser cache | 1 an (immutable hash) | Sur deploy |
| In-memory (server) | Pas de cache spécifique, c'est juste un import | Au reload du process |

### 5.2 Cache DB content (CMS + legal)

```ts
import { unstable_cache } from 'next/cache';

export const getCmsBindings = (componentId: string, locale: Locale) =>
  unstable_cache(
    async () => getBindingsForComponent(componentId, locale),
    [`cms-bindings`, componentId, locale],
    {
      revalidate: 300, // 5 min
      tags: [
        `cms-component-${componentId}`,
        `i18n-${locale}`,
        'cms-all',
      ],
    },
  )();
```

**Invalidation** :
- Sur édition admin d'un binding → `revalidateTag(`cms-component-${componentId}`)`
- Sur changement de locale globale → `revalidateTag(`i18n-${locale}`)`
- Sur déploiement → tous les caches sont reset automatiquement

### 5.3 Cache i18n_locales

```ts
export const getEnabledLocales = unstable_cache(
  async () => db.select().from(i18nLocales).where(eq(i18nLocales.enabled, true)),
  ['i18n-locales-enabled'],
  { revalidate: 3600, tags: ['i18n-locales-config'] }
);
```

**Invalidation** : sur création/édition de locale depuis `/admin/i18n/languages` → `revalidateTag('i18n-locales-config')`.

## 6. Performance benchmarks

| Opération | Latence cible | Mesuré (estimation) |
|---|---|---|
| Bundle JS d'une locale (gzip) | < 8 kB | ~ 4-6 kB |
| Cold load `getMessages()` RSC | < 50 ms | ~ 20 ms (import dynamique) |
| Hot load (warm cache) | < 5 ms | ~ 1 ms (in-memory) |
| Query `component_field_bindings` filtré locale | < 50 ms | ~ 15-30 ms (PK lookup) |
| Query `legal_pages` by slug + locale | < 30 ms | ~ 10 ms (unique index) |
| Edge middleware locale detection | < 15 ms | ~ 5-10 ms (next-intl) |

### 6.1 Optimisations spécifiques

1. **Indices DB** : `idx_cfb_component(component_id, locale)` couvre la requête principale
2. **Compression JSON** : Vercel sert les JSON en Brotli (-30% vs gzip)
3. **Préchargement** : `<link rel="preload" as="fetch" href="/_next/static/.../fr.json">` injecté dans le `<head>` du document
4. **HTTP/2 multiplexing** : pas besoin de bundler tout dans le HTML, le client charge en parallèle

### 6.2 Anti-patterns performance

- **Charger toutes les locales côté client** : ne JAMAIS faire `Promise.all([import('fr.json'), import('ar.json'), import('en.json')])` dans un client component
- **`SELECT *` sur `component_field_bindings`** : filtrer toujours par `componentId` ET `locale` (utiliser la PK)
- **Pages légales en `messages.json`** : si une page fait > 5 kB de texte, la mettre en `legal_pages.body_md` et la fetch côté server
- **Recharger les locales config à chaque request** : utiliser `unstable_cache` avec TTL 1h
- **Imports dynamiques imbriqués** : `await import(await getLocale())` n'est pas analysable par webpack, préférer un switch explicite

## 7. Variables d'environnement

```bash
# apps/web/.env.example

# Active le système i18n (kill switch)
I18N_ENABLED=true

# Locale par défaut si rien détecté
NEXT_PUBLIC_DEFAULT_LOCALE=fr

# Locales actives (CSV)
NEXT_PUBLIC_ENABLED_LOCALES=fr,ar,en

# Niveau de log pour les missing keys
I18N_LOG_LEVEL=warn  # 'debug' | 'warn' | 'error' | 'silent'

# Sentry DSN dédié i18n (optionnel)
I18N_SENTRY_DSN=

# Endpoint admin protégé
I18N_ADMIN_API_TOKEN=sk-...  # rotation tous les 90 jours
```

### 7.1 Lecture côté serveur

```ts
// apps/web/src/i18n.config.ts
const env = process.env;

export const LOCALES = (env.NEXT_PUBLIC_ENABLED_LOCALES ?? 'fr').split(',') as Locale[];
export const DEFAULT_LOCALE = (env.NEXT_PUBLIC_DEFAULT_LOCALE ?? 'fr') as Locale;
export const I18N_ENABLED = env.I18N_ENABLED === 'true';
```

## 8. Workflow de déploiement

### 8.1 Ajout d'une clé

1. Dev édite `messages/fr.json` → ajoute `marketing.hero.cta_v2: "Nouveau CTA"`
2. Dev utilise `t('marketing.hero.cta_v2')` dans son TSX
3. CI run :
   - `pnpm i18n:validate-schema` (passe : la clé respecte le pattern)
   - `pnpm i18n:check-coverage` (warning : manquante en AR/EN, pas bloquant si non critique)
   - `pnpm typecheck` (OK : module augmentation)
4. Merge → deploy
5. En prod, AR/EN fallback sur FR (avec log Sentry) jusqu'à traduction

### 8.2 Ajout d'une locale

1. Admin crée locale via `/admin/i18n/languages` → INSERT dans `i18n_locales`
2. Admin upload un fichier `messages/es.json` partiel via UI (ou trigger un export FR + traduction externe)
3. Build CI → vérifie schema
4. Deploy
5. Locale devient active une fois `enabled = true`

→ Détail dans [`09-runbook/ajouter-nouvelle-langue.md`](../09-runbook/ajouter-nouvelle-langue.md).

## 9. Checklist à tester / à vérifier

- [ ] `messages/fr.json` valide contre `_schema.json` (script CI)
- [ ] `messages/ar.json` et `messages/en.json` n'ont pas de clés orphelines (pas dans FR)
- [ ] `getRequestConfig` retourne bien les messages pour `locale = 'fr' | 'ar' | 'en'`
- [ ] `getRequestConfig` appelle `notFound()` si locale invalide (test : `/xx/kit` → 404)
- [ ] Bundle splitting : `messages/ar.json` n'est PAS dans le chunk de la locale FR
- [ ] Cache CDN : `messages/*.json` ont un `Cache-Control: public, max-age=31536000, immutable`
- [ ] `component_field_bindings` retourne avec fallback FR si locale demandée manque
- [ ] `legal_pages` retourne avec fallback FR + log warning
- [ ] `i18n_locales` est cache 1h via `unstable_cache`
- [ ] Module augmentation : `t('inexistant')` provoque erreur TS
- [ ] Sentry capture une erreur sur `t('inexistant.cle')`
- [ ] Performance : middleware ajoute < 15ms au TTFB (mesure Vercel)
- [ ] Performance : `getMessages()` < 50ms en cold start
- [ ] Type-safety : changement de la valeur de `marketing.hero.title` ne casse PAS le type (la clé reste)
- [ ] Type-safety : suppression de `marketing.hero.title` provoque erreur TS sur sites d'appel

## 10. Références croisées

- Spec helpers : [`02-design-conception/api-contracts.md`](../02-design-conception/api-contracts.md)
- Schémas DB : [`02-design-conception/data-model.md`](../02-design-conception/data-model.md)
- Naming conventions : [`02-design-conception/naming-conventions.md`](../02-design-conception/naming-conventions.md)
- Resolver détails : [`./locale-resolver.md`](./locale-resolver.md)
- RSC patterns : [`./server-rendering.md`](./server-rendering.md)
- Content CMS : [`./content-translation.md`](./content-translation.md)
- Plan migration data : [`06-data-strategy/migration-data.md`](../06-data-strategy/migration-data.md)
