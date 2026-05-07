# Testing — Handlers MSW

Mock Service Worker fournit les fixtures réseau pour les tests
unitaires (Vitest) et navigateur (Playwright en mode dev). Setup
aligné avec components-CMS.

## Fichiers

- `apps/web/src/test/msw/handlers/seo.ts` — handlers SEO
- `apps/web/src/test/msw/server.ts` — server unifié (Node, Vitest)
- `apps/web/src/test/msw/browser.ts` — worker (browser, dev)

## Handlers exposés

```ts
import { http, HttpResponse } from 'msw';
import { listOverridesFixture, makeOverrideFixture } from '../fixtures/seo';

export const seoHandlers = [
  http.get('/api/admin/seo', ({ request }) => {
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope');
    return HttpResponse.json(listOverridesFixture({ scope }));
  }),

  http.get('/api/admin/seo/:scope/:targetKey', ({ params }) => {
    const override = makeOverrideFixture(params);
    return HttpResponse.json({
      override,
      resolved: resolveFixture(override),
      defaults: { title: 'FemiGlow', description: '…' },
      knownPage: { label: 'Le Kit', path: '/kit' },
      recentSnapshots: [],
    });
  }),

  http.patch('/api/admin/seo/:scope/:targetKey', async ({ request, params }) => {
    const body = await request.json();
    return HttpResponse.json({ ...makeOverrideFixture(params), ...body });
  }),

  http.post('/api/admin/seo/:scope/:targetKey/publish', ({ params }) => {
    return HttpResponse.json({
      override: makeOverrideFixture({ ...params, publishedAt: new Date().toISOString() }),
      snapshotId: 'snap_test_1',
      lintReport: { issues: [], score: 95 },
    });
  }),

  http.post('/api/admin/seo/audit', async ({ request }) => {
    const body = await request.json() as AuditBody;
    return HttpResponse.json(runLinterFixture(body));
  }),
];
```

## Fixtures (`apps/web/src/test/fixtures/seo.ts`)

```ts
export function makeOverrideFixture(overrides: Partial<SeoOverride> = {}): SeoOverride {
  return {
    id: overrides.id ?? 'ov_kit_fr',
    scope: overrides.scope ?? 'page',
    targetKey: overrides.targetKey ?? 'kit',
    locale: overrides.locale ?? 'fr-MA',
    title: overrides.title ?? 'Le Kit FemiGlow',
    description: overrides.description ?? 'Routine douce, pour peaux pressées.',
    keywords: overrides.keywords ?? ['kit', 'rituel', 'soin'],
    ogTitle: null,
    ogDescription: null,
    ogImageMediaId: null,
    ogImageTemplate: 'marketing',
    twitterCard: 'summary_large_image',
    canonical: 'https://femiglow.com/kit',
    robotsIndex: true,
    robotsFollow: true,
    structuredData: null,
    publishedAt: '2026-04-12T08:00:00.000Z',
    draftedAt: '2026-04-12T08:00:00.000Z',
    ...overrides,
  };
}

export function listOverridesFixture(filter: { scope?: string }) {
  const items = ALL_OVERRIDES.filter(o => !filter.scope || o.scope === filter.scope);
  return { items, total: items.length, page: 1, pageSize: 20 };
}
```

## Cas couverts

| Cas                        | Comment forcer                                  |
|----------------------------|-------------------------------------------------|
| Override absent            | `http.get(...).resolver(() => HttpResponse.json({ override: null, ... }))` |
| Erreur 422 au PATCH        | resolver renvoie 422 avec issues fixture        |
| Erreur 429 rate limit      | resolver renvoie 429 + header `Retry-After`     |
| Audit avec warnings        | fixture `lintReportWithWarnings`                |
| Snapshot restore           | handler POST `/restore` patche l'override draft |

## Setup Vitest

`apps/web/vitest.config.ts` charge `src/test/setup.ts` :

```ts
import { server } from './msw/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Setup Playwright

Pour les tests `--mode mock` qui n'attaquent pas la vraie DB :

```ts
// playwright.config.ts → use.serviceWorkers = 'allow';
// puis dans test :
await page.addInitScript(() => {
  // ... activer le worker MSW navigateur
});
```

Mode par défaut Playwright : vraie DB testcontainer (cf.
[`03-playwright-scenarios.md`](./03-playwright-scenarios.md)).

## Conventions

- Un handler par méthode/route — pas de switch interne
- Fixtures déterministes (IDs `ov_kit_fr`, `snap_test_1`, …)
- Pas de logique métier dupliquée : on importe les schémas Zod pour
  re-valider le body côté handler (fail rapide si un test envoie un
  payload invalide)
- `onUnhandledRequest: 'error'` : tout fetch non-mocké throw → on
  voit immédiatement les nouveaux endpoints à mocker
