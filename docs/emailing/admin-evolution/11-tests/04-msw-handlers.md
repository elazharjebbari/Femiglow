# MSW handlers catalogue

> Inventaire des handlers MSW à créer pour tester les intégrations.
> Centraliser pour éviter duplication.

## Structure
```
apps/web/src/mocks/
├── handlers/
│   ├── listmonk.ts
│   ├── stalwart.ts
│   ├── outbox-api.ts
│   ├── audiences-api.ts
│   ├── automation-api.ts
│   ├── tracking-events.ts
│   └── index.ts            # combine all
├── server.ts               # vitest setup (node)
└── browser.ts              # playwright setup (worker)
```

## Listmonk handlers (handlers/listmonk.ts)

```typescript
import { rest } from 'msw';

const BASE = 'http://127.0.0.1:9000';

export const listmonkHandlers = [
  // List CRUD
  rest.post(`${BASE}/api/lists`, (req, res, ctx) => 
    res(ctx.json({ data: { id: 42, name: 'fg-test' } }))),
  
  rest.get(`${BASE}/api/lists/:id`, (req, res, ctx) =>
    res(ctx.json({ data: { id: 42, name: 'fg-test', subscriber_count: 0 } }))),
  
  rest.delete(`${BASE}/api/lists/:id`, (req, res, ctx) =>
    res(ctx.json({ ok: true }))),
  
  // Subscribers import
  rest.post(`${BASE}/api/import/subscribers`, (req, res, ctx) =>
    res(ctx.json({ data: { status: 'queued' } }))),
  
  rest.get(`${BASE}/api/import/subscribers/status`, (req, res, ctx) =>
    res(ctx.json({ data: { status: 'done' } }))),
  
  // Campaigns
  rest.post(`${BASE}/api/campaigns`, (req, res, ctx) =>
    res(ctx.json({ data: { id: 99, status: 'draft' } }))),
  
  rest.put(`${BASE}/api/campaigns/:id/status`, (req, res, ctx) =>
    res(ctx.json({ data: { id: 99, status: 'running' } }))),
  
  // Templates list (for wizard)
  rest.get(`${BASE}/api/templates`, (req, res, ctx) =>
    res(ctx.json({ data: [{ id: 1, name: 'welcome' }] }))),
  
  // Health
  rest.get(`${BASE}/api/health`, (req, res, ctx) => res(ctx.json({ ok: true }))),
];
```

### Variants pour tests d'erreur

```typescript
// Pour test "Listmonk 503 retries"
export const listmonkDown = [
  rest.post(`${BASE}/api/lists`, (req, res, ctx) => res(ctx.status(503))),
];

// Pour test "Listmonk auth fail"
export const listmonkAuthFail = [
  rest.post(`${BASE}/api/lists`, (req, res, ctx) => res(ctx.status(401))),
];

// Usage dans test :
server.use(...listmonkDown);
```

## Stalwart handlers (handlers/stalwart.ts)

```typescript
export const stalwartHandlers = [
  // Webhook events (Stalwart → FemiGlow)
  // Pas vraiment des handlers, plutôt des fixtures de payload
];

export const stalwartFixtures = {
  delivered: {
    event: 'delivery.delivered',
    messageId: '<test>',
    rcpt: 'user@x.y',
    ts: new Date().toISOString(),
  },
  bouncedHard: {
    event: 'delivery.failed',
    messageId: '<test>',
    rcpt: 'bad@example.com',
    errorCode: 550,
    reason: 'mailbox not found',
    ts: new Date().toISOString(),
  },
};
```

## Outbox API handlers (handlers/outbox-api.ts)

```typescript
import { rest } from 'msw';

export const outboxApiHandlers = [
  rest.post('/api/admin/emails/transactional/search', async (req, res, ctx) => {
    const body = await req.json();
    return res(ctx.json({
      rows: [
        { id: '1', status: 'failed', toEmail: 'a@b.c', template: 'welcome' },
      ],
      total: 1,
    }));
  }),
  
  rest.get('/api/admin/emails/transactional/summary', (req, res, ctx) => {
    return res(ctx.json({
      delivered: 1243, queued: 12, failed: 8, hardBounced: 3,
      sparkline: Array(12).fill(0),
    }));
  }),
  
  rest.post('/api/admin/emails/transactional/bulk-retry', async (req, res, ctx) => {
    const { ids } = await req.json();
    return res(ctx.json({ retried: ids.length, skipped: 0 }));
  }),
];
```

## Audiences API handlers (handlers/audiences-api.ts)

```typescript
export const audiencesApiHandlers = [
  rest.get('/api/admin/emails/audiences', (req, res, ctx) =>
    res(ctx.json([{ id: 'aud-1', name: 'VIP', size: 47 }]))),
  
  rest.post('/api/admin/emails/audiences', async (req, res, ctx) => {
    const body = await req.json();
    return res(ctx.json({ id: 'aud-new', ...body }));
  }),
  
  rest.post('/api/admin/emails/audiences/preview-size', async (req, res, ctx) => {
    return res(ctx.json({ size: 47, durationMs: 412 }));
  }),
  
  rest.post('/api/admin/emails/audiences/preview-sample', async (req, res, ctx) => {
    return res(ctx.json({
      size: 47,
      samples: [{ email: 'a@b.c', payload: { firstName: 'Ahmed' } }],
    }));
  }),
  
  rest.post('/api/admin/emails/audiences/:id/snapshot', (req, res, ctx) =>
    res(ctx.json({ snapshotId: 'snap-1', size: 47, status: 'done' }))),
];
```

## Automation API handlers (handlers/automation-api.ts)

Similaires : CRUD + events-catalog + runs.

## Tracking events handler (handlers/tracking-events.ts)

```typescript
export const trackingEventsHandlers = [
  rest.post('/api/tracking/events', (req, res, ctx) =>
    res(ctx.json({ ok: true }))),
];
```

## Setup MSW (server.ts)

```typescript
// apps/web/src/mocks/server.ts
import { setupServer } from 'msw/node';
import { listmonkHandlers } from './handlers/listmonk';
import { outboxApiHandlers } from './handlers/outbox-api';
import { audiencesApiHandlers } from './handlers/audiences-api';
// ...

export const server = setupServer(
  ...listmonkHandlers,
  ...outboxApiHandlers,
  ...audiencesApiHandlers,
);
```

## Setup Vitest

```typescript
// vitest.setup.ts (déjà existant, à étendre)
import { server } from './src/mocks/server';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Setup Playwright (V2)

```typescript
// playwright.config.ts — V2 si on veut MSW dans browser
// Pour l'instant, Playwright hit real backend (staging) + DB seeded
```

## Conventions handlers

- Un handler = 1 endpoint
- Réponses **succès par défaut** ; les variants d'erreur sont
  `export const xxxFail = [...]` réutilisables
- Pas de logique métier dans les handlers — juste mocks fidèles aux
  formats réels
- Documenter le schéma response (commentaire ou link API spec)

## Couverture exigée

| Catégorie | Couverture handlers |
|---|---|
| Listmonk endpoints utilisés | 100% |
| Outbox API | 100% |
| Audiences API | 100% |
| Automation API | 100% |
| Tracking events | 100% |
