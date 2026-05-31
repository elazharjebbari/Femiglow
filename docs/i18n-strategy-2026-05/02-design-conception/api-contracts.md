# API Contracts — helpers et endpoints

## 1. Helpers next-intl utilisés

### 1.1 `useTranslations(namespace?)` — RSC + Client

```ts
import { useTranslations } from 'next-intl';

// In any component (server or client)
const t = useTranslations('marketing.hero');
return <h1>{t('title')}</h1>;
```

### 1.2 `getTranslations` — Server-only

```ts
import { getTranslations } from 'next-intl/server';

export async function generateMetadata({ params: { locale } }) {
  const t = await getTranslations({ locale, namespace: 'seo.kit' });
  return {
    title: t('title'),
    description: t('description'),
  };
}
```

### 1.3 `useLocale()` / `getLocale()` — Get current locale

```ts
// Client component
const locale = useLocale(); // 'fr' | 'ar' | 'en'

// Server component
const locale = await getLocale();
```

### 1.4 `useFormatter()` — Date / number / currency

```ts
const format = useFormatter();
format.dateTime(new Date(), { dateStyle: 'medium' });
// FR: "27 mai 2026"
// AR: "٢٧ مايو ٢٠٢٦"

format.number(199, { style: 'currency', currency: 'MAD' });
// FR: "199,00 MAD"

format.relativeTime(new Date(Date.now() - 86400000));
// FR: "il y a 1 jour"
// AR: "قبل يوم واحد"
```

## 2. Helpers custom

### 2.1 `getLocaleConfig(locale)`

```ts
// src/lib/i18n/config.ts
export interface LocaleConfig {
  code: string;
  displayName: string;
  displayNameNative: string;
  direction: 'ltr' | 'rtl';
  flagEmoji: string;
  fallbackLocale: string | null;
  currencyCode: string;
  enabled: boolean;
}

export function getLocaleConfig(locale: string): LocaleConfig {
  return LOCALES_CONFIG[locale] ?? LOCALES_CONFIG[DEFAULT_LOCALE]!;
}
```

### 2.2 `usePathname()` + `useRouter()` (next-intl)

```ts
import { usePathname, useRouter } from 'next-intl/client';
const pathname = usePathname(); // '/kit' (without locale prefix)
const router = useRouter();
router.replace(pathname, { locale: 'ar' });
// → navigates to /ar/kit
```

### 2.3 `<Link href locale>` (next-intl)

```tsx
import Link from 'next-intl/link';
<Link href="/kit" locale="ar">العربية</Link>
// renders <a href="/ar/kit">العربية</a>
```

## 3. Endpoints API custom

### 3.1 `GET /api/i18n/coverage`

Coverage stats par locale (admin tool).

**Response** :
```json
{
  "locales": [
    { "code": "fr", "total": 542, "translated": 542, "percentage": 100 },
    { "code": "ar", "total": 542, "translated": 423, "percentage": 78 },
    { "code": "en", "total": 542, "translated": 245, "percentage": 45 }
  ],
  "by_namespace": [
    { "namespace": "common", "fr": 100, "ar": 100, "en": 95 },
    { "namespace": "marketing", "fr": 100, "ar": 80, "en": 50 },
    { "namespace": "wizard", "fr": 100, "ar": 100, "en": 0 }
  ],
  "missing_keys": [
    { "key": "marketing.hero.cta_v2", "locales": ["ar", "en"] }
  ]
}
```

### 3.2 `GET /api/i18n/missing-keys?locale=ar`

Liste les clés manquantes pour une locale donnée.

**Response** :
```json
{
  "locale": "ar",
  "missing": [
    { "key": "marketing.hero.cta_v2", "source_fr": "Découvrir maintenant" },
    { "key": "wizard.payment.new_label", "source_fr": "Mode de paiement" }
  ]
}
```

### 3.3 `POST /api/i18n/locale/switch`

Server action pour switcher la locale (alternative au router.replace côté client).

**Body** :
```json
{ "locale": "ar" }
```

**Response** : `200 OK` + Set-Cookie `NEXT_LOCALE=ar`.

### 3.4 `POST /api/admin/i18n/upsert-message`

Update une traduction (admin).

**Body** :
```json
{
  "key": "marketing.hero.title",
  "locale": "ar",
  "value": "طقوس الأظافر في خمس دقائق."
}
```

### 3.5 `POST /api/admin/i18n/locales` (CRUD)

Manage locales (add/remove/enable/disable).

**Body** :
```json
{
  "action": "create",
  "code": "es",
  "displayName": "Spanish",
  "displayNameNative": "Español",
  "direction": "ltr",
  "fallbackLocale": "fr",
  "enabled": false
}
```

### 3.6 `GET /api/admin/i18n/export?locale=ar&format=csv`

Export des traductions pour traducteur externe.

**Response** : CSV file
```csv
key,namespace,source_fr,current_ar,notes
common.back,common,"Retour","رجوع",""
marketing.hero.title,marketing,"Le rituel...","طقوس...",""
```

### 3.7 `POST /api/admin/i18n/import`

Import CSV/JSON traduit.

**Body** : multipart/form-data, fichier `.csv` ou `.json`

**Response** :
```json
{
  "imported": 245,
  "skipped": 12,
  "errors": [
    { "key": "marketing.invalid_key", "reason": "key not in catalog" }
  ]
}
```

## 4. Type definitions

### 4.1 Types globaux

```ts
// src/i18n.config.ts
export const LOCALES = ['fr', 'ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number]; // 'fr' | 'ar' | 'en'

export const DEFAULT_LOCALE: Locale = 'fr';
```

### 4.2 Type-safe messages (TS module augmentation)

```ts
// src/types/next-intl.d.ts
import messages from '../messages/fr.json';

declare global {
  // Use type-safe keys
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface IntlMessages extends Messages {}
}

type Messages = typeof messages;
```

Permet :
```ts
const t = useTranslations('marketing.hero');
t('title'); // ✅ TS check
t('non_existent'); // ❌ TS error
```

## 5. Server Actions

### 5.1 Action `switchLocale`

```ts
// src/lib/i18n/actions.ts
'use server';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

export async function switchLocale(newLocale: Locale, currentPath: string) {
  cookies().set('NEXT_LOCALE', newLocale, { maxAge: 60 * 60 * 24 * 365 });
  revalidatePath('/');
  return { ok: true, redirectTo: `/${newLocale}${currentPath}` };
}
```

### 5.2 Action `upsertFieldBinding`

```ts
// src/lib/cms/actions.ts
'use server';
export async function upsertFieldBinding(
  componentId: string,
  fieldKey: string,
  locale: Locale,
  value: unknown,
  actor: string
) {
  await db.insert(schema.componentFieldBindings)
    .values({ componentId, fieldKey, locale, value, status: 'draft', updatedBy: actor })
    .onConflictDoUpdate({
      target: [schema.componentFieldBindings.componentId, schema.componentFieldBindings.fieldKey, schema.componentFieldBindings.locale],
      set: { value, updatedBy: actor, updatedAt: new Date() },
    });
  revalidateTag(`cms-component-${componentId}`);
}
```

## 6. Errors / status codes

| Action | Success | Error |
|---|---|---|
| Switch locale | 200 | 400 if invalid locale |
| Coverage | 200 | 401 if not admin |
| Upsert message | 200 | 401 / 422 (validation Zod) |
| Import | 200 | 401 / 422 / 500 |
| Locale CRUD | 200 | 401 / 409 (duplicate code) |

## 7. Rate limiting

Endpoints admin : 60 req/min/admin (via Redis ou memory cache).

Endpoints public (i18n) : pas de rate limit (cache CDN).
