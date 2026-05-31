# API routes — Endpoints i18n

> Spécification complète des routes API i18n FemiGlow : signatures TypeScript, validation Zod, queries Drizzle, error handling, rate limiting, exemples `curl`.

## 1. Vue d'ensemble des endpoints

### 1.1 Catalogue

| # | Route | Méthode | Auth | Cache | Rate-limit |
|---|---|---|---|---|---|
| 1 | `/api/i18n/coverage` | GET | Admin | 60s | 60/min |
| 2 | `/api/i18n/missing-keys` | GET | Admin | 60s | 60/min |
| 3 | `/api/i18n/locale/switch` | POST | Public | Pas cache | 30/min/IP |
| 4 | `/api/admin/i18n/upsert-message` | POST | Admin | Pas cache | 60/min |
| 5 | `/api/admin/i18n/locales` | POST | Admin | Pas cache | 60/min |
| 6 | `/api/admin/i18n/export` | GET | Admin | 300s | 10/min (lourd) |
| 7 | `/api/admin/i18n/import` | POST | Admin | Pas cache | 5/min (lourd) |

### 1.2 Découpage par namespace

- **Public** (`/api/i18n/*`) : endpoints accessibles sans auth (locale switch côté visiteur)
- **Admin** (`/api/admin/i18n/*`) : endpoints réservés au rôle admin (toujours derrière authMiddleware)

### 1.3 Convention de réponse

Toutes les routes utilisent un format standardisé :

```ts
// Success
{
  "data": { /* payload */ },
  "meta": { "timestamp": "2026-05-27T15:00:00Z", "version": "v1" }
}

// Error
{
  "error": {
    "code": "VALIDATION_ERROR" | "NOT_FOUND" | "UNAUTHORIZED" | "RATE_LIMITED" | "INTERNAL",
    "message": "Locale 'xx' is not in the enabled list",
    "details": { /* Zod errors si VALIDATION */ }
  },
  "meta": { "timestamp": "2026-05-27T15:00:00Z", "version": "v1" }
}
```

## 2. Helpers partagés

### 2.1 Auth admin

```ts
// apps/web/src/lib/api/auth-admin.ts
import { cookies, headers } from 'next/headers';
import { jwtVerify } from 'jose';

export async function requireAdmin(): Promise<{ userId: string; email: string }> {
  const sessionCookie = cookies().get('admin_session')?.value;
  if (!sessionCookie) throw new ApiError('UNAUTHORIZED', 'Admin session required');

  const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!);
  try {
    const { payload } = await jwtVerify(sessionCookie, secret);
    if (payload.role !== 'admin') throw new ApiError('UNAUTHORIZED', 'Admin role required');
    return { userId: payload.sub as string, email: payload.email as string };
  } catch {
    throw new ApiError('UNAUTHORIZED', 'Invalid session');
  }
}
```

### 2.2 Rate limiting (in-memory + Upstash en prod)

```ts
// apps/web/src/lib/api/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

export const adminLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  prefix: 'i18n:admin',
});

export const heavyLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  prefix: 'i18n:heavy',
});

export const publicLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '1 m'),
  prefix: 'i18n:public',
});

export async function enforceRateLimit(
  limiter: Ratelimit,
  identifier: string,
): Promise<void> {
  const { success, limit, remaining, reset } = await limiter.limit(identifier);
  if (!success) {
    throw new ApiError('RATE_LIMITED', `Rate limit exceeded. Retry after ${new Date(reset).toISOString()}`, {
      limit,
      remaining,
      reset,
    });
  }
}
```

### 2.3 Helper de réponse

```ts
// apps/web/src/lib/api/response.ts
import { NextResponse } from 'next/server';

export class ApiError extends Error {
  constructor(
    public code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'RATE_LIMITED' | 'INTERNAL' | 'CONFLICT',
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

const STATUS_MAP: Record<ApiError['code'], number> = {
  VALIDATION_ERROR: 422,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  CONFLICT: 409,
  INTERNAL: 500,
};

export function apiSuccess<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json({
    data,
    meta: { timestamp: new Date().toISOString(), version: 'v1' },
  }, init);
}

export function apiError(error: ApiError | unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({
      error: { code: error.code, message: error.message, details: error.details },
      meta: { timestamp: new Date().toISOString(), version: 'v1' },
    }, { status: STATUS_MAP[error.code] });
  }
  // Unknown error
  console.error('[api] Unhandled error', error);
  return NextResponse.json({
    error: { code: 'INTERNAL', message: 'Internal server error' },
    meta: { timestamp: new Date().toISOString(), version: 'v1' },
  }, { status: 500 });
}
```

### 2.4 Schémas Zod partagés

```ts
// apps/web/src/lib/api/i18n/schemas.ts
import { z } from 'zod';

export const localeSchema = z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Invalid BCP-47 locale');

export const messageKeySchema = z
  .string()
  .min(1)
  .max(200)
  .regex(/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$/, 'Key must be dot.separated.snake_case');

export const namespaceSchema = z.enum([
  'common', 'navigation', 'marketing', 'wizard',
  'legal', 'admin', 'email', 'errors', 'seo',
]);
```

## 3. Endpoint détaillés

### 3.1 `GET /api/i18n/coverage`

**Description** : retourne des stats de coverage par locale. Utilisé par `/admin/i18n/dashboard`.

#### Signature TypeScript

```ts
// apps/web/src/app/api/i18n/coverage/route.ts
import { NextRequest } from 'next/server';

export async function GET(req: NextRequest) { /* ... */ }

interface CoverageResponse {
  locales: Array<{
    code: string;
    total: number;
    translated: number;
    percentage: number;
    lastReviewedAt: string | null;
  }>;
  byNamespace: Array<{
    namespace: string;
    fr: number;
    ar: number;
    en: number;
  }>;
  missingKeys: Array<{
    key: string;
    locales: string[];
  }>;
}
```

#### Implémentation

```ts
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { i18nTranslationKeys, i18nTranslationValues, i18nLocales } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { requireAdmin } from '@/lib/api/auth-admin';
import { adminLimiter, enforceRateLimit } from '@/lib/api/rate-limit';
import { apiSuccess, apiError, ApiError } from '@/lib/api/response';

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    await enforceRateLimit(adminLimiter, `coverage:${admin.userId}`);

    // 1. Total keys actives
    const [{ total }] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(i18nTranslationKeys)
      .where(eq(i18nTranslationKeys.isActive, true));

    // 2. Locales activées
    const locales = await db
      .select()
      .from(i18nLocales)
      .where(eq(i18nLocales.enabled, true));

    // 3. Per-locale coverage
    const localeStats = await Promise.all(
      locales.map(async (loc) => {
        const [{ translated, lastReview }] = await db
          .select({
            translated: sql<number>`count(*)::int`,
            lastReview: sql<string>`max(${i18nTranslationValues.updatedAt})::text`,
          })
          .from(i18nTranslationValues)
          .innerJoin(i18nTranslationKeys, eq(i18nTranslationValues.key, i18nTranslationKeys.key))
          .where(and(
            eq(i18nTranslationValues.locale, loc.code),
            eq(i18nTranslationKeys.isActive, true),
          ));

        return {
          code: loc.code,
          total,
          translated,
          percentage: total > 0 ? Math.round((translated / total) * 100) : 0,
          lastReviewedAt: lastReview ?? null,
        };
      })
    );

    // 4. By namespace
    const byNamespaceRaw = await db
      .select({
        namespace: i18nTranslationKeys.namespace,
        locale: i18nTranslationValues.locale,
        count: sql<number>`count(*)::int`,
      })
      .from(i18nTranslationKeys)
      .leftJoin(i18nTranslationValues, eq(i18nTranslationValues.key, i18nTranslationKeys.key))
      .where(eq(i18nTranslationKeys.isActive, true))
      .groupBy(i18nTranslationKeys.namespace, i18nTranslationValues.locale);

    // Pivot
    const byNamespace = pivotByNamespace(byNamespaceRaw, total);

    // 5. Missing keys par locale
    const missing = await db
      .select({
        key: i18nTranslationKeys.key,
        locale: i18nTranslationValues.locale,
      })
      .from(i18nTranslationKeys)
      .leftJoin(i18nTranslationValues, eq(i18nTranslationValues.key, i18nTranslationKeys.key))
      .where(and(
        eq(i18nTranslationKeys.isActive, true),
        sql`${i18nTranslationValues.locale} IS NULL`,
      ));

    // Group by key
    const missingMap = new Map<string, string[]>();
    for (const row of missing) {
      const existing = missingMap.get(row.key) ?? [];
      existing.push(row.locale!);
      missingMap.set(row.key, existing);
    }

    return apiSuccess<CoverageResponse>({
      locales: localeStats,
      byNamespace,
      missingKeys: [...missingMap.entries()].map(([key, locales]) => ({ key, locales })),
    }, {
      headers: { 'Cache-Control': 'private, max-age=60' },
    });
  } catch (error) {
    return apiError(error);
  }
}

function pivotByNamespace(rows: Array<{ namespace: string; locale: string | null; count: number }>, total: number) {
  // Implementation détails : grouper par namespace, calculer % par locale
  // ...
  return [];
}
```

#### Exemple curl

```bash
curl -X GET 'https://femiglow.ma/api/i18n/coverage' \
  -H 'Cookie: admin_session=eyJhbGc...' \
  -H 'Accept: application/json' | jq

# Response 200
{
  "data": {
    "locales": [
      { "code": "fr", "total": 542, "translated": 542, "percentage": 100, "lastReviewedAt": "2026-05-27T10:00:00Z" },
      { "code": "ar", "total": 542, "translated": 423, "percentage": 78, "lastReviewedAt": "2026-05-15T10:00:00Z" },
      { "code": "en", "total": 542, "translated": 245, "percentage": 45, "lastReviewedAt": "2026-05-10T08:30:00Z" }
    ],
    "byNamespace": [
      { "namespace": "common", "fr": 100, "ar": 100, "en": 95 },
      { "namespace": "marketing", "fr": 100, "ar": 80, "en": 50 }
    ],
    "missingKeys": [
      { "key": "marketing.hero.cta_v2", "locales": ["ar", "en"] }
    ]
  },
  "meta": { "timestamp": "...", "version": "v1" }
}
```

#### Erreurs possibles

| Status | Code | Cause |
|---|---|---|
| 401 | `UNAUTHORIZED` | Session admin manquante ou expirée |
| 429 | `RATE_LIMITED` | > 60 req/min |
| 500 | `INTERNAL` | Erreur DB |

### 3.2 `GET /api/i18n/missing-keys?locale=ar`

**Description** : liste les clés manquantes pour une locale donnée (avec leur valeur source FR pour pouvoir traduire).

#### Implémentation

```ts
// apps/web/src/app/api/i18n/missing-keys/route.ts
import { z } from 'zod';
import { localeSchema, namespaceSchema } from '@/lib/api/i18n/schemas';

const querySchema = z.object({
  locale: localeSchema,
  namespace: namespaceSchema.optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    await enforceRateLimit(adminLimiter, `missing:${admin.userId}`);

    const params = querySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!params.success) {
      throw new ApiError('VALIDATION_ERROR', 'Invalid query params', params.error.flatten());
    }
    const { locale, namespace, limit } = params.data;

    // Vérifier que la locale existe et est activée
    const [localeRow] = await db.select().from(i18nLocales).where(eq(i18nLocales.code, locale)).limit(1);
    if (!localeRow) throw new ApiError('NOT_FOUND', `Locale '${locale}' not found`);

    // Récupérer les clés sans valeur pour cette locale
    const conditions = [
      eq(i18nTranslationKeys.isActive, true),
      sql`NOT EXISTS (
        SELECT 1 FROM ${i18nTranslationValues}
        WHERE ${i18nTranslationValues.key} = ${i18nTranslationKeys.key}
        AND ${i18nTranslationValues.locale} = ${locale}
      )`,
    ];
    if (namespace) conditions.push(eq(i18nTranslationKeys.namespace, namespace));

    const missing = await db
      .select({
        key: i18nTranslationKeys.key,
        namespace: i18nTranslationKeys.namespace,
        sourceFr: i18nTranslationKeys.sourceValue,
        description: i18nTranslationKeys.description,
        context: i18nTranslationKeys.context,
      })
      .from(i18nTranslationKeys)
      .where(and(...conditions))
      .limit(limit);

    return apiSuccess({
      locale,
      total: missing.length,
      missing,
    });
  } catch (error) {
    return apiError(error);
  }
}
```

#### Exemple curl

```bash
curl -X GET 'https://femiglow.ma/api/i18n/missing-keys?locale=ar&namespace=marketing&limit=50' \
  -H 'Cookie: admin_session=...'

# Response 200
{
  "data": {
    "locale": "ar",
    "total": 12,
    "missing": [
      {
        "key": "marketing.hero.cta_v2",
        "namespace": "marketing",
        "sourceFr": "Découvrir maintenant",
        "description": "CTA principal du hero, variant A/B",
        "context": "Page d'accueil section hero"
      }
    ]
  }
}
```

### 3.3 `POST /api/i18n/locale/switch`

**Description** : permet à un visiteur de switcher de locale. Cette route est publique et pose un cookie.

#### Implémentation

```ts
// apps/web/src/app/api/i18n/locale/switch/route.ts
import { z } from 'zod';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { LOCALES } from '@/i18n.config';

const bodySchema = z.object({
  locale: z.enum(LOCALES),
  redirectTo: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
    await enforceRateLimit(publicLimiter, `switch:${ip}`);

    const body = bodySchema.safeParse(await req.json());
    if (!body.success) {
      throw new ApiError('VALIDATION_ERROR', 'Invalid body', body.error.flatten());
    }

    const { locale, redirectTo } = body.data;

    // Set cookie NEXT_LOCALE
    cookies().set('NEXT_LOCALE', locale, {
      maxAge: 60 * 60 * 24 * 365, // 1 an
      path: '/',
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: false,
    });

    // Invalidate any locale-tagged cache
    revalidatePath('/', 'layout');

    return apiSuccess({
      locale,
      redirectTo: redirectTo ?? `/${locale}/`,
    });
  } catch (error) {
    return apiError(error);
  }
}
```

#### Exemple curl

```bash
curl -X POST 'https://femiglow.ma/api/i18n/locale/switch' \
  -H 'Content-Type: application/json' \
  -d '{"locale":"ar","redirectTo":"/ar/kit"}' \
  -v

# Response 200, avec Set-Cookie
< HTTP/2 200
< set-cookie: NEXT_LOCALE=ar; Path=/; Max-Age=31536000; SameSite=Lax; Secure
{
  "data": { "locale": "ar", "redirectTo": "/ar/kit" }
}
```

### 3.4 `POST /api/admin/i18n/upsert-message`

**Description** : crée ou met à jour une traduction pour une clé + locale.

#### Implémentation

```ts
// apps/web/src/app/api/admin/i18n/upsert-message/route.ts
import { z } from 'zod';
import { messageKeySchema, localeSchema } from '@/lib/api/i18n/schemas';
import { i18nTranslationKeys, i18nTranslationValues, i18nLocales } from '@/lib/db/schema';

const bodySchema = z.object({
  key: messageKeySchema,
  locale: localeSchema,
  value: z.string().min(1).max(5000),
  notes: z.string().max(500).optional(),
  reviewed: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    await enforceRateLimit(adminLimiter, `upsert:${admin.userId}`);

    const body = bodySchema.safeParse(await req.json());
    if (!body.success) {
      throw new ApiError('VALIDATION_ERROR', 'Invalid body', body.error.flatten());
    }
    const { key, locale, value, notes, reviewed } = body.data;

    // 1. Vérifier que la clé existe au catalog
    const [keyRow] = await db.select().from(i18nTranslationKeys).where(eq(i18nTranslationKeys.key, key)).limit(1);
    if (!keyRow) throw new ApiError('NOT_FOUND', `Key '${key}' not in catalog`);

    // 2. Vérifier locale activée
    const [localeRow] = await db.select().from(i18nLocales).where(and(
      eq(i18nLocales.code, locale),
      eq(i18nLocales.enabled, true),
    )).limit(1);
    if (!localeRow) throw new ApiError('NOT_FOUND', `Locale '${locale}' not enabled`);

    // 3. Upsert
    await db
      .insert(i18nTranslationValues)
      .values({
        key,
        locale,
        value,
        notes,
        reviewed,
        reviewedBy: reviewed ? admin.email : null,
        reviewedAt: reviewed ? new Date() : null,
      })
      .onConflictDoUpdate({
        target: [i18nTranslationValues.key, i18nTranslationValues.locale],
        set: {
          value,
          notes,
          reviewed,
          reviewedBy: reviewed ? admin.email : sql`${i18nTranslationValues.reviewedBy}`,
          reviewedAt: reviewed ? new Date() : sql`${i18nTranslationValues.reviewedAt}`,
          updatedAt: new Date(),
        },
      });

    // 4. Invalidate cache
    revalidateTag(`i18n-${locale}`);

    // 5. Audit log
    await auditLog({
      actor: admin.email,
      action: 'i18n.upsert_message',
      target: `${key}@${locale}`,
      metadata: { value, reviewed },
    });

    return apiSuccess({ key, locale, value, reviewed });
  } catch (error) {
    return apiError(error);
  }
}
```

#### Exemple curl

```bash
curl -X POST 'https://femiglow.ma/api/admin/i18n/upsert-message' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: admin_session=...' \
  -d '{
    "key": "marketing.hero.title",
    "locale": "ar",
    "value": "طقوس الأظافر في خمس دقائق.",
    "reviewed": true,
    "notes": "Revu par fondatrice 27/05"
  }'

# Response 200
{
  "data": {
    "key": "marketing.hero.title",
    "locale": "ar",
    "value": "طقوس الأظافر في خمس دقائق.",
    "reviewed": true
  }
}
```

### 3.5 `POST /api/admin/i18n/locales`

**Description** : CRUD sur les locales (create, update, enable, disable).

#### Implémentation

```ts
// apps/web/src/app/api/admin/i18n/locales/route.ts
import { z } from 'zod';

const createSchema = z.object({
  action: z.literal('create'),
  code: localeSchema,
  displayName: z.string().min(1).max(60),
  displayNameNative: z.string().min(1).max(60),
  direction: z.enum(['ltr', 'rtl']).default('ltr'),
  flagEmoji: z.string().max(8).optional(),
  fallbackLocale: localeSchema.nullable(),
  currencyCode: z.string().length(3).default('MAD'),
  enabled: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(100),
});

const updateSchema = z.object({
  action: z.literal('update'),
  code: localeSchema,
  displayName: z.string().min(1).max(60).optional(),
  displayNameNative: z.string().min(1).max(60).optional(),
  enabled: z.boolean().optional(),
  fallbackLocale: localeSchema.nullable().optional(),
  sortOrder: z.number().int().min(0).optional(),
});

const deleteSchema = z.object({
  action: z.literal('delete'),
  code: localeSchema,
});

const bodySchema = z.discriminatedUnion('action', [createSchema, updateSchema, deleteSchema]);

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    await enforceRateLimit(adminLimiter, `locales:${admin.userId}`);

    const body = bodySchema.safeParse(await req.json());
    if (!body.success) {
      throw new ApiError('VALIDATION_ERROR', 'Invalid body', body.error.flatten());
    }
    const parsed = body.data;

    if (parsed.action === 'create') {
      // Vérifier doublon
      const [existing] = await db.select().from(i18nLocales).where(eq(i18nLocales.code, parsed.code)).limit(1);
      if (existing) throw new ApiError('CONFLICT', `Locale '${parsed.code}' already exists`);

      // Vérifier fallback existe
      if (parsed.fallbackLocale) {
        const [fb] = await db.select().from(i18nLocales).where(eq(i18nLocales.code, parsed.fallbackLocale)).limit(1);
        if (!fb) throw new ApiError('VALIDATION_ERROR', `Fallback locale '${parsed.fallbackLocale}' does not exist`);
      }

      const [created] = await db.insert(i18nLocales).values({
        code: parsed.code,
        displayName: parsed.displayName,
        displayNameNative: parsed.displayNameNative,
        direction: parsed.direction,
        flagEmoji: parsed.flagEmoji,
        fallbackLocale: parsed.fallbackLocale,
        currencyCode: parsed.currencyCode,
        enabled: parsed.enabled,
        sortOrder: parsed.sortOrder,
      }).returning();

      revalidateTag('i18n-locales-config');
      await auditLog({ actor: admin.email, action: 'i18n.locale.create', target: parsed.code });

      return apiSuccess(created);
    }

    if (parsed.action === 'update') {
      const updates: Partial<typeof i18nLocales.$inferInsert> = { updatedAt: new Date() };
      if (parsed.displayName !== undefined) updates.displayName = parsed.displayName;
      if (parsed.displayNameNative !== undefined) updates.displayNameNative = parsed.displayNameNative;
      if (parsed.enabled !== undefined) updates.enabled = parsed.enabled;
      if (parsed.fallbackLocale !== undefined) updates.fallbackLocale = parsed.fallbackLocale;
      if (parsed.sortOrder !== undefined) updates.sortOrder = parsed.sortOrder;

      const [updated] = await db
        .update(i18nLocales)
        .set(updates)
        .where(eq(i18nLocales.code, parsed.code))
        .returning();

      if (!updated) throw new ApiError('NOT_FOUND', `Locale '${parsed.code}' not found`);

      revalidateTag('i18n-locales-config');
      await auditLog({ actor: admin.email, action: 'i18n.locale.update', target: parsed.code, metadata: updates });

      return apiSuccess(updated);
    }

    if (parsed.action === 'delete') {
      // Empêcher de supprimer une locale par défaut
      const [target] = await db.select().from(i18nLocales).where(eq(i18nLocales.code, parsed.code)).limit(1);
      if (!target) throw new ApiError('NOT_FOUND', `Locale '${parsed.code}' not found`);
      if (target.isDefault) throw new ApiError('CONFLICT', 'Cannot delete default locale');

      await db.delete(i18nLocales).where(eq(i18nLocales.code, parsed.code));

      revalidateTag('i18n-locales-config');
      await auditLog({ actor: admin.email, action: 'i18n.locale.delete', target: parsed.code });

      return apiSuccess({ deleted: parsed.code });
    }

    throw new ApiError('VALIDATION_ERROR', 'Unknown action');
  } catch (error) {
    return apiError(error);
  }
}
```

#### Exemples curl

```bash
# Create
curl -X POST 'https://femiglow.ma/api/admin/i18n/locales' \
  -H 'Content-Type: application/json' \
  -H 'Cookie: admin_session=...' \
  -d '{
    "action": "create",
    "code": "es",
    "displayName": "Spanish",
    "displayNameNative": "Español",
    "direction": "ltr",
    "fallbackLocale": "fr",
    "enabled": false,
    "flagEmoji": "🇪🇸"
  }'

# Update (enable)
curl -X POST 'https://femiglow.ma/api/admin/i18n/locales' \
  -H 'Cookie: admin_session=...' \
  -d '{"action":"update","code":"es","enabled":true}'

# Delete
curl -X POST 'https://femiglow.ma/api/admin/i18n/locales' \
  -H 'Cookie: admin_session=...' \
  -d '{"action":"delete","code":"es"}'
```

### 3.6 `GET /api/admin/i18n/export?locale=ar&format=csv`

**Description** : exporte les traductions pour traducteur externe (CSV ou JSON).

#### Implémentation

```ts
// apps/web/src/app/api/admin/i18n/export/route.ts
import { stringify } from 'csv-stringify/sync';

const exportSchema = z.object({
  locale: localeSchema,
  format: z.enum(['csv', 'json']).default('csv'),
  onlyMissing: z.coerce.boolean().optional().default(false),
  namespace: namespaceSchema.optional(),
});

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    await enforceRateLimit(heavyLimiter, `export:${admin.userId}`);

    const params = exportSchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
    if (!params.success) throw new ApiError('VALIDATION_ERROR', 'Invalid query', params.error.flatten());

    const { locale, format, onlyMissing, namespace } = params.data;

    // Build query
    const conditions = [eq(i18nTranslationKeys.isActive, true)];
    if (namespace) conditions.push(eq(i18nTranslationKeys.namespace, namespace));

    const rows = await db
      .select({
        key: i18nTranslationKeys.key,
        namespace: i18nTranslationKeys.namespace,
        sourceFr: i18nTranslationKeys.sourceValue,
        currentValue: i18nTranslationValues.value,
        description: i18nTranslationKeys.description,
        context: i18nTranslationKeys.context,
        reviewed: i18nTranslationValues.reviewed,
        notes: i18nTranslationValues.notes,
      })
      .from(i18nTranslationKeys)
      .leftJoin(i18nTranslationValues, and(
        eq(i18nTranslationValues.key, i18nTranslationKeys.key),
        eq(i18nTranslationValues.locale, locale),
      ))
      .where(and(...conditions));

    const filtered = onlyMissing ? rows.filter(r => !r.currentValue) : rows;

    await auditLog({
      actor: admin.email,
      action: 'i18n.export',
      target: locale,
      metadata: { format, onlyMissing, count: filtered.length },
    });

    if (format === 'csv') {
      const csv = stringify(filtered, {
        header: true,
        columns: ['key', 'namespace', 'sourceFr', 'currentValue', 'description', 'context', 'reviewed', 'notes'],
      });
      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="i18n-${locale}-${Date.now()}.csv"`,
        },
      });
    }

    // JSON format
    return new Response(JSON.stringify({ locale, count: filtered.length, rows: filtered }, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="i18n-${locale}-${Date.now()}.json"`,
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
```

#### Exemple curl

```bash
curl -X GET 'https://femiglow.ma/api/admin/i18n/export?locale=ar&format=csv&onlyMissing=true' \
  -H 'Cookie: admin_session=...' \
  -o ar-missing.csv

# Le fichier CSV est téléchargé. Contenu :
# key,namespace,sourceFr,currentValue,description,context,reviewed,notes
# marketing.hero.cta_v2,marketing,"Découvrir maintenant",,"CTA hero variant","Hero page d'accueil",,
```

### 3.7 `POST /api/admin/i18n/import`

**Description** : importe un CSV ou JSON traduit.

#### Implémentation

```ts
// apps/web/src/app/api/admin/i18n/import/route.ts
import { parse as parseCsv } from 'csv-parse/sync';

const importSchema = z.object({
  locale: localeSchema,
  format: z.enum(['csv', 'json']),
  dryRun: z.coerce.boolean().optional().default(false),
});

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    await enforceRateLimit(heavyLimiter, `import:${admin.userId}`);

    const formData = await req.formData();
    const file = formData.get('file');
    const meta = importSchema.safeParse({
      locale: formData.get('locale'),
      format: formData.get('format'),
      dryRun: formData.get('dryRun'),
    });

    if (!meta.success) throw new ApiError('VALIDATION_ERROR', 'Invalid metadata', meta.error.flatten());
    if (!(file instanceof File)) throw new ApiError('VALIDATION_ERROR', 'File missing');

    const { locale, format, dryRun } = meta.data;
    const text = await file.text();

    // Parse
    let records: Array<{ key: string; value: string; notes?: string; reviewed?: boolean }>;
    if (format === 'csv') {
      const parsed = parseCsv(text, { columns: true, skip_empty_lines: true });
      records = parsed.map((r: any) => ({
        key: r.key,
        value: r.currentValue ?? r.value ?? '',
        notes: r.notes,
        reviewed: r.reviewed === 'true',
      }));
    } else {
      const parsed = JSON.parse(text);
      records = Array.isArray(parsed) ? parsed : parsed.rows ?? [];
    }

    // Validate + collect errors
    const results = { imported: 0, skipped: 0, errors: [] as Array<{ key: string; reason: string }> };
    const validRecords: typeof records = [];

    for (const rec of records) {
      if (!rec.key || !rec.value) {
        results.skipped++;
        continue;
      }
      const keyCheck = messageKeySchema.safeParse(rec.key);
      if (!keyCheck.success) {
        results.errors.push({ key: rec.key, reason: 'invalid key format' });
        continue;
      }
      // Vérifier que la clé existe dans le catalog
      const [keyRow] = await db.select().from(i18nTranslationKeys).where(eq(i18nTranslationKeys.key, rec.key)).limit(1);
      if (!keyRow) {
        results.errors.push({ key: rec.key, reason: 'key not in catalog' });
        continue;
      }
      if (rec.value.length > 5000) {
        results.errors.push({ key: rec.key, reason: 'value too long (>5000 chars)' });
        continue;
      }
      validRecords.push(rec);
    }

    // Batch insert
    if (!dryRun && validRecords.length > 0) {
      const now = new Date();
      // Drizzle batch
      for (const rec of validRecords) {
        await db.insert(i18nTranslationValues).values({
          key: rec.key,
          locale,
          value: rec.value,
          notes: rec.notes,
          reviewed: rec.reviewed ?? false,
          reviewedBy: rec.reviewed ? admin.email : null,
          reviewedAt: rec.reviewed ? now : null,
        }).onConflictDoUpdate({
          target: [i18nTranslationValues.key, i18nTranslationValues.locale],
          set: {
            value: rec.value,
            notes: rec.notes,
            updatedAt: now,
            reviewed: rec.reviewed ?? false,
            reviewedBy: rec.reviewed ? admin.email : sql`${i18nTranslationValues.reviewedBy}`,
            reviewedAt: rec.reviewed ? now : sql`${i18nTranslationValues.reviewedAt}`,
          },
        });
        results.imported++;
      }
      revalidateTag(`i18n-${locale}`);
    } else {
      results.imported = validRecords.length;
    }

    await auditLog({
      actor: admin.email,
      action: dryRun ? 'i18n.import.dry_run' : 'i18n.import',
      target: locale,
      metadata: results,
    });

    return apiSuccess(results);
  } catch (error) {
    return apiError(error);
  }
}
```

#### Exemple curl

```bash
# Import CSV (test à blanc d'abord)
curl -X POST 'https://femiglow.ma/api/admin/i18n/import' \
  -H 'Cookie: admin_session=...' \
  -F 'file=@ar-translated.csv' \
  -F 'locale=ar' \
  -F 'format=csv' \
  -F 'dryRun=true'

# Response 200
{
  "data": {
    "imported": 245,
    "skipped": 12,
    "errors": [
      { "key": "marketing.invalid_key", "reason": "key not in catalog" },
      { "key": "wizard.too_long", "reason": "value too long (>5000 chars)" }
    ]
  }
}

# Si OK, lancer pour de vrai (dryRun=false)
curl -X POST 'https://femiglow.ma/api/admin/i18n/import' \
  -H 'Cookie: admin_session=...' \
  -F 'file=@ar-translated.csv' \
  -F 'locale=ar' \
  -F 'format=csv' \
  -F 'dryRun=false'
```

## 4. Sécurité

### 4.1 Auth

| Endpoint | Auth requise |
|---|---|
| `/api/i18n/coverage` | Admin (JWT cookie `admin_session`) |
| `/api/i18n/missing-keys` | Admin |
| `/api/i18n/locale/switch` | Public (rate-limit IP) |
| `/api/admin/i18n/*` | Admin |

### 4.2 Audit log

Tous les endpoints admin write doivent appeler `auditLog()` :

```ts
// apps/web/src/lib/audit/log.ts
export async function auditLog(entry: {
  actor: string;
  action: string;
  target: string;
  metadata?: unknown;
}) {
  await db.insert(auditEntries).values({
    actor: entry.actor,
    action: entry.action,
    target: entry.target,
    metadata: entry.metadata,
    timestamp: new Date(),
    ip: headers().get('x-forwarded-for'),
    userAgent: headers().get('user-agent'),
  });
}
```

### 4.3 CORS

Les endpoints sont same-origin only. Bloquer les autres origines via headers :

```ts
// next.config.mjs ou middleware
{
  source: '/api/admin/i18n/:path*',
  headers: [
    { key: 'Access-Control-Allow-Origin', value: 'https://femiglow.ma' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
  ],
}
```

### 4.4 Input sanitization

- Tous les inputs passent par Zod (validation stricte)
- Les valeurs string sont limitées (`max(5000)`)
- Pas d'eval, pas d'interpolation directe dans les queries (Drizzle paramétrise)
- Les imports CSV sont parsés via `csv-parse` (pas de regex maison)

## 5. Anti-patterns

1. **Exposer `/api/admin/*` sans auth** : tout endpoint admin DOIT vérifier `requireAdmin()` AVANT toute autre logique.
2. **Renvoyer le stack trace en prod** : `apiError` retourne uniquement `message` et `code`, jamais la stack.
3. **Cache CDN sur endpoint admin** : `Cache-Control: private` (jamais `public`) sur les routes auth.
4. **Pas de rate-limit sur l'import** : un attaquant pourrait DOS la DB avec un CSV de 100k lignes — limiter à 5/min ET valider la taille de fichier (`< 1 MB`).
5. **Oublier `revalidateTag` après upsert** : la donnée reste obsolète dans le cache RSC pendant 5 min.
6. **Logger les valeurs sensibles** : ne pas log les `value` traduits dans l'audit (peut contenir des données utilisateur final). Logger juste la `key`.

## 6. Headers de réponse standardisés

```ts
// Pour endpoints admin (jamais cacheable côté CDN public)
'Cache-Control': 'private, no-store, max-age=0'

// Pour endpoint public (locale switch)
'Cache-Control': 'no-store'

// Pour coverage (admin mais cacheable user-side)
'Cache-Control': 'private, max-age=60'

// Pour export (download)
'Cache-Control': 'private, no-store'
'Content-Disposition': 'attachment; filename="..."'
```

## 7. Versioning des API

Toutes les routes incluent `meta.version` dans la réponse. Si breaking change :

1. Créer `/api/i18n/v2/coverage` en parallèle
2. Garder v1 pendant 90 jours (deprecation header)
3. Retirer v1 après migration des consumers

Header de déprécation :
```http
Deprecation: true
Sunset: Wed, 27 Aug 2026 00:00:00 GMT
Link: </api/i18n/v2/coverage>; rel="successor-version"
```

## 8. OpenAPI spec

Générer un OpenAPI 3.1 spec depuis les schémas Zod via `zod-to-openapi` :

```ts
// scripts/generate-openapi.ts
import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { bodySchema as upsertSchema } from '@/app/api/admin/i18n/upsert-message/route';

const registry = new OpenAPIRegistry();
registry.registerPath({
  method: 'post',
  path: '/api/admin/i18n/upsert-message',
  // ... auto-generated from Zod
});

const generator = new OpenApiGeneratorV31(registry.definitions);
const spec = generator.generateDocument({
  openapi: '3.1.0',
  info: { title: 'FemiGlow i18n API', version: '1.0.0' },
});
```

Publier sur `/docs/api/i18n-openapi.json` (admin-only).

## 9. Checklist à tester / à vérifier

### Endpoints publics
- [ ] `POST /api/i18n/locale/switch` accepte `fr`, `ar`, `en`
- [ ] `POST /api/i18n/locale/switch` rejette `xx` (422)
- [ ] `POST /api/i18n/locale/switch` pose bien le cookie `NEXT_LOCALE`
- [ ] Rate limit 30/min/IP fonctionne sur `/api/i18n/locale/switch`

### Endpoints admin
- [ ] `/api/i18n/coverage` retourne 401 sans cookie admin
- [ ] `/api/i18n/coverage` retourne 200 avec stats correctes pour `fr, ar, en`
- [ ] `/api/i18n/missing-keys?locale=ar` retourne uniquement les clés non traduites
- [ ] `/api/i18n/missing-keys?locale=xx` retourne 404
- [ ] `/api/admin/i18n/upsert-message` rejette une clé hors catalog (404)
- [ ] `/api/admin/i18n/upsert-message` invalide cache `i18n-ar` après update
- [ ] `/api/admin/i18n/locales action=create` rejette duplicate (409)
- [ ] `/api/admin/i18n/locales action=delete` refuse de supprimer la default (409)
- [ ] `/api/admin/i18n/export?format=csv` télécharge un CSV valide UTF-8 (BOM optionnel)
- [ ] `/api/admin/i18n/export?onlyMissing=true` retourne uniquement les clés sans traduction
- [ ] `/api/admin/i18n/import dryRun=true` ne touche pas la DB
- [ ] `/api/admin/i18n/import` rejette un fichier > 1 MB (413)
- [ ] `/api/admin/i18n/import` retourne les errors par clé invalide

### Sécurité
- [ ] Tous les endpoints `/api/admin/*` ont `requireAdmin()` en première ligne
- [ ] Tous les inputs passent par Zod
- [ ] `auditLog` est appelé sur create/update/delete
- [ ] Rate-limit Redis fonctionne (test : 61 req/min admin → 429)
- [ ] `Cache-Control: private` sur tous les admin endpoints

### Performance
- [ ] `/api/i18n/coverage` < 200ms (test sur DB seed)
- [ ] `/api/i18n/missing-keys` < 200ms
- [ ] `/api/admin/i18n/export` < 2s pour 500 clés

## 10. Références croisées

- Signatures : [`02-design-conception/api-contracts.md`](../02-design-conception/api-contracts.md)
- Schémas DB : [`02-design-conception/data-model.md`](../02-design-conception/data-model.md)
- Workflow admin : [`./content-translation.md`](./content-translation.md)
- Tests d'intégration : [`07-tests/integration-tests.md`](../07-tests/integration-tests.md)
- Monitoring API : [`10-monitoring/api-i18n-dashboards.md`](../10-monitoring/api-i18n-dashboards.md)
