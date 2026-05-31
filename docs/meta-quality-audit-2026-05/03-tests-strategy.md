# 03 — Stratégie de tests

> **Lien amont** : [`02-plan-dev-action.md`](./02-plan-dev-action.md) (étapes d'implémentation)
> **Lien aval** : [`04-runbook.md`](./04-runbook.md) (exécution réelle)

---

## 1. Pyramide de test

```
                  ┌─────────────────────┐
                  │  Playwright E2E     │  ~1 spec, ~3 cas
                  │  (kit-view-item)    │
                  └─────────────────────┘
                ┌───────────────────────────┐
                │  MSW provider integration  │  ~8 cas
                │  (serverEmit, metaAdapter) │
                └───────────────────────────┘
              ┌─────────────────────────────────┐
              │  Vitest unit tests              │  ~45 cas
              │  (enrich, deriveEventId, isBot, │
              │   schemas, client.emit, etc.)   │
              └─────────────────────────────────┘
```

**Volume cible** : ~55 tests neufs. Toutes les nouvelles lignes de code couvertes ≥ 90 %.

---

## 2. Tests unitaires (Vitest)

### 2.1 Configuration partagée

Aucune modif à `vitest.config.ts` — le setup existant suffit. Quelques helpers ajoutés :

```ts
// apps/web/src/lib/tracking/__test-utils__/mock-meta-dispatch.ts (nouveau)
import { vi } from 'vitest';
import type { TrackingProvider } from '@/lib/db/types';
import type { DispatchContext } from '@/lib/tracking/providers/types';

export function mockMetaProvider(overrides: Partial<TrackingProvider> = {}): TrackingProvider {
  return {
    id: 'tp_meta_test',
    kind: 'meta',
    status: 'enabled',
    pixelId: '1234567890',
    capiTokenEncrypted: 'enc:test_token',
    testEventCode: undefined,
    ...overrides,
  } as TrackingProvider;
}

export function mockDispatchContext(overrides: Partial<DispatchContext> = {}): DispatchContext {
  return {
    eventName: 'view_item',
    params: {},
    eventId: 'evt_test_001',
    pageUrl: 'https://example.test/kit',
    receivedAt: new Date('2026-05-20T10:00:00Z'),
    anonymousId: 'anon_001',
    ipAnonymized: '1.2.3.0',
    uaHash: 'ua_hash_xyz',
    identity: undefined,
    fbp: 'fb.1.001',
    fbc: 'fb.1.cclick',
    ...overrides,
  };
}
```

### 2.2 Liste des suites par module

| Suite | Fichier | Tests | Couverture cible |
|---|---|---|---|
| `enrichPurchase` | `_enrich-purchase.test.ts` | 5 | 100 % (pure fn) |
| `isValidValue` / `isValidCurrency` | inline dans `_enrich-purchase.test.ts` | 8 cas paramétrés | 100 % |
| `deriveEventId` | `event-id.test.ts` | 7 | 100 % (pure fn) |
| `isBotRequest` | `is-bot.test.ts` | ~15 (8 humans + 5 bots + empty + edge) | 100 % |
| `metaAdapter.dispatch` (guard) | `meta.test.ts` (extension) | 5 | branches purchase = 100 % |
| `TrackingClient.emit` (override) | `client.test.ts` (extension) | 3 | branch eventIdOverride |
| `ViewItemTracker` (seed prop) | `ViewItemTracker.test.tsx` (extension) | 3 | toutes les props |
| `event-mapping.ts` (purchase_server) | `event-mapping.test.ts` (extension) | 1 assertion | n/a |
| `schemas.ts` (P3 strict purchase) | `schemas.test.ts` (extension) | 5 | branches purchase |
| `dedup.ts` (P3 DB) | `dedup.test.ts` (extension) | 4 | toutes les branches |

### 2.3 Pattern « pure fn » — exemples détaillés

**`_enrich-purchase.test.ts`** — utilise `vi.mock` sur `@/lib/db/client` pour isoler la lookup DB :

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enrichPurchase, isValidValue, isValidCurrency } from './_enrich-purchase';

vi.mock('@/lib/db/client', () => ({ db: vi.fn() }));
vi.mock('@/lib/db/schema-orders', () => ({ orders: { /* drizzle proxy */ } }));

import { db } from '@/lib/db/client';

function mockDbReturns(row: { totalCents: number; currency: string } | null) {
  (db as ReturnType<typeof vi.fn>).mockReturnValue({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(row ? [row] : []),
        }),
      }),
    }),
  });
}

describe('enrichPurchase', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns params if value+currency already valid', async () => {
    const result = await enrichPurchase({ transaction_id: 'ord_1', value: 250, currency: 'MAD' });
    expect(result).toEqual({ value: 250, currency: 'MAD', source: 'params' });
    expect(db).not.toHaveBeenCalled(); // pas de query DB inutile
  });

  it('reads from DB if value missing', async () => {
    mockDbReturns({ totalCents: 32000, currency: 'mad' });
    const result = await enrichPurchase({ transaction_id: 'ord_existing' });
    expect(result).toEqual({ value: 320, currency: 'MAD', source: 'db' });
  });

  it('returns unavailable if transaction_id missing', async () => {
    const result = await enrichPurchase({});
    expect(result).toEqual({ source: 'unavailable' });
    expect(db).not.toHaveBeenCalled();
  });

  it('returns unavailable if DB row not found', async () => {
    mockDbReturns(null);
    const result = await enrichPurchase({ transaction_id: 'ord_unknown' });
    expect(result).toEqual({ source: 'unavailable' });
  });

  it('uppercase currency from DB', async () => {
    mockDbReturns({ totalCents: 10000, currency: 'usd' });
    const result = await enrichPurchase({ transaction_id: 'ord_usd' });
    expect(result.currency).toBe('USD');
  });
});

describe('isValidValue / isValidCurrency', () => {
  it.each([
    [0, false],
    [-5, false],
    [NaN, false],
    [Infinity, false],
    [-Infinity, false],
    [0.01, true],
    [320, true],
    [99999.99, true],
  ])('isValidValue(%s) → %s', (input, expected) => {
    expect(isValidValue(input)).toBe(expected);
  });

  it.each([
    ['MAD', true],
    ['USD', true],
    ['EUR', true],
    ['mad', false],
    ['MA', false],
    ['MADD', false],
    ['', false],
    ['12A', false],
  ])('isValidCurrency(%s) → %s', (input, expected) => {
    expect(isValidCurrency(input)).toBe(expected);
  });
});
```

### 2.4 Idempotence et déterminisme

Tous les tests doivent être :
- **Déterministes** : pas de `Math.random()` non-mocké, pas de `new Date()` direct (utiliser `vi.useFakeTimers()`).
- **Isolés** : `beforeEach` clear les mocks.
- **Indépendants de l'ordre d'exécution** : si on lance `vitest --shuffle`, tout passe.

---

## 3. Tests d'intégration MSW

### 3.1 Setup MSW partagé

```ts
// apps/web/src/lib/tracking/__test-utils__/msw-handlers.ts (nouveau)
import { http, HttpResponse } from 'msw';

export const metaCapiHandlers = [
  http.post('https://graph.facebook.com/v19.0/*/events', async ({ request }) => {
    const body = await request.json() as { data: Array<Record<string, unknown>>; test_event_code?: string };
    // On stocke le body dans un test-only registry pour assert ensuite
    metaRequestsLog.push(body);
    return HttpResponse.json({ events_received: body.data.length, fbtrace_id: 'TEST_TRACE_001' });
  }),
];

export const metaRequestsLog: Array<unknown> = [];
export function clearMetaRequests(): void {
  metaRequestsLog.length = 0;
}
```

```ts
// apps/web/src/lib/tracking/server-emit.test.ts
import { setupServer } from 'msw/node';
import { metaCapiHandlers, metaRequestsLog, clearMetaRequests } from './__test-utils__/msw-handlers';

const server = setupServer(...metaCapiHandlers);
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => { server.resetHandlers(); clearMetaRequests(); });
afterAll(() => server.close());
```

### 3.2 Tests `serverEmit` (~8 cas)

```ts
describe('serverEmit', () => {
  it('fires Meta CAPI ViewContent with deterministic event_id', async () => {
    setMockHeaders({ 'user-agent': 'Mozilla/5.0 ...', 'x-forwarded-for': '1.2.3.4' });
    setMockCookies({ fg_session_id: 'sess_001', _fbp: 'fb.1.x' });
    mockEnabledMetaProvider();

    await serverEmit({
      eventName: 'view_item',
      params: { currency: 'MAD', value: 320, items: [{ item_id: 'kit' }] },
      pageId: 'kit',
    });
    // server-emit est void mais on awaite via flush des microtasks
    await new Promise((r) => setImmediate(r));

    expect(metaRequestsLog).toHaveLength(1);
    const req = metaRequestsLog[0] as { data: Array<{ event_id: string; custom_data: Record<string, unknown> }> };
    expect(req.data[0].event_id).toMatch(/^[a-f0-9]{32}$/);
    expect(req.data[0].custom_data).toMatchObject({ value: 320, currency: 'MAD' });
  });

  it('skips if user-agent is bot', async () => {
    setMockHeaders({ 'user-agent': 'Googlebot/2.1' });
    setMockCookies({ fg_session_id: 'sess_001' });
    mockEnabledMetaProvider();

    await serverEmit({ eventName: 'view_item', params: {}, pageId: 'kit' });
    await new Promise((r) => setImmediate(r));

    expect(metaRequestsLog).toHaveLength(0);
  });

  it('skips if no session cookie', async () => {
    setMockHeaders({ 'user-agent': 'Mozilla/5.0 ...' });
    setMockCookies({});
    await serverEmit({ eventName: 'view_item', params: {}, pageId: 'kit' });
    await new Promise((r) => setImmediate(r));
    expect(metaRequestsLog).toHaveLength(0);
  });

  it('skips if Meta provider disabled', async () => {
    setMockHeaders({ 'user-agent': 'Mozilla/5.0 ...' });
    setMockCookies({ fg_session_id: 'sess_001' });
    mockDisabledMetaProvider();
    await serverEmit({ eventName: 'view_item', params: {}, pageId: 'kit' });
    await new Promise((r) => setImmediate(r));
    expect(metaRequestsLog).toHaveLength(0);
  });

  it('skips if consent.ad_storage is denied (RGPD)', async () => {
    setMockHeaders({ 'user-agent': 'Mozilla/5.0 ...' });
    setMockCookies({ fg_session_id: 'sess_001', fg_consent: 'ad_storage=denied' });
    mockEnabledMetaProvider();
    await serverEmit({ eventName: 'view_item', params: {}, pageId: 'kit' });
    await new Promise((r) => setImmediate(r));
    expect(metaRequestsLog).toHaveLength(0);
  });

  it('uses same event_id within 5min window', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
    setMockHeaders({ 'user-agent': 'Mozilla/5.0 ...' });
    setMockCookies({ fg_session_id: 'sess_001' });
    mockEnabledMetaProvider();

    await serverEmit({ eventName: 'view_item', params: { value: 320, currency: 'MAD' }, pageId: 'kit' });
    vi.advanceTimersByTime(60_000); // +1min, same bucket
    await serverEmit({ eventName: 'view_item', params: { value: 320, currency: 'MAD' }, pageId: 'kit' });
    await new Promise((r) => setImmediate(r));

    const ids = metaRequestsLog.map((r) => (r as any).data[0].event_id);
    expect(ids[0]).toBe(ids[1]); // dédup côté Meta possible
    vi.useRealTimers();
  });

  it('logs but does not throw on Meta API failure', async () => {
    server.use(
      http.post('https://graph.facebook.com/v19.0/*/events', () => HttpResponse.error()),
    );
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setMockHeaders({ 'user-agent': 'Mozilla/5.0 ...' });
    setMockCookies({ fg_session_id: 'sess_001' });
    mockEnabledMetaProvider();

    await expect(
      serverEmit({ eventName: 'view_item', params: { value: 320, currency: 'MAD' }, pageId: 'kit' }),
    ).resolves.toBeUndefined();

    await new Promise((r) => setImmediate(r));
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('passes fbp/fbc from cookies to CAPI user_data', async () => {
    setMockHeaders({ 'user-agent': 'Mozilla/5.0 ...' });
    setMockCookies({ fg_session_id: 'sess_001', _fbp: 'fb.1.aaa', _fbc: 'fb.1.bbb' });
    mockEnabledMetaProvider();

    await serverEmit({ eventName: 'view_item', params: { value: 320, currency: 'MAD' }, pageId: 'kit' });
    await new Promise((r) => setImmediate(r));

    const userData = (metaRequestsLog[0] as any).data[0].user_data;
    expect(userData.fbp).toBe('fb.1.aaa');
    expect(userData.fbc).toBe('fb.1.bbb');
  });
});
```

### 3.3 Tests `metaAdapter.dispatch` guard (~5 cas)

Setup MSW identique. Cas couverts en §2.2 du `02-plan-dev-action.md` step 1.2.

---

## 4. Tests E2E Playwright

### 4.1 Spec `kit-view-item-dedup.spec.ts`

```ts
// apps/web/tests/e2e/kit-view-item-dedup.spec.ts (nouveau)
import { test, expect } from '@playwright/test';

test.describe('Kit ViewContent Pixel ↔ CAPI dedup', () => {
  test('Pixel client and CAPI server share the same event_id', async ({ page, request }) => {
    // 1. Intercept Pixel client fbq calls
    const pixelEventIds: string[] = [];
    await page.addInitScript(() => {
      const origFbq = (window as any).fbq;
      (window as any).fbq = function(...args: unknown[]) {
        if (args[0] === 'track' && typeof args[1] === 'string') {
          const opts = args[2] as Record<string, unknown> | undefined;
          const meta = args[3] as { eventID?: string } | undefined;
          if (args[1] === 'ViewContent' && meta?.eventID) {
            (window as any).__capturedEventIds = (window as any).__capturedEventIds || [];
            (window as any).__capturedEventIds.push(meta.eventID);
          }
        }
        return origFbq?.apply(this, args);
      };
    });

    // 2. Load /kit
    await page.goto('/kit');
    await page.waitForLoadState('networkidle');

    // 3. Récupère event_id côté Pixel
    const clientEventIds = await page.evaluate(() => (window as any).__capturedEventIds ?? []);
    expect(clientEventIds.length).toBeGreaterThan(0);

    // 4. Récupère event_id côté CAPI (via API admin de logs ou query DB direct)
    const dbRow = await request.get('/api/admin/tracking/events?event_name=view_item&limit=1', {
      headers: { 'x-admin-token': process.env.ADMIN_TEST_TOKEN! },
    });
    const { events } = await dbRow.json();
    const serverEventId = events[0].event_id;

    // 5. Assertion principale : event_id identique côté Pixel et CAPI server
    expect(clientEventIds).toContain(serverEventId);
  });

  test('serverEmit fires even if client JS disabled', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/kit');
    // Attendre que la requête CAPI ait eu le temps de partir
    await page.waitForTimeout(2000);

    // Vérifier qu'au moins un view_item server-side est en DB
    const apiCtx = await browser.newContext();
    const apiReq = await apiCtx.request.get('/api/admin/tracking/events?event_name=view_item&limit=5', {
      headers: { 'x-admin-token': process.env.ADMIN_TEST_TOKEN! },
    });
    const { events } = await apiReq.json();
    const recent = events.filter((e: { created_at: string }) => Date.now() - new Date(e.created_at).getTime() < 5000);
    expect(recent.length).toBeGreaterThan(0);
  });

  test('Bot UA does not trigger serverEmit', async ({ browser }) => {
    const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)' });
    const page = await ctx.newPage();
    const beforeCount = await getEventCount('view_item');
    await page.goto('/kit');
    await page.waitForTimeout(2000);
    const afterCount = await getEventCount('view_item');
    expect(afterCount).toBe(beforeCount);
  });
});

async function getEventCount(eventName: string): Promise<number> {
  // Helper qui query l'endpoint admin
  // ...
  return 0;
}
```

### 4.2 Setup Playwright

- Variable d'env `ADMIN_TEST_TOKEN` posée dans `.env.test`
- Le test tourne contre la **DB worktree** (pas la prod), via `playwright.config.ts` qui pointe `baseURL: 'http://localhost:3001'` (port worktree dev).

### 4.3 Critères

- Tests E2E exécutés en local + en CI (post P2).
- 3/3 verts avant merge vers master.

---

## 5. Tests de non-régression

### 5.1 Smoke tests post-déploiement

Cf. `04-runbook.md` §5 — checklist HTTP + DB après chaque push prod.

### 5.2 Tests legacy à NE PAS casser

Pendant le développement, à chaque commit :

```bash
pnpm --filter @femiglow/web exec vitest run \
  src/lib/tracking/ \
  src/components/tracking/ \
  src/components/commerce/ \
  src/app/api/track/ \
  src/app/api/stripe/
```

Tous ces tests doivent rester verts (sinon : rollback du commit en cours).

---

## 6. Tests d'observabilité prod

### 6.1 Vue SQL — diff avant/après

Query à archiver avant déploiement P1 :

```sql
-- baseline avant déploiement P1
SELECT * FROM v_purchase_quality WHERE day > NOW() - INTERVAL '7 days';
```

→ noter le `quality_pct` moyen (devrait être ~81 %).

Re-query 24h après déploiement P1 :
→ `quality_pct` doit être ≥ 97 %.

### 6.2 Meta Events Manager

URL : `https://business.facebook.com/events_manager/list/pixel/{PIXEL_ID}/diagnostics`

À vérifier 7j après chaque phase :
- **Purchase qualité value/currency** : doit passer de 81 % → ≥ 95 %.
- **CAPI coverage ViewContent** : doit passer de < 50 % → ≥ 95 %.
- **Aucun nouveau warning** apparu (ex. duplicate events).

---

## 7. Coverage cible

```bash
pnpm --filter @femiglow/web exec vitest run --coverage \
  src/lib/tracking/providers/_enrich-purchase.ts \
  src/lib/tracking/event-id.ts \
  src/lib/tracking/is-bot.ts \
  src/lib/tracking/server-emit.ts
```

Cible : **≥ 90 % statements, branches, functions, lines** sur les fichiers neufs.

Le projet a déjà `@vitest/coverage-v8` installé (`apps/web/package.json:116`).

---

## 8. CI

Pas de modif `.github/workflows/` nécessaire — le pipeline existant lance `pnpm test` + `pnpm typecheck` + `pnpm build`, ce qui couvre déjà les nouveaux tests.

Pour Playwright, si pas déjà en CI :

```yaml
# .github/workflows/e2e.yml (extension)
- name: Run Playwright E2E
  run: pnpm --filter @femiglow/web exec playwright test tests/e2e/kit-view-item-dedup.spec.ts
  env:
    ADMIN_TEST_TOKEN: ${{ secrets.ADMIN_TEST_TOKEN }}
```

---

## 9. Récapitulatif tests à créer/étendre

| Fichier | Type | Cas | Status |
|---|---|---|---|
| `_enrich-purchase.test.ts` | Vitest unit | 13 (5 enrich + 8 valid) | À créer P1.1 |
| `meta.test.ts` (ext.) | Vitest+MSW | +5 | À étendre P1.2 |
| `event-mapping.test.ts` (ext.) | Vitest unit | +1 | À étendre P1.3 |
| `event-id.test.ts` | Vitest unit | 7 | À créer P2.1 |
| `is-bot.test.ts` | Vitest unit | ~15 | À créer P2.2 |
| `server-emit.test.ts` | Vitest+MSW | 8 | À créer P2.3 |
| `ViewItemTracker.test.tsx` (ext.) | Vitest+RTL | +3 | À étendre P2.4 |
| `client.test.ts` (ext.) | Vitest unit | +3 | À étendre P2.5 |
| `exporter.test.ts` (ext.) | Vitest unit | +1 (snapshot eventID) | À étendre P2.9 |
| `schemas.test.ts` (ext.) | Vitest unit | +5 | À étendre P3.1 |
| `dedup.test.ts` (ext.) | Vitest unit | +4 | À étendre P3.2 |
| `kit-view-item-dedup.spec.ts` | Playwright | 3 | À créer P2 gate |

**Total : ~68 cas, dont ~55 neufs.**

---

> **Suite** : voir [`04-runbook.md`](./04-runbook.md) pour les commandes d'exécution réelles.
