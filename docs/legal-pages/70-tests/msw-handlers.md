# 70.4 — MSW handlers

## Setup

```typescript
// test/msw/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

```typescript
// test/setup.ts
import '@/test/msw/server';
```

## Handlers admin

```typescript
// test/msw/handlers/legal-admin.ts
import { http, HttpResponse } from 'msw';
import { FX_PAGES, FX_VARS, FX_ZONES } from '@/test/legal-fixtures';

export const legalAdminHandlers = [
  // GET liste
  http.get('/api/admin/legal', () => HttpResponse.json(Object.values(FX_PAGES))),

  // GET détail
  http.get('/api/admin/legal/:slug', ({ params }) => {
    const page = FX_PAGES[params.slug as string];
    if (!page) return HttpResponse.json(null, { status: 404 });
    return HttpResponse.json(page);
  }),

  // PUT draft save
  http.put('/api/admin/legal/:slug', async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({
      ...FX_PAGES[params.slug as string],
      ...body,
      updated_at: new Date().toISOString(),
    });
  }),

  // POST publish
  http.post('/api/admin/legal/:slug/publish', async ({ params, request }) => {
    const body = (await request.json()) as { confirm: string };
    if (body.confirm !== 'PUBLIER') {
      return HttpResponse.json({ error: 'confirm_mismatch' }, { status: 400 });
    }
    const page = FX_PAGES[params.slug as string];
    return HttpResponse.json({
      slug: page.slug,
      version: page.version + 1,
      status: 'published',
      published_at: new Date().toISOString(),
    });
  }),

  // POST submit review
  http.post('/api/admin/legal/:slug/submit-review', ({ params }) => {
    return HttpResponse.json({ slug: params.slug, status: 'review' });
  }),

  // POST archive
  http.post('/api/admin/legal/:slug/archive', ({ params }) => {
    return HttpResponse.json({ slug: params.slug, status: 'archived' });
  }),

  // GET history
  http.get('/api/admin/legal/:slug/history', () =>
    HttpResponse.json([
      { version: 5, published_at: '2026-04-01T00:00:00Z', published_by: 'u_admin1' },
      { version: 4, published_at: '2026-03-15T00:00:00Z', published_by: 'u_admin1' },
      { version: 3, published_at: '2026-02-10T00:00:00Z', published_by: 'u_admin1' },
    ]),
  ),

  // Template vars
  http.get('/api/admin/legal/template-vars', () =>
    HttpResponse.json(
      Object.entries(FX_VARS).map(([key, value]) => ({
        key,
        value,
        is_required: ['COMPANY_RC', 'ICE', 'COMPANY_NAME'].includes(key),
      })),
    ),
  ),
  http.put('/api/admin/legal/template-vars/:key', async ({ params, request }) => {
    const body = await request.json();
    return HttpResponse.json({ key: params.key, ...(body as object) });
  }),

  // Zones
  http.get('/api/admin/legal/zones', () => HttpResponse.json(FX_ZONES)),

  // Placements
  http.get('/api/admin/legal/placements', () => HttpResponse.json([])),
  http.post('/api/admin/legal/placements', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 'lpp_test', ...(body as object) });
  }),

  // Health
  http.get('/api/admin/legal/health', () =>
    HttpResponse.json({
      generated_at: new Date().toISOString(),
      placements: 12,
      placements_ok: 12,
      links_broken: 0,
      pages_missing_vars: 0,
      cron_last_run_at: new Date().toISOString(),
    }),
  ),

  // Lock
  http.post('/api/admin/legal/:slug/lock', () => HttpResponse.json({ acquired: true })),
  http.delete('/api/admin/legal/:slug/lock', () => HttpResponse.json({ released: true })),
];
```

## Handlers publics

```typescript
// test/msw/handlers/legal-public.ts
import { http, HttpResponse } from 'msw';

export const legalPublicHandlers = [
  // Placements par zone
  http.get('/api/legal/placements/:zone', ({ params }) => {
    const byZone: Record<string, any[]> = {
      'footer-main': [
        { slug: 'mentions-legales', title: 'Mentions légales', position: 1 },
        { slug: 'conditions-generales-de-vente', title: 'CGV', position: 2 },
        { slug: 'politique-confidentialite', title: 'Politique de confidentialité', position: 3 },
        { slug: 'politique-cookies', title: 'Politique de cookies', position: 4 },
        { slug: 'politique-retours', title: 'Politique de retours', position: 5 },
      ],
      'footer-bottom-bar': [
        { slug: 'mentions-legales', title: 'Mentions légales', position: 1 },
        { slug: 'conditions-generales-de-vente', title: 'CGV', position: 2 },
      ],
      'cookie-banner-links': [
        { slug: 'politique-cookies', title: 'Politique cookies', position: 1 },
        { slug: 'politique-confidentialite', title: 'Confidentialité', position: 2 },
      ],
      'checkout-consent': [
        { slug: 'conditions-generales-de-vente', title: 'CGV', position: 1 },
        { slug: 'politique-confidentialite', title: 'Confidentialité', position: 2 },
      ],
    };
    return HttpResponse.json(byZone[params.zone as string] ?? []);
  }),

  // Page publique
  http.get('/api/legal/:slug', ({ params }) => {
    const page = FX_PAGES[params.slug as string];
    if (!page || page.status !== 'published') {
      return HttpResponse.json(null, { status: 404 });
    }
    return HttpResponse.json({
      slug: page.slug,
      title: page.title,
      description: page.description,
      body_html: '<p>Rendu HTML mocké</p>',
      include_in_search: page.include_in_search,
      published_at: page.published_at,
    });
  }),
];
```

## Handlers utilitaires

```typescript
// test/msw/handlers/legal-utils.ts
export const legalUtilsHandlers = [
  // Check single link
  http.post('/api/admin/legal/check-link', async ({ request }) => {
    const body = (await request.json()) as { url: string };
    if (body.url.includes('broken')) {
      return HttpResponse.json({ ok: false, status: 404, error: 'Not found' });
    }
    return HttpResponse.json({ ok: true, status: 200 });
  }),
];
```

## Composition

```typescript
// test/msw/handlers/index.ts
export const handlers = [
  ...legalAdminHandlers,
  ...legalPublicHandlers,
  ...legalUtilsHandlers,
];
```

## Override par test

```typescript
import { server } from '@/test/msw';
import { http, HttpResponse } from 'msw';

test('handles 500 error', async () => {
  server.use(
    http.get('/api/admin/legal/cgv', () =>
      HttpResponse.json({ error: 'server_error' }, { status: 500 }),
    ),
  );

  render(<LegalPageEditor slug="cgv" />);
  expect(await screen.findByText(/Erreur serveur/)).toBeInTheDocument();
});
```

## Mock cron

Pour tester le cron health-check sans déclencher de vrais fetchs :

```typescript
import { mockCronContext } from '@/test/msw/cron';

test('cron updates health snapshot', async () => {
  mockCronContext({
    fetches: [
      { url: 'https://femiglow.ma/legal/cgv', status: 200 },
      { url: 'https://femiglow.ma/legal/old', status: 404 },
    ],
  });

  await runCron();

  const snapshot = await db.legalLinkHealthSnapshot.findLatest();
  expect(snapshot.links_broken).toBe(1);
});
```
