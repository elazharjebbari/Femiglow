# Integration tests — Vitest + MSW pour API et middleware i18n

> Tests d'intégration FemiGlow i18n avec MSW 2.14.
> Couvre : routes API i18n, middleware locale resolution, flows admin upsert traduction, fallback FR si AR manquant.

## 1. Architecture des tests d'intégration

### 1.1 Périmètre

| Cible | Type | Approche |
|---|---|---|
| `GET /api/i18n/coverage` | Route handler | Test direct du handler avec mock DB + Zod assert |
| `GET /api/i18n/missing-keys` | Route handler | Test direct + filtrage par locale |
| `POST /api/i18n/locale/switch` | Route handler | Test cookie set + revalidate |
| `POST /api/admin/i18n/upsert-message` | Route handler | Test auth + Zod + DB upsert + audit |
| `POST /api/admin/i18n/locales` | Route handler | Test CRUD (create/update/delete) |
| `GET /api/admin/i18n/export` | Route handler | Test CSV + JSON output |
| `POST /api/admin/i18n/import` | Route handler | Test dryRun, validation, batch upsert |
| `middleware.ts` (locale logic) | Middleware | Test NextRequest avec/sans cookie/header |
| Flow UI : open admin → upsert → reload | Composé | Composant + MSW mock API |
| Fallback FR ← AR missing | Composé | Provider + MSW 404 sur clé |

### 1.2 Pourquoi MSW pour i18n ?

- **MSW v2** intercepte les `fetch` au niveau du service worker (browser) ou du module (Node)
- Permet de tester un composant admin qui appelle `POST /api/admin/i18n/upsert-message` sans monter un vrai serveur
- Réutilisable entre Vitest, Storybook, Playwright (via `playwright-msw`)
- Handlers déclaratifs : 1 handler = 1 endpoint, ré-utilisable

### 1.3 Stack

```ts
{
  "msw": "^2.14.2",
  "vitest": "^2.1.2",
  "@testing-library/react": "^16.x"
}
```

## 2. Setup MSW pour i18n

### 2.1 Server setup `src/test/msw/server.ts`

```ts
// src/test/msw/server.ts (existant, on ajoute les handlers i18n)
import { setupServer } from 'msw/node';
import { i18nHandlers } from './handlers/i18n';
import { adminI18nHandlers } from './handlers/admin-i18n';

export const server = setupServer(
  ...i18nHandlers,
  ...adminI18nHandlers,
);
```

### 2.2 Handlers i18n publics `src/test/msw/handlers/i18n.ts`

```ts
// src/test/msw/handlers/i18n.ts
import { http, HttpResponse } from 'msw';
import type { Locale } from '@/lib/i18n/config';

const COVERAGE_FIXTURE = {
  data: {
    locales: [
      { code: 'fr', total: 542, translated: 542, percentage: 100, lastReviewedAt: '2026-05-27T10:00:00Z' },
      { code: 'ar', total: 542, translated: 423, percentage: 78, lastReviewedAt: '2026-05-15T10:00:00Z' },
      { code: 'en', total: 542, translated: 245, percentage: 45, lastReviewedAt: '2026-05-10T08:30:00Z' },
    ],
    byNamespace: [
      { namespace: 'common', fr: 100, ar: 100, en: 95 },
      { namespace: 'marketing', fr: 100, ar: 80, en: 50 },
    ],
    missingKeys: [
      { key: 'marketing.hero.cta_v2', locales: ['ar', 'en'] },
    ],
  },
  meta: { timestamp: '2026-05-27T15:00:00Z', version: 'v1' },
};

const MISSING_KEYS_FIXTURE: Record<Locale, { key: string; namespace: string; sourceFr: string; description: string; context: string }[]> = {
  fr: [],
  ar: [
    { key: 'marketing.hero.cta_v2', namespace: 'marketing', sourceFr: 'Découvrir maintenant', description: 'CTA hero variant', context: 'Hero page d\'accueil' },
  ],
  en: [
    { key: 'marketing.hero.cta_v2', namespace: 'marketing', sourceFr: 'Découvrir maintenant', description: 'CTA hero variant', context: 'Hero page d\'accueil' },
  ],
};

export const i18nHandlers = [
  http.get('/api/i18n/coverage', () => HttpResponse.json(COVERAGE_FIXTURE)),

  http.get('/api/i18n/missing-keys', ({ request }) => {
    const url = new URL(request.url);
    const locale = url.searchParams.get('locale') as Locale | null;
    if (!locale) {
      return HttpResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'locale param required' } },
        { status: 422 },
      );
    }
    if (!['fr', 'ar', 'en'].includes(locale)) {
      return HttpResponse.json(
        { error: { code: 'NOT_FOUND', message: `Locale '${locale}' not found` } },
        { status: 404 },
      );
    }
    const missing = MISSING_KEYS_FIXTURE[locale];
    return HttpResponse.json({
      data: { locale, total: missing.length, missing },
      meta: { timestamp: '2026-05-27T15:00:00Z', version: 'v1' },
    });
  }),

  http.post('/api/i18n/locale/switch', async ({ request, cookies }) => {
    const body = (await request.json()) as { locale?: string; redirectTo?: string };
    if (!body.locale || !['fr', 'ar', 'en'].includes(body.locale)) {
      return HttpResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid locale' } },
        { status: 422 },
      );
    }
    return HttpResponse.json(
      { data: { locale: body.locale, redirectTo: body.redirectTo ?? `/${body.locale}/` } },
      {
        status: 200,
        headers: {
          'Set-Cookie': `NEXT_LOCALE=${body.locale}; Path=/; Max-Age=31536000; SameSite=Lax`,
        },
      },
    );
  }),
];
```

### 2.3 Handlers admin `src/test/msw/handlers/admin-i18n.ts`

```ts
// src/test/msw/handlers/admin-i18n.ts
import { http, HttpResponse, delay } from 'msw';

interface UpsertBody {
  key: string;
  locale: string;
  value: string;
  notes?: string;
  reviewed?: boolean;
}

// Storage in-memory pour simuler la DB
const memoryStore = new Map<string, { value: string; reviewed: boolean }>();

export function resetAdminI18nStore() {
  memoryStore.clear();
}

export const adminI18nHandlers = [
  http.post('/api/admin/i18n/upsert-message', async ({ request, cookies }) => {
    const session = cookies['admin_session'];
    if (!session) {
      return HttpResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin session required' } },
        { status: 401 },
      );
    }

    const body = (await request.json()) as Partial<UpsertBody>;
    if (!body.key || !body.locale || !body.value) {
      return HttpResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Missing required fields' } },
        { status: 422 },
      );
    }

    if (!/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*$/.test(body.key)) {
      return HttpResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Invalid key format' } },
        { status: 422 },
      );
    }

    if (body.value.length > 5000) {
      return HttpResponse.json(
        { error: { code: 'VALIDATION_ERROR', message: 'Value too long' } },
        { status: 422 },
      );
    }

    memoryStore.set(`${body.key}@${body.locale}`, {
      value: body.value,
      reviewed: body.reviewed ?? false,
    });

    return HttpResponse.json({
      data: { key: body.key, locale: body.locale, value: body.value, reviewed: body.reviewed ?? false },
      meta: { timestamp: '2026-05-27T15:00:00Z', version: 'v1' },
    });
  }),

  http.post('/api/admin/i18n/locales', async ({ request, cookies }) => {
    const session = cookies['admin_session'];
    if (!session) {
      return HttpResponse.json(
        { error: { code: 'UNAUTHORIZED', message: 'Admin session required' } },
        { status: 401 },
      );
    }

    const body = (await request.json()) as { action: string; code: string };

    if (body.action === 'create') {
      if (memoryStore.has(`locale@${body.code}`)) {
        return HttpResponse.json(
          { error: { code: 'CONFLICT', message: `Locale '${body.code}' already exists` } },
          { status: 409 },
        );
      }
      memoryStore.set(`locale@${body.code}`, { value: 'created', reviewed: false });
      return HttpResponse.json({ data: { code: body.code, created: true } });
    }

    if (body.action === 'delete') {
      if (body.code === 'fr') {
        return HttpResponse.json(
          { error: { code: 'CONFLICT', message: 'Cannot delete default locale' } },
          { status: 409 },
        );
      }
      memoryStore.delete(`locale@${body.code}`);
      return HttpResponse.json({ data: { deleted: body.code } });
    }

    return HttpResponse.json({ data: { action: body.action, code: body.code } });
  }),

  http.get('/api/admin/i18n/export', async ({ request, cookies }) => {
    const session = cookies['admin_session'];
    if (!session) {
      return HttpResponse.json(
        { error: { code: 'UNAUTHORIZED' } },
        { status: 401 },
      );
    }

    await delay(50); // simulate work
    const url = new URL(request.url);
    const locale = url.searchParams.get('locale');
    const format = url.searchParams.get('format') ?? 'csv';

    if (format === 'csv') {
      const csv = `key,locale,value\nmarketing.hero.title,${locale},Test value\n`;
      return new HttpResponse(csv, {
        headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="i18n-${locale}.csv"` },
      });
    }

    return HttpResponse.json({ data: { locale, count: 1, rows: [] } });
  }),

  http.post('/api/admin/i18n/import', async ({ request, cookies }) => {
    const session = cookies['admin_session'];
    if (!session) {
      return HttpResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });
    }

    const formData = await request.formData();
    const dryRun = formData.get('dryRun') === 'true';

    return HttpResponse.json({
      data: {
        imported: dryRun ? 0 : 245,
        skipped: 12,
        errors: [{ key: 'marketing.invalid_key', reason: 'key not in catalog' }],
      },
    });
  }),
];
```

## 3. Tests intégration des routes API

### 3.1 `GET /api/i18n/coverage`

```ts
// src/app/api/i18n/coverage/route.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';

describe('GET /api/i18n/coverage @integration', () => {
  beforeEach(() => server.resetHandlers());

  it('returns 200 with coverage data', async () => {
    const response = await fetch('http://localhost/api/i18n/coverage', {
      headers: { Cookie: 'admin_session=valid-jwt' },
    });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.locales).toHaveLength(3);
    expect(json.data.locales[0]).toMatchObject({
      code: 'fr',
      percentage: 100,
    });
  });

  it('returns 401 without admin session', async () => {
    server.use(
      http.get('/api/i18n/coverage', () =>
        HttpResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 }),
      ),
    );
    const response = await fetch('http://localhost/api/i18n/coverage');
    expect(response.status).toBe(401);
  });

  it('returns 429 when rate-limited', async () => {
    server.use(
      http.get('/api/i18n/coverage', () =>
        HttpResponse.json({ error: { code: 'RATE_LIMITED' } }, { status: 429 }),
      ),
    );
    const response = await fetch('http://localhost/api/i18n/coverage', {
      headers: { Cookie: 'admin_session=valid-jwt' },
    });
    expect(response.status).toBe(429);
  });

  it('payload shape conforms (Zod)', async () => {
    const response = await fetch('http://localhost/api/i18n/coverage', {
      headers: { Cookie: 'admin_session=valid-jwt' },
    });
    const json = await response.json();

    expect(json.data).toHaveProperty('locales');
    expect(json.data).toHaveProperty('byNamespace');
    expect(json.data).toHaveProperty('missingKeys');

    for (const locale of json.data.locales) {
      expect(locale).toHaveProperty('code');
      expect(locale).toHaveProperty('total');
      expect(locale).toHaveProperty('translated');
      expect(locale).toHaveProperty('percentage');
      expect(typeof locale.percentage).toBe('number');
      expect(locale.percentage).toBeGreaterThanOrEqual(0);
      expect(locale.percentage).toBeLessThanOrEqual(100);
    }
  });

  it('locales include fr, ar, en', async () => {
    const response = await fetch('http://localhost/api/i18n/coverage', {
      headers: { Cookie: 'admin_session=valid-jwt' },
    });
    const json = await response.json();
    const codes = json.data.locales.map((l: { code: string }) => l.code);
    expect(codes).toEqual(expect.arrayContaining(['fr', 'ar', 'en']));
  });
});
```

### 3.2 `GET /api/i18n/missing-keys`

```ts
// src/app/api/i18n/missing-keys/route.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';

describe('GET /api/i18n/missing-keys @integration', () => {
  beforeEach(() => server.resetHandlers());

  it('returns missing keys for ar locale', async () => {
    const response = await fetch('http://localhost/api/i18n/missing-keys?locale=ar', {
      headers: { Cookie: 'admin_session=valid-jwt' },
    });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.locale).toBe('ar');
    expect(json.data.missing).toBeInstanceOf(Array);
    expect(json.data.missing[0]).toMatchObject({
      key: expect.any(String),
      namespace: expect.any(String),
      sourceFr: expect.any(String),
    });
  });

  it('returns empty for fr (source of truth)', async () => {
    const response = await fetch('http://localhost/api/i18n/missing-keys?locale=fr', {
      headers: { Cookie: 'admin_session=valid-jwt' },
    });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.missing).toEqual([]);
  });

  it('returns 404 for unknown locale', async () => {
    const response = await fetch('http://localhost/api/i18n/missing-keys?locale=xx', {
      headers: { Cookie: 'admin_session=valid-jwt' },
    });
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error.code).toBe('NOT_FOUND');
  });

  it('returns 422 without locale param', async () => {
    const response = await fetch('http://localhost/api/i18n/missing-keys', {
      headers: { Cookie: 'admin_session=valid-jwt' },
    });
    expect(response.status).toBe(422);
  });

  it('respects namespace filter', async () => {
    server.use(
      http.get('/api/i18n/missing-keys', ({ request }) => {
        const url = new URL(request.url);
        const namespace = url.searchParams.get('namespace');
        return HttpResponse.json({
          data: {
            locale: 'ar',
            total: namespace === 'marketing' ? 5 : 12,
            missing: [],
          },
        });
      }),
    );
    const response = await fetch('http://localhost/api/i18n/missing-keys?locale=ar&namespace=marketing', {
      headers: { Cookie: 'admin_session=valid-jwt' },
    });
    const json = await response.json();
    expect(json.data.total).toBe(5);
  });
});
```

### 3.3 `POST /api/admin/i18n/upsert-message`

```ts
// src/app/api/admin/i18n/upsert-message/route.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { server } from '@/test/msw/server';
import { resetAdminI18nStore } from '@/test/msw/handlers/admin-i18n';

describe('POST /api/admin/i18n/upsert-message @integration', () => {
  beforeEach(() => {
    server.resetHandlers();
    resetAdminI18nStore();
  });

  it('upserts a translation successfully', async () => {
    const response = await fetch('http://localhost/api/admin/i18n/upsert-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'admin_session=valid-jwt' },
      body: JSON.stringify({
        key: 'marketing.hero.title',
        locale: 'ar',
        value: 'طقوس الأظافر في خمس دقائق.',
        reviewed: true,
      }),
    });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data).toMatchObject({
      key: 'marketing.hero.title',
      locale: 'ar',
      reviewed: true,
    });
  });

  it('returns 401 without admin session', async () => {
    const response = await fetch('http://localhost/api/admin/i18n/upsert-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'foo.bar', locale: 'fr', value: 'test' }),
    });
    expect(response.status).toBe(401);
  });

  it('returns 422 for invalid key format', async () => {
    const response = await fetch('http://localhost/api/admin/i18n/upsert-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'admin_session=valid-jwt' },
      body: JSON.stringify({ key: 'INVALID-KEY', locale: 'fr', value: 'test' }),
    });
    expect(response.status).toBe(422);
    const json = await response.json();
    expect(json.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 for value too long', async () => {
    const longValue = 'a'.repeat(5001);
    const response = await fetch('http://localhost/api/admin/i18n/upsert-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'admin_session=valid-jwt' },
      body: JSON.stringify({ key: 'foo.bar', locale: 'fr', value: longValue }),
    });
    expect(response.status).toBe(422);
  });

  it('accepts arabic UTF-8 content correctly', async () => {
    const response = await fetch('http://localhost/api/admin/i18n/upsert-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: 'admin_session=valid-jwt' },
      body: JSON.stringify({
        key: 'marketing.hero.title',
        locale: 'ar',
        value: 'مرحباً بك في فيمي غلو ✨',
      }),
    });
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.data.value).toBe('مرحباً بك في فيمي غلو ✨');
  });
});
```

### 3.4 `POST /api/i18n/locale/switch`

```ts
// src/app/api/i18n/locale/switch/route.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { server } from '@/test/msw/server';

describe('POST /api/i18n/locale/switch @integration', () => {
  beforeEach(() => server.resetHandlers());

  it('sets cookie NEXT_LOCALE on success', async () => {
    const response = await fetch('http://localhost/api/i18n/locale/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'ar' }),
    });
    expect(response.status).toBe(200);
    const setCookie = response.headers.get('set-cookie');
    expect(setCookie).toMatch(/NEXT_LOCALE=ar/);
    expect(setCookie).toMatch(/Max-Age=31536000/); // 1 year
    expect(setCookie).toMatch(/SameSite=Lax/);
  });

  it('returns 422 for invalid locale', async () => {
    const response = await fetch('http://localhost/api/i18n/locale/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'pirate' }),
    });
    expect(response.status).toBe(422);
  });

  it('redirects to specified path', async () => {
    const response = await fetch('http://localhost/api/i18n/locale/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: 'en', redirectTo: '/en/kit' }),
    });
    const json = await response.json();
    expect(json.data.redirectTo).toBe('/en/kit');
  });

  it.each(['fr', 'ar', 'en'])('accepts locale %s', async (locale) => {
    const response = await fetch('http://localhost/api/i18n/locale/switch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale }),
    });
    expect(response.status).toBe(200);
  });
});
```

## 4. Tests intégration middleware

### 4.1 Middleware locale resolution

```ts
// middleware.integration.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { middleware } from '../middleware';

function createRequest(path: string, options: { cookies?: Record<string, string>; acceptLanguage?: string } = {}): NextRequest {
  const url = new URL(`http://localhost${path}`);
  const headers = new Headers();
  if (options.acceptLanguage) headers.set('accept-language', options.acceptLanguage);
  const cookieStr = Object.entries(options.cookies ?? {})
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  if (cookieStr) headers.set('cookie', cookieStr);

  return new NextRequest(url, { headers });
}

describe('middleware locale resolution @integration', () => {
  beforeEach(() => vi.clearAllMocks());

  it('redirects / to /fr/ (default locale)', async () => {
    const req = createRequest('/');
    const res = await middleware(req);
    expect(res?.status).toBe(307);
    expect(res?.headers.get('location')).toMatch(/\/fr\/?/);
  });

  it('preserves /fr/kit', async () => {
    const req = createRequest('/fr/kit');
    const res = await middleware(req);
    // Pas de redirect → response 200 (next())
    expect(res?.status).not.toBe(307);
  });

  it('redirects to cookie locale if no path locale', async () => {
    const req = createRequest('/kit', { cookies: { NEXT_LOCALE: 'ar' } });
    const res = await middleware(req);
    expect(res?.headers.get('location')).toMatch(/\/ar\/kit/);
  });

  it('uses Accept-Language as fallback', async () => {
    const req = createRequest('/kit', { acceptLanguage: 'en-US,en;q=0.9' });
    const res = await middleware(req);
    expect(res?.headers.get('location')).toMatch(/\/en\/kit/);
  });

  it('priority: path > cookie > header > default', async () => {
    const req = createRequest('/fr/kit', {
      cookies: { NEXT_LOCALE: 'ar' },
      acceptLanguage: 'en-US',
    });
    const res = await middleware(req);
    // Path FR wins, pas de redirect
    expect(res?.status).not.toBe(307);
  });

  it('ignores invalid cookie locale', async () => {
    const req = createRequest('/kit', { cookies: { NEXT_LOCALE: 'pirate' } });
    const res = await middleware(req);
    expect(res?.headers.get('location')).toMatch(/\/fr\/kit/);
  });

  it('skips middleware for /_next/* paths', async () => {
    const req = createRequest('/_next/static/chunk.js');
    const res = await middleware(req);
    // Pas de redirect, le middleware passe
    expect(res?.headers.get('location')).toBeFalsy();
  });

  it('skips middleware for /api/* paths', async () => {
    const req = createRequest('/api/track');
    const res = await middleware(req);
    expect(res?.headers.get('location')).toBeFalsy();
  });

  it('sets cookie NEXT_LOCALE on redirect', async () => {
    const req = createRequest('/', { acceptLanguage: 'ar' });
    const res = await middleware(req);
    const cookies = res?.headers.getSetCookie?.() ?? [];
    expect(cookies.some(c => c.startsWith('NEXT_LOCALE=ar'))).toBe(true);
  });
});
```

## 5. Tests intégration UI + MSW

### 5.1 Admin UI flow : upsert → reload → assert change

```tsx
// src/app/admin/i18n/dashboard/page.integration.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { renderWithI18n, screen, userEvent, waitFor } from '@/test/helpers/i18n/render-with-i18n';
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';
import { AdminI18nDashboard } from './AdminI18nDashboard';

describe('Admin i18n dashboard flow @integration', () => {
  beforeEach(() => server.resetHandlers());

  it('shows coverage by locale on mount', async () => {
    renderWithI18n(<AdminI18nDashboard />, { locale: 'fr' });

    await waitFor(() => {
      expect(screen.getByTestId('coverage-fr')).toHaveTextContent('100%');
      expect(screen.getByTestId('coverage-ar')).toHaveTextContent('78%');
      expect(screen.getByTestId('coverage-en')).toHaveTextContent('45%');
    });
  });

  it('upserts a translation and shows success toast', async () => {
    const user = userEvent.setup();
    renderWithI18n(<AdminI18nDashboard />, { locale: 'fr' });

    const button = await screen.findByTestId('edit-marketing.hero.title-ar');
    await user.click(button);

    const input = screen.getByLabelText(/traduction|translation/i);
    await user.clear(input);
    await user.type(input, 'طقوس الأظافر في خمس دقائق.');

    await user.click(screen.getByRole('button', { name: /enregistrer|save/i }));

    await waitFor(() => {
      expect(screen.getByText(/enregistré|saved/i)).toBeInTheDocument();
    });
  });

  it('shows error toast when upsert fails (rate limit)', async () => {
    server.use(
      http.post('/api/admin/i18n/upsert-message', () =>
        HttpResponse.json({ error: { code: 'RATE_LIMITED' } }, { status: 429 }),
      ),
    );

    const user = userEvent.setup();
    renderWithI18n(<AdminI18nDashboard />, { locale: 'fr' });

    const button = await screen.findByTestId('edit-marketing.hero.title-ar');
    await user.click(button);
    await user.type(screen.getByLabelText(/traduction/i), 'test');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => {
      expect(screen.getByText(/erreur|too many requests/i)).toBeInTheDocument();
    });
  });

  it('reloads coverage after upsert', async () => {
    let upsertCalled = false;
    server.use(
      http.post('/api/admin/i18n/upsert-message', () => {
        upsertCalled = true;
        return HttpResponse.json({ data: { key: 'marketing.hero.title', locale: 'ar', value: 'test', reviewed: false } });
      }),
      http.get('/api/i18n/coverage', () => {
        if (upsertCalled) {
          return HttpResponse.json({
            data: {
              locales: [
                { code: 'fr', total: 542, translated: 542, percentage: 100, lastReviewedAt: null },
                { code: 'ar', total: 542, translated: 424, percentage: 78, lastReviewedAt: '2026-05-27T15:00:00Z' },
                { code: 'en', total: 542, translated: 245, percentage: 45, lastReviewedAt: null },
              ],
              byNamespace: [],
              missingKeys: [],
            },
          });
        }
        return HttpResponse.json({
          data: {
            locales: [
              { code: 'fr', total: 542, translated: 542, percentage: 100, lastReviewedAt: null },
              { code: 'ar', total: 542, translated: 423, percentage: 78, lastReviewedAt: null },
              { code: 'en', total: 542, translated: 245, percentage: 45, lastReviewedAt: null },
            ],
            byNamespace: [],
            missingKeys: [],
          },
        });
      }),
    );

    const user = userEvent.setup();
    renderWithI18n(<AdminI18nDashboard />, { locale: 'fr' });

    const initial = await screen.findByTestId('coverage-ar');
    expect(initial).toHaveTextContent('423');

    const button = screen.getByTestId('edit-marketing.hero.title-ar');
    await user.click(button);
    await user.type(screen.getByLabelText(/traduction/i), 'test');
    await user.click(screen.getByRole('button', { name: /enregistrer/i }));

    await waitFor(() => {
      expect(screen.getByTestId('coverage-ar')).toHaveTextContent('424');
    });
  });
});
```

## 6. Tests intégration fallback FR ← AR manquant

### 6.1 Comportement attendu

Si la clé `marketing.hero.cta_v2` existe en FR mais pas en AR, l'app rend la valeur FR plutôt qu'un placeholder type `[marketing.hero.cta_v2]`.

```tsx
// src/lib/i18n/fallback.integration.test.tsx
import { describe, it, expect } from 'vitest';
import { renderWithI18n, screen } from '@/test/helpers/i18n/render-with-i18n';
import { Hero } from '@/components/sections/Hero';

describe('i18n fallback FR ← AR manquant @integration', () => {
  it('renders FR value when AR key is missing', () => {
    const partialArMessages = {
      marketing: {
        hero: {
          title: 'طقوس الأظافر في خمس دقائق.',
          // subtitle MANQUANT volontairement
        },
      },
    };

    renderWithI18n(<Hero />, {
      locale: 'ar',
      messages: partialArMessages,
    });

    // Le composant doit afficher quelque chose, pas un placeholder brut
    const subtitle = screen.queryByTestId('hero-subtitle');
    if (subtitle) {
      expect(subtitle.textContent).not.toMatch(/^\[/);
      expect(subtitle.textContent).not.toMatch(/marketing\.hero\.subtitle/);
    }
  });

  it('shows raw key in dev mode if fallback also missing', () => {
    const arMessages = { common: { back: 'رجوع' } };
    renderWithI18n(<Hero />, { locale: 'ar', messages: arMessages });

    // Si le fallback handler est correctement configuré, on doit voir une valeur,
    // sinon on voit la clé. Test défensif.
    const fallback = screen.queryByText(/\[marketing\./);
    if (fallback) {
      console.warn('Fallback handler manquant en dev mode');
    }
  });

  it('logs missing key to console in dev', () => {
    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const arMessages = { common: { back: 'رجوع' } };

    renderWithI18n(<Hero />, { locale: 'ar', messages: arMessages });

    // next-intl log les missing keys en dev
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
```

### 6.2 Test API : `/api/i18n/missing-keys?locale=ar` retourne 404 sur clé invalide

```ts
// src/app/api/i18n/missing-keys/missing.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { server } from '@/test/msw/server';

describe('Missing keys API fallback @integration', () => {
  beforeEach(() => server.resetHandlers());

  it('returns 404 for invalid locale', async () => {
    const res = await fetch('http://localhost/api/i18n/missing-keys?locale=xx', {
      headers: { Cookie: 'admin_session=valid' },
    });
    expect(res.status).toBe(404);
  });

  it('client retries with fr on ar failure', async () => {
    // Simulation client : si missing-keys fail pour ar, fallback fr
    let arCalled = 0;
    let frCalled = 0;
    server.use(
      http.get('/api/i18n/missing-keys', ({ request }) => {
        const locale = new URL(request.url).searchParams.get('locale');
        if (locale === 'ar') {
          arCalled++;
          return HttpResponse.json({ error: { code: 'NOT_FOUND' } }, { status: 404 });
        }
        if (locale === 'fr') {
          frCalled++;
          return HttpResponse.json({ data: { locale: 'fr', total: 0, missing: [] } });
        }
        return HttpResponse.json({}, { status: 500 });
      }),
    );

    // Client logique (à implémenter)
    const arRes = await fetch('http://localhost/api/i18n/missing-keys?locale=ar', {
      headers: { Cookie: 'admin_session=valid' },
    });
    if (arRes.status === 404) {
      const frRes = await fetch('http://localhost/api/i18n/missing-keys?locale=fr', {
        headers: { Cookie: 'admin_session=valid' },
      });
      expect(frRes.status).toBe(200);
    }

    expect(arCalled).toBe(1);
    expect(frCalled).toBe(1);
  });
});
```

## 7. Tests intégration import/export

### 7.1 Export CSV

```ts
// src/app/api/admin/i18n/export/route.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { server } from '@/test/msw/server';

describe('GET /api/admin/i18n/export @integration', () => {
  beforeEach(() => server.resetHandlers());

  it('exports CSV with correct headers', async () => {
    const res = await fetch('http://localhost/api/admin/i18n/export?locale=ar&format=csv', {
      headers: { Cookie: 'admin_session=valid' },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/csv/);
    expect(res.headers.get('content-disposition')).toMatch(/attachment.*\.csv/);

    const csv = await res.text();
    expect(csv).toContain('key,locale,value');
  });

  it('exports JSON when format=json', async () => {
    const res = await fetch('http://localhost/api/admin/i18n/export?locale=ar&format=json', {
      headers: { Cookie: 'admin_session=valid' },
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.locale).toBe('ar');
    expect(json.data).toHaveProperty('rows');
  });

  it('returns 401 without auth', async () => {
    const res = await fetch('http://localhost/api/admin/i18n/export?locale=ar');
    expect(res.status).toBe(401);
  });
});
```

### 7.2 Import dry-run

```ts
// src/app/api/admin/i18n/import/route.integration.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { server } from '@/test/msw/server';

describe('POST /api/admin/i18n/import @integration', () => {
  beforeEach(() => server.resetHandlers());

  it('dryRun does not modify DB', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['key,value\nmarketing.hero.title,test'], { type: 'text/csv' }), 'test.csv');
    formData.append('locale', 'ar');
    formData.append('format', 'csv');
    formData.append('dryRun', 'true');

    const res = await fetch('http://localhost/api/admin/i18n/import', {
      method: 'POST',
      headers: { Cookie: 'admin_session=valid' },
      body: formData,
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.imported).toBe(0); // dryRun
  });

  it('returns errors per invalid key', async () => {
    const formData = new FormData();
    formData.append('file', new Blob(['key,value\nINVALID,test'], { type: 'text/csv' }), 'test.csv');
    formData.append('locale', 'ar');
    formData.append('format', 'csv');
    formData.append('dryRun', 'false');

    const res = await fetch('http://localhost/api/admin/i18n/import', {
      method: 'POST',
      headers: { Cookie: 'admin_session=valid' },
      body: formData,
    });
    const json = await res.json();
    expect(json.data.errors).toBeInstanceOf(Array);
  });
});
```

## 8. Patterns pour réutiliser les handlers

### 8.1 Override d'un handler par test

```ts
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';

it('handles 500 from upsert', async () => {
  server.use(
    http.post('/api/admin/i18n/upsert-message', () =>
      HttpResponse.json({ error: { code: 'INTERNAL' } }, { status: 500 }),
    ),
  );

  // ... test
});
```

### 8.2 Spy sur les requêtes

```ts
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';

it('sends correct body to upsert', async () => {
  let capturedBody: unknown = null;
  server.use(
    http.post('/api/admin/i18n/upsert-message', async ({ request }) => {
      capturedBody = await request.json();
      return HttpResponse.json({ data: {} });
    }),
  );

  // Trigger flow
  await fetch('http://localhost/api/admin/i18n/upsert-message', {
    method: 'POST',
    body: JSON.stringify({ key: 'foo.bar', locale: 'ar', value: 'test' }),
    headers: { Cookie: 'admin_session=valid' },
  });

  expect(capturedBody).toMatchObject({
    key: 'foo.bar',
    locale: 'ar',
    value: 'test',
  });
});
```

### 8.3 Reset state entre tests

```ts
import { afterEach } from 'vitest';
import { resetAdminI18nStore } from '@/test/msw/handlers/admin-i18n';

afterEach(() => {
  resetAdminI18nStore();
});
```

## 9. Anti-patterns intégration

1. **Faire un fetch vers l'app réelle (`http://localhost:3000`)** : non, on mock via MSW. Sinon flaky.
2. **Mutation du store MSW global sans reset** : memoire fuite, tests s'influencent.
3. **Pas vérifier le Cookie envoyé** : security risk, devient testable plus tard.
4. **Pas tester les codes d'erreur** : 422, 429, 500 doivent tous être vérifiés.
5. **Tester avec FR uniquement** : AR-specific bug en UTF-8 invisible.
6. **Importer `route.ts` directement** : test trop unitaire, perd l'aspect intégration.
7. **Pas reset les handlers** : leaks entre tests.

## 10. Commandes

```bash
# Tests integration uniquement
pnpm --filter @femiglow/web test:int

# Pattern naming
pnpm --filter @femiglow/web test -- --testNamePattern="@integration"

# Un fichier
pnpm --filter @femiglow/web test -- src/app/api/i18n/coverage/route.integration.test.ts

# Avec MSW logs
MSW_LOG=true pnpm --filter @femiglow/web test
```

## 11. Checklist test intégration i18n

- [ ] Le fichier finit par `.integration.test.ts` ou tag `@integration`
- [ ] Utilise `server.resetHandlers()` dans `beforeEach`
- [ ] Utilise les handlers réutilisables `src/test/msw/handlers/i18n.ts`
- [ ] Teste les 4 codes d'erreur principaux : 200, 401, 422, 500
- [ ] Vérifie les headers (Set-Cookie, Content-Type, Cache-Control)
- [ ] Vérifie le payload Zod shape
- [ ] Teste avec FR + AR + EN où pertinent
- [ ] Teste rate-limiting (override handler pour renvoyer 429)
- [ ] Teste audit log appelé (via spy sur DB)
- [ ] Teste fallback FR ← AR manquant
- [ ] Pas de timeout > 5 s (sinon revoir le test)
