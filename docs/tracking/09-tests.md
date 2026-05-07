# 09 — Stratégie de tests

## 1. Pyramide

```
                    ┌──────────────┐
                    │  E2E (Playwright)
                    │  ~12 scénarios
                    └──────────────┘
              ┌──────────────────────────┐
              │  Integration (Vitest+MSW)
              │  ~50 tests
              └──────────────────────────┘
        ┌──────────────────────────────────────┐
        │  Unit (Vitest)
        │  ~150 tests
        └──────────────────────────────────────┘
```

Cibles couverture :

- ≥ 90 % lines sur `src/lib/tracking/**`.
- ≥ 80 % lines sur `src/components/admin/tracking/**`.
- 100 % des routes API tracking testées.
- 12 scénarios Playwright sur les funnels critiques.

## 2. Outils

| Outil | Usage |
|---|---|
| Vitest | Unit + integration. |
| @testing-library/react | Tests composants React. |
| MSW | Mock providers CAPI (Meta, TikTok, Google, Snap, Pinterest). |
| jest-axe | A11y automatisée (admin). |
| Playwright | E2E + tests visuels (screenshots admin). |
| Faker (vendor) | Génération payloads events. |

Tous déjà présents (cf `apps/web/package.json`).

## 3. Tests unitaires

### 3.1 Datalayer client

```ts
// src/lib/tracking/client/datalayer.test.ts
describe('datalayer', () => {
  it('initializes window.femiglowDataLayer as empty array', () => {
    // setup window mock
    pushDataLayer({ event: 'page_view', ...mockEvent });
    expect(window.femiglowDataLayer).toHaveLength(1);
  });

  it('truncates buffer above MAX_BUFFER', () => {
    for (let i = 0; i < 600; i++) pushDataLayer({ event: 'x', ... });
    expect(window.femiglowDataLayer.length).toBeLessThanOrEqual(500);
  });

  it('also pushes to window.dataLayer when alias enabled', () => {
    window.dataLayer = [];
    pushDataLayer(mockEvent);
    expect(window.dataLayer).toHaveLength(1);
  });
});
```

### 3.2 TrackingClient

```ts
describe('TrackingClient', () => {
  it('emits event when enabled and consent granted', () => {
    const client = createClient(config);
    client.emit('add_to_cart', mockParams);
    expect(window.femiglowDataLayer.at(-1)?.event).toBe('add_to_cart');
  });

  it('skips event when component disabled', () => {
    const config = { ...base, components: { tc_x: { enabled: false } } };
    const client = createClient(config);
    client.emit('add_to_cart', mockParams, { componentId: 'tc_x' });
    expect(window.femiglowDataLayer).toHaveLength(0);
  });

  it('dedupes events by event_id within 5s', () => {
    const client = createClient(config);
    client.emit('add_to_cart', mockParams); // generates event_id
    const id = window.femiglowDataLayer[0].event_id;
    client.__forceEmitWithId(id, 'add_to_cart', mockParams);
    expect(window.femiglowDataLayer).toHaveLength(1);
  });

  it('does not throw when emit fails', () => {
    const client = createClient(config);
    client.__breakFetch();
    expect(() => client.emit('add_to_cart', mockParams)).not.toThrow();
  });

  it('flushes queue on visibilitychange', () => {
    const client = createClient(config);
    client.emit('view_item', mockParams);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(global.fetch).toHaveBeenCalledWith('/api/track', expect.any(Object));
  });
});
```

### 3.3 Validator (Zod)

```ts
describe('event validator', () => {
  it.each(eventCatalog)('validates valid payload for %s', (def) => {
    const validator = getValidator(def.name);
    const fixture = generateFixture(def);
    expect(validator.parse(fixture)).toBeTruthy();
  });

  it('rejects purchase without transaction_id', () => {
    expect(() => purchaseParamsSchema.parse({ currency: 'EUR', value: 10, items: [] }))
      .toThrow();
  });
});
```

### 3.4 Provider adapters

Un test par adapter pour `mapEvent` et `dispatchServer` (mock fetch
via MSW).

```ts
// src/lib/tracking/providers/meta.test.ts
import { metaAdapter } from './meta';
import { server } from '@/test/msw';

describe('metaAdapter', () => {
  it('maps add_to_cart to AddToCart', () => {
    const payload = metaAdapter.mapEventServer(mockEvent('add_to_cart'));
    expect(payload.data[0].event_name).toBe('AddToCart');
  });

  it('hashes email before sending', () => {
    const payload = metaAdapter.mapEventServer(mockEventWithUser('add_to_cart'));
    expect(payload.data[0].user_data.em).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns ok when CAPI responds 200', async () => {
    server.use(rest.post('https://graph.facebook.com/*', (req, res, ctx) =>
      res(ctx.status(200), ctx.json({ events_received: 1, fbtrace_id: 'AB' })),
    ));
    const result = await metaAdapter.dispatchServer(payload, config);
    expect(result.status).toBe('ok');
  });

  it('returns error when CAPI 401', async () => {
    server.use(rest.post('https://graph.facebook.com/*', (req, res, ctx) =>
      res(ctx.status(401), ctx.json({ error: { message: 'invalid token' } })),
    ));
    const result = await metaAdapter.dispatchServer(payload, config);
    expect(result.status).toBe('error');
    expect(result.responseCode).toBe(401);
  });
});
```

### 3.5 Inventory scanner

```ts
describe('inventory scanner', () => {
  it('detects pages from src/app/**/page.tsx', async () => {
    const fixture = await fixtureFromDir('test/fixtures/scanner-pages');
    const inv = await scanInventory(fixture);
    expect(inv.pages.map(p => p.route)).toContain('/');
    expect(inv.pages.map(p => p.route)).toContain('/journal');
  });

  it('parses @tracking-category JSDoc override', async () => {
    const inv = await scanInventory('test/fixtures/scanner-jsdoc');
    const c = inv.components.find(c => c.name === 'CustomCard');
    expect(c.category).toBe('cta_primary'); // overridden
  });

  it('infers category by name suffix', async () => {
    expect(inferCategory('HeroProduit', 'src/components/sections/HeroProduit.tsx'))
      .toBe('section_hero');
    expect(inferCategory('AddToCartButton', 'src/components/commerce/AddToCartButton.tsx'))
      .toBe('cta_primary');
  });
});
```

### 3.6 Components admin (UI)

```ts
// src/components/admin/tracking/TreeView.test.tsx
describe('<TreeView>', () => {
  it('renders pages and components hierarchically', () => {
    render(<TreeView data={mockTree} />);
    expect(screen.getByRole('tree')).toBeInTheDocument();
    expect(screen.getAllByRole('treeitem').length).toBeGreaterThan(5);
  });

  it('expands a node on click', async () => {
    render(<TreeView data={mockTree} />);
    const node = screen.getByText('/kit');
    await userEvent.click(node);
    expect(screen.getByText('HeroProduit')).toBeVisible();
  });

  it('is keyboard navigable (arrow keys)', async () => {
    render(<TreeView data={mockTree} />);
    const tree = screen.getByRole('tree');
    tree.focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowRight}');
    expect(document.activeElement).toHaveAttribute('aria-expanded', 'true');
  });

  it('passes axe a11y', async () => {
    const { container } = render(<TreeView data={mockTree} />);
    expect(await axe(container)).toHaveNoViolations();
  });
});
```

## 4. Tests d'intégration (MSW)

### 4.1 API `/api/track`

```ts
describe('POST /api/track', () => {
  beforeEach(() => __resetDedup());

  it('accepts a valid batch of events', async () => {
    const res = await POST(mockReq({ events: [validEvent] }));
    const body = await res.json();
    expect(res.status).toBe(202);
    expect(body.accepted).toHaveLength(1);
    expect(body.skipped).toHaveLength(0);
  });

  it('skips invalid event in batch but accepts others', async () => {
    const res = await POST(mockReq({ events: [validEvent, invalidEvent] }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.accepted).toHaveLength(1);
    expect(body.skipped).toHaveLength(1);
  });

  it('dedupes by event_id', async () => {
    await POST(mockReq({ events: [validEvent] }));
    const res = await POST(mockReq({ events: [validEvent] })); // same event_id
    const body = await res.json();
    expect(body.skipped).toContain(validEvent.event_id);
  });

  it('rate-limits at 60 req/min', async () => {
    for (let i = 0; i < 60; i++) await POST(mockReq({ events: [makeEvent()] }));
    const res = await POST(mockReq({ events: [makeEvent()] }));
    expect(res.status).toBe(429);
  });

  it('dispatches CAPI providers (mocked) when scope=both', async () => {
    server.use(metaCapiHandler(200), googleMpHandler(204));
    await POST(mockReq({ events: [validEvent] }));
    await waitForDispatchQueue();
    expect(metaCapiHandler.fn).toHaveBeenCalledTimes(1);
  });

  it('does not dispatch when consent denied', async () => {
    const event = { ...validEvent, consent: ALL_DENIED };
    await POST(mockReq({ events: [event] }));
    expect(metaCapiHandler.fn).not.toHaveBeenCalled();
  });
});
```

### 4.2 Console admin

```ts
describe('PATCH /api/admin/tracking/components/:id', () => {
  it('requires admin session', async () => {
    const res = await PATCH(mockReq({ enabled: true }, { sessionToken: null }));
    expect(res.status).toBe(401);
  });

  it('updates component config and writes audit', async () => {
    const res = await PATCH(mockReq({ enabled: true }, { sessionToken: 'admin' }), { params: { id: 'tc_x' } });
    expect(res.status).toBe(200);
    const audit = await __getAuditEvents();
    expect(audit.at(-1)?.action).toBe('tracking.component.update');
  });
});
```

## 5. Tests E2E (Playwright)

`apps/web/tests/e2e/tracking/*.spec.ts` — chacun ouvre un context
isolé.

### Scénarios

1. **Funnel achat complet** — `/kit` → `/panier` → `/commander` →
   `/merci`. Vérifie les events dans le datalayer (`view_item`,
   `add_to_cart`, `view_cart`, `begin_checkout`, `add_shipping_info`,
   `add_payment_info`, `purchase`) avec `event_id` distincts.

2. **Consent banner** — clic "Refuser" → `window.fbq` non appelé,
   `/api/track` envoie `consent.ad_storage = 'denied'`. Re-clic
   "Accepter" → pixels chargent.

3. **Pixel test (admin)** — `/admin/tracking/test` → choisir
   `view_item` + Meta dry-run → résultat affiché en < 1s, payload
   pretty-printed.

4. **Inventaire diff** — modifier un nom de composant en code,
   relancer le scan, ouvrir `/admin/tracking/inventory` → badge
   "1 nouveau composant" + drift signalé.

5. **Provider toggle** — désactiver Meta → next page_view ne hit
   pas Meta CAPI mock. Réactiver → events repartent.

6. **Newsletter lead** — submit formulaire newsletter → event
   `generate_lead` `method=newsletter` dans datalayer + Meta CAPI
   appelée (mock).

7. **Reading progress** — scroll long article jusqu'à 75% →
   `fg_journal_read_75` émis.

8. **Video tracking** — play vidéo `/rituel`, scrub à 50% →
   `video_progress` `video_percent=50`.

9. **Debug overlay** — `?fg_debug=1` → overlay visible, surligne
   composants trackés.

10. **Purchase dedup** — ouvrir `/merci` 2 fois (refresh) → seul
    1 `purchase` accepté en BDD (dedup `event_id`).

11. **A11y admin** — parcours clavier complet `/admin/tracking/*`
    → focus visible, navigation tree OK.

12. **Logs streaming** — émettre 10 events depuis devtools, voir
    arriver les rows dans `/admin/tracking/events` en < 5 s.

### Setup MSW Playwright

```ts
// tests/e2e/setup/msw.ts
import { setupWorker, rest } from 'msw/browser';
const handlers = [
  rest.post('https://graph.facebook.com/*', (req, res, ctx) => res(ctx.status(200), ctx.json({events_received:1}))),
  rest.post('https://business-api.tiktok.com/*', (req, res, ctx) => res(ctx.json({code:0}))),
  rest.post('https://www.google-analytics.com/mp/collect*', (req, res, ctx) => res(ctx.status(204))),
];
export const worker = setupWorker(...handlers);
```

Activé en `beforeEach` de chaque test. Capture des hits permet
d'asserter le mapping/dedup.

## 6. Tests visuels (Playwright)

Snapshots des pages admin clé :

- `/admin/tracking` (dashboard).
- `/admin/tracking/inventory`.
- `/admin/tracking/components/[id]` (drawer ouvert).
- `/admin/tracking/providers`.

`toHaveScreenshot()` avec tolerance `0.05`. Les diffs sont review
manuel sur PR.

## 7. Tests de performance

Bundle budget vérifié en CI :

```bash
pnpm run build
node scripts/check-bundle-size.ts # fail si TrackingProvider > 8 KB gzip
```

LCP regression : Playwright + Lighthouse, comparaison avec branche
`main` baseline. Fail si régression > 5 %.

## 8. Tests de sécurité

- Test : injection HTML dans `customHead` → rejet par regex stricte
  + status 400.
- Test : code custom contenant `<iframe>` → rejet.
- Test : `/api/track` avec body 1 MB → rejet (max 100 KB).
- Test : token CAPI chiffré → décrypte côté server uniquement.

## 9. Contract tests (inventory diff)

Un job CI qui :

1. Lance `scripts/scan-tracking-inventory.ts`.
2. Compare le JSON généré avec `src/lib/tracking/inventory.generated.json` commité.
3. Fail si diff non-trivial sans entrée `tracking-changelog.md`.

Évite les drifts silencieux.

## 10. Mocks réutilisables

`src/test/tracking/`:

- `fixtures.ts` : events valides par type.
- `factories.ts` : `makeEvent`, `makeComponent`, `makeProvider`.
- `msw-handlers.ts` : handlers pour les 5 providers + GTM.
- `client-test-utils.ts` : `renderWithTracking(ui, config)`.

## 11. Seed des tests

Mode "memory store" pour Vitest : auto-actif quand `DATABASE_URL` non
défini. Les tests intégration BDD peuvent forcer Postgres via
`process.env.DATABASE_URL_TEST` + `pnpm db:push --schema-only`.

## 12. CI

Job dédié `tracking` :

```yaml
- name: Tracking inventory consistency
  run: pnpm tsx scripts/scan-tracking-inventory.ts && git diff --exit-code src/lib/tracking/inventory.generated.json

- name: Tracking unit + integration
  run: pnpm test -- --run src/lib/tracking src/components/admin/tracking src/app/api/track src/app/api/admin/tracking

- name: Tracking E2E
  run: pnpm playwright test tests/e2e/tracking
```

Échec bloque le merge.
