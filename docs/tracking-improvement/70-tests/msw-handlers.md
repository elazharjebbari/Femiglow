# 70.4 — MSW Handlers

## Stratégie

MSW (Mock Service Worker) intercepte les appels HTTP côté client/server.
Utilisé pour :
1. **Tests d'intégration** Vitest qui touchent fetch → simuler les réponses Google Ads / Meta / GA
2. **Storybook** (futur) — pour montrer les composants admin sans toucher la prod
3. **Dev local** — possibilité de pointer vers mock plutôt que prod

## Setup

```typescript
// src/test/msw/server.ts
import { setupServer } from 'msw/node';
import { handlers } from './handlers';

export const server = setupServer(...handlers);
```

```typescript
// src/test/setup.ts (vitest config setupFiles)
import { server } from './msw/server';
import { afterAll, afterEach, beforeAll } from 'vitest';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Handlers — providers externes

```typescript
// src/test/msw/handlers/google-ads.ts
import { http, HttpResponse } from 'msw';

export const googleAdsHandlers = [
  // OAuth refresh
  http.post('https://oauth2.googleapis.com/token', () =>
    HttpResponse.json({
      access_token: 'mock-access-token-123',
      expires_in: 3600,
      token_type: 'Bearer',
    }),
  ),

  // Upload click conversions — success
  http.post(
    'https://googleads.googleapis.com/v17/customers/:customerId\\::uploadClickConversions',
    async ({ request }) => {
      const body = await request.json() as any;
      return HttpResponse.json({
        results: body.conversions.map((c: any, i: number) => ({
          gclid: c.gclid,
          conversionAction: c.conversionAction,
          conversionDateTime: c.conversionDateTime,
        })),
        partialFailureError: null,
      });
    },
  ),

  // 401 — token expired (scenario)
  http.post(
    'https://googleads.googleapis.com/v17/customers/expired-token\\::uploadClickConversions',
    () => HttpResponse.json(
      {
        error: {
          code: 401,
          message: 'Request had invalid authentication credentials',
        },
      },
      { status: 401 },
    ),
  ),

  // 429 rate limit
  http.post(
    'https://googleads.googleapis.com/v17/customers/quota-exceeded\\::uploadClickConversions',
    () => HttpResponse.json(
      {
        error: {
          code: 429,
          message: 'Quota exceeded',
        },
      },
      { status: 429, headers: { 'Retry-After': '60' } },
    ),
  ),
];
```

```typescript
// src/test/msw/handlers/meta.ts
export const metaHandlers = [
  http.post(
    'https://graph.facebook.com/v22.0/:pixelId/events',
    async ({ request }) => {
      const body = await request.json() as any;
      return HttpResponse.json({
        events_received: body.data?.length ?? 0,
        messages: [],
        fbtrace_id: 'AbCdEf123',
      });
    },
  ),
];
```

```typescript
// src/test/msw/handlers/ga4.ts
export const ga4Handlers = [
  http.post('https://www.google-analytics.com/mp/collect', () =>
    new HttpResponse(null, { status: 204 }),
  ),
];
```

## Handlers — admin API

```typescript
// src/test/msw/handlers/admin-tracking.ts
const versions: GtmConfigVersion[] = [
  {
    id: 'v1',
    name: 'v1 — initial',
    notes: null,
    clonedFrom: null,
    perEnv: { /* ... */ },
    createdAt: '2026-04-01T10:00:00Z',
    createdBy: 'u_sara',
  },
];

let activeId: string | null = 'v1';

export const adminTrackingHandlers = [
  http.get('*/api/admin/tracking/gtm', () =>
    HttpResponse.json({ activeId, versions }),
  ),

  http.get('*/api/admin/tracking/gtm/:id', ({ params }) => {
    const v = versions.find((x) => x.id === params.id);
    if (!v) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(v);
  }),

  http.post('*/api/admin/tracking/gtm', async ({ request }) => {
    const body = await request.json() as any;
    const newVersion: GtmConfigVersion = {
      id: `v${versions.length + 1}`,
      name: body.name,
      notes: body.notes,
      clonedFrom: body.cloneFrom ?? null,
      perEnv: body.perEnv,
      createdAt: new Date().toISOString(),
      createdBy: 'u_test',
    };
    versions.push(newVersion);
    return HttpResponse.json({ versionId: newVersion.id }, { status: 201 });
  }),

  http.post('*/api/admin/tracking/gtm/:id/activate', ({ params }) => {
    activeId = params.id as string;
    return HttpResponse.json({ activeId });
  }),

  http.get('*/api/admin/tracking/providers/snapshot', () =>
    HttpResponse.json({
      metaPixelId: '2179682406197934',
      ga4MeasurementId: 'G-5VHP17SDZM',
      googleAdsCustomerId: '7082602195',
      googleAdsConvLabels: { purchase: 'AbCdEf123Abc', lead: 'XyZ789xyZ123' },
      tiktokPixelId: null,
      snapPixelId: null,
      pinterestTagId: null,
      gtmContainerId: 'GTM-M8K7V88D',
      providersCount: 3,
      fetchedAt: new Date().toISOString(),
    }),
  ),

  http.get('*/api/admin/tracking/events/categorization', () =>
    HttpResponse.json([
      {
        name: 'purchase',
        isConversion: true,
        googleAdsCategoryDefault: 'purchase',
        googleAdsCategoryOverride: null,
        overrideUpdatedBy: null,
        overrideUpdatedAt: null,
      },
      {
        name: 'lead_capture',
        isConversion: true,
        googleAdsCategoryDefault: 'lead',
        googleAdsCategoryOverride: null,
      },
      // ...
    ]),
  ),

  http.put('*/api/admin/tracking/events/categorization', async ({ request }) => {
    const body = await request.json() as any;
    return HttpResponse.json({ ok: true, ...body });
  }),
];
```

## Composite

```typescript
// src/test/msw/handlers/index.ts
import { googleAdsHandlers } from './google-ads';
import { metaHandlers } from './meta';
import { ga4Handlers } from './ga4';
import { adminTrackingHandlers } from './admin-tracking';

export const handlers = [
  ...googleAdsHandlers,
  ...metaHandlers,
  ...ga4Handlers,
  ...adminTrackingHandlers,
];
```

## Override per-test

```typescript
import { server } from '@/test/msw/server';
import { http, HttpResponse } from 'msw';

it('handles Google Ads 401 token expired', async () => {
  server.use(
    http.post(
      'https://googleads.googleapis.com/v17/*',
      () => HttpResponse.json({ error: { code: 401 } }, { status: 401 }),
      { once: true }, // seulement le premier appel renvoie 401
    ),
  );

  // Run test... le 2e appel passera au handler default (200)
});
```
