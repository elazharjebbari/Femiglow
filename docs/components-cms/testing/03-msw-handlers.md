# T3 — Handlers MSW

> Setup MSW v2, structure des handlers par endpoint, scénarios
> success/erreur/conflit/network. **D4** justifie cette couche : pas
> de Server Actions, donc tous les flux passent par `fetch` →
> interceptables proprement.

## Setup

### Server Node (intégration Vitest)

Le projet a déjà `apps/web/src/test/msw/server.ts` (cf. existant) :

```ts
// src/test/msw/server.ts
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
export const server = setupServer();
export { http, HttpResponse };
```

### Setup côté browser (RTL)

Pour les tests RTL qui doivent intercepter du `fetch` côté client, on
ajoute un setup distinct :

```ts
// src/test/msw/setupServerSide.ts
import { server } from './server';

/**
 * À appeler dans setupFiles (vitest.config.ts) ou en haut de chaque
 * suite RTL qui mock des appels admin.
 */
export function setupServerSide() {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
}
```

Inclus dans `vitest.config.ts` :

```ts
test: {
  setupFiles: ['./src/test/msw/setupServerSide.ts'],
  environment: 'jsdom',
},
```

> `onUnhandledRequest: 'error'` est **non négociable** : tout fetch
> non mocké fait échouer le test, ce qui force la complétude.

## Structure d'un fichier de handlers

Un fichier par endpoint, sous `src/test/msw/handlers/components-fields/`.

```
src/test/msw/handlers/components-fields/
  ├── getFields.ts
  ├── patchField.ts
  ├── publish.ts
  ├── schedule.ts
  ├── cancelSchedule.ts
  ├── restore.ts
  ├── history.ts
  └── index.ts          ← réexporte + bundle 'happy path'
```

### Handler de base — `getFields`

```ts
// src/test/msw/handlers/components-fields/getFields.ts
import { http, HttpResponse } from 'msw';
import type { ResolvedFields } from '@/lib/components/fields/types';

interface Options {
  componentKey?: string;
  fields?: ResolvedFields;
  delay?: number;
}

export function getFieldsHandler(opts: Options = {}) {
  const key = opts.componentKey ?? ':key';
  return http.get(`/api/admin/components/${key}/fields`, async () => {
    if (opts.delay) await new Promise((r) => setTimeout(r, opts.delay));
    return HttpResponse.json({
      componentKey: key,
      locale: 'fr',
      fields: opts.fields ?? defaultHomeHeroFields(),
    });
  });
}

function defaultHomeHeroFields(): ResolvedFields {
  return {
    title: { value: 'Le rituel du soir', meta: { source: 'binding', version: 1 } },
    subtitle: { value: 'Une routine douce.', meta: { source: 'binding', version: 1 } },
    cta: { value: { label: 'Découvrir', href: '/rituel' }, meta: { source: 'binding', version: 1 } },
    kicker: { value: 'Notre rituel', meta: { source: 'default', version: 0 } },
  };
}
```

### Handler PATCH — echo + updatedAt

```ts
// src/test/msw/handlers/components-fields/patchField.ts
import { http, HttpResponse } from 'msw';

interface Options {
  componentKey?: string;
  fieldKey?: string;
  /** Si défini, on renverra ce updatedAt pour tester If-Match. */
  updatedAt?: string;
  status?: number;
  errorBody?: unknown;
}

export function patchFieldHandler(opts: Options = {}) {
  const ck = opts.componentKey ?? ':key';
  const fk = opts.fieldKey ?? ':fieldKey';
  return http.patch(`/api/admin/components/${ck}/fields/${fk}`, async ({ request }) => {
    if (opts.status && opts.status >= 400) {
      return HttpResponse.json(opts.errorBody ?? { error: 'mocked' }, { status: opts.status });
    }
    const body = await request.json();
    return HttpResponse.json({
      bindingId: 'cfb_mock',
      fieldKey: fk,
      value: body.value,
      status: 'draft',
      version: 0, // draft, version finale à la publication
      updatedAt: opts.updatedAt ?? new Date().toISOString(),
    });
  });
}
```

### Handler publish — 409 sur stale ifMatch

```ts
// src/test/msw/handlers/components-fields/publish.ts
import { http, HttpResponse } from 'msw';

interface Options {
  componentKey?: string;
  fieldKey?: string;
  /** Si défini, le serveur compare If-Match et renvoie 409 si différent. */
  expectedIfMatch?: string;
  /** Force un échec spécifique. */
  forceStatus?: number;
}

export function publishHandler(opts: Options = {}) {
  const ck = opts.componentKey ?? ':key';
  const fk = opts.fieldKey ?? ':fieldKey';
  return http.post(`/api/admin/components/${ck}/fields/${fk}/publish`, async ({ request }) => {
    if (opts.forceStatus) {
      return HttpResponse.json({ error: 'forced' }, { status: opts.forceStatus });
    }
    const ifMatch = request.headers.get('If-Match');
    if (opts.expectedIfMatch && ifMatch !== opts.expectedIfMatch) {
      return HttpResponse.json(
        { error: 'conflict.stale_version', currentUpdatedAt: opts.expectedIfMatch },
        { status: 409 },
      );
    }
    return HttpResponse.json({
      bindingId: 'cfb_mock',
      fieldKey: fk,
      status: 'published',
      version: 2,
      publishedAt: new Date().toISOString(),
    });
  });
}
```

### Handler restore

```ts
export function restoreHandler(opts: { componentKey?: string; fieldKey?: string } = {}) {
  const ck = opts.componentKey ?? ':key';
  const fk = opts.fieldKey ?? ':fieldKey';
  return http.post(`/api/admin/components/${ck}/fields/${fk}/restore`, async ({ request }) => {
    const body = (await request.json()) as { historyId: string };
    return HttpResponse.json({
      bindingId: 'cfb_new_draft',
      status: 'draft',
      restoredFromHistoryId: body.historyId,
      version: 0,
      updatedAt: new Date().toISOString(),
    });
  });
}
```

### Handler history — paged

```ts
export function historyHandler(opts: { items?: HistoryEntry[]; nextCursor?: string | null } = {}) {
  return http.get('/api/admin/components/:key/fields/:fieldKey/history', () =>
    HttpResponse.json({
      items: opts.items ?? defaultHistory(),
      nextCursor: opts.nextCursor ?? null,
    }),
  );
}
```

### Bundle happy-path

```ts
// src/test/msw/handlers/components-fields/index.ts
export const componentsFieldsHappyHandlers = [
  getFieldsHandler(),
  patchFieldHandler(),
  publishHandler(),
  scheduleHandler(),
  cancelScheduleHandler(),
  restoreHandler(),
  historyHandler(),
];
```

## Scénarios d'override par test

> Règle : on **n'écrit pas** un nouveau handler par test. On **override**
> avec `server.use()` le scénario à tester. Reset à `afterEach`.

### Success

```ts
import { server } from '@/test/msw/server';
import { componentsFieldsHappyHandlers, getFieldsHandler } from '@/test/msw/handlers/components-fields';

beforeEach(() => {
  server.use(...componentsFieldsHappyHandlers);
});

it('charge les champs depuis l\'API', async () => {
  // happy path — les handlers par défaut suffisent
  render(<ComponentFieldsPanel componentKey="home-hero" />);
  await screen.findByDisplayValue('Le rituel du soir');
});
```

### Validation 422

```ts
it('affiche le message d\'erreur sur 422', async () => {
  server.use(
    patchFieldHandler({
      fieldKey: 'title',
      status: 422,
      errorBody: {
        error: 'validation_failed',
        issues: [{ path: ['value', 'v'], message: 'Trop court (min 3)' }],
      },
    }),
  );
  // …
  await screen.findByText(/trop court/i);
});
```

### Conflict 409 — A4 E1

```ts
it('propose merge/reload sur 409', async () => {
  server.use(
    publishHandler({
      fieldKey: 'title',
      expectedIfMatch: '2026-05-05T11:00:00Z', // l'admin a chargé avec 10:00
    }),
  );
  // L'UI envoie If-Match: 2026-05-05T10:00:00Z → 409
  // …
  await screen.findByRole('dialog', { name: /conflit/i });
  expect(screen.getByRole('button', { name: /recharger/i })).toBeInTheDocument();
});
```

### Network error

```ts
it('retry 3 fois sur erreur réseau', async () => {
  let calls = 0;
  server.use(
    http.patch('/api/admin/components/home-hero/fields/title', () => {
      calls++;
      if (calls < 3) return HttpResponse.error(); // network failure
      return HttpResponse.json({ /* … */ });
    }),
  );
  // …
  await waitFor(() => expect(calls).toBe(3));
});
```

### Slow response

```ts
it('affiche un spinner pendant le save', async () => {
  server.use(patchFieldHandler({ /* … */ /* delay implicite via setTimeout dans handler */ }));
  // Avec vi.useFakeTimers + vi.advanceTimersByTime
});
```

### 401 / 403 (RBAC, A6)

```ts
it('redirige vers login sur 401', async () => {
  server.use(
    http.patch('/api/admin/components/:key/fields/:fieldKey', () =>
      HttpResponse.json({ error: 'unauthenticated' }, { status: 401 }),
    ),
  );
  // …
});

it('affiche un message d\'erreur sur 403 (user inactif)', async () => {
  server.use(
    http.patch('/api/admin/components/:key/fields/:fieldKey', () =>
      HttpResponse.json({ error: 'forbidden.user_inactive' }, { status: 403 }),
    ),
  );
  // …
});
```

## Custom matcher : `expectMswCalled`

Pour vérifier qu'un appel précis a été émis, on s'inspire des
`server.events` MSW v2 et on encapsule dans un helper :

```ts
// src/test/msw/expectMswCalled.ts
import { server } from './server';
import { expect } from 'vitest';

interface CallRecord {
  method: string;
  url: string;
  body?: unknown;
}

const calls: CallRecord[] = [];

server.events.on('request:start', async ({ request }) => {
  let body: unknown;
  if (request.method !== 'GET') {
    try { body = await request.clone().json(); } catch { /* non-json */ }
  }
  calls.push({ method: request.method, url: new URL(request.url).pathname, body });
});

afterEach(() => { calls.length = 0; });

export function expectMswCalled(method: string, urlPattern: string | RegExp, options?: { withBody?: (b: unknown) => boolean }) {
  const match = calls.find((c) =>
    c.method === method &&
    (typeof urlPattern === 'string' ? c.url === urlPattern : urlPattern.test(c.url)) &&
    (options?.withBody ? options.withBody(c.body) : true)
  );
  expect(match, `Expected ${method} ${urlPattern} to be called.\nCalls: ${JSON.stringify(calls, null, 2)}`).toBeDefined();
}
```

Usage :

```ts
it('PATCH avec If-Match: <updatedAt>', async () => {
  // …
  expectMswCalled('PATCH', '/api/admin/components/home-hero/fields/title', {
    withBody: (b) => (b as { value: { v: string } }).value.v === 'Nouveau titre',
  });
});
```

## Tests d'intégration des routes (server side)

Les routes Next.js sont importées et exécutées **directement** (pas de
fetch), comme dans l'existant
(`src/test/integration/admin-component-binding-mutations.test.ts`).
MSW n'est utilisé là que pour intercepter les **appels sortants** (par
ex. webhook, mais ici aucun, donc MSW reste passif).

```ts
import { GET, PATCH } from '@/app/api/admin/components/[key]/fields/route';
// …
const req = new Request('http://localhost/api/admin/components/home-hero/fields/title', {
  method: 'PATCH',
  headers: { 'If-Match': updatedAt, 'X-Requested-With': 'fetch' },
  body: JSON.stringify({ value: { v: 'Nouveau' } }),
});
const res = await PATCH(req, { params: Promise.resolve({ key: 'home-hero' }) });
expect(res.status).toBe(200);
```

### Tests d'intégration obligatoires

| Fichier | Couvre |
|---|---|
| `admin-component-fields.test.ts` | GET 200, GET 404, PATCH 200, PATCH 400 (Zod), PATCH 401, PATCH 403, PATCH 409 (If-Match) |
| `admin-component-fields-publish.test.ts` | POST publish 200, 401, 403, **409 E1**, **409 E2**, revalidateTag appelé (EC5) |
| `admin-component-fields-schedule.test.ts` | POST schedule 200, **400 E3** (in past), POST cancel-schedule, cron promote idempotent **E5** |
| `admin-component-fields-restore.test.ts` | POST restore 200, **409 E4** (field removed) |
| `admin-component-fields-history.test.ts` | GET history paginé, filtrage par action |
| `admin-component-fields-csrf.test.ts` | 403 sans `X-Requested-With`, 429 sur rate-limit |

## Reset entre tests

```ts
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  resetMemoryStore();
});
afterAll(() => server.close());
```

## Cross-références

- D4 (A1) — pourquoi MSW est viable.
- A4 §Erreurs E1–E5, A6 §Garde-fous serveur.
- B1 (routes), B2 (Zod).
- T2 (logique pure), T4 (RTL utilise les mêmes handlers), T6 (scénarios par composant).
