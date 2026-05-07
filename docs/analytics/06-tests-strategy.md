# 06 — Stratégie de tests

> Comment on **valide** que le système analytics fonctionne, ne régresse pas, et reste maintenable. Trois étages : **Vitest** (unit + integration React), **MSW** (mock API pour stories isolées), **Playwright** (E2E + flux user complets). Chaque composant et chaque endpoint est rattaché à un type de test précis.

## §1 — Pyramide & règles

```
                ┌──────────────┐
                │   Playwright │   ← 8-12 scénarios (golden paths + critical edges)
                └──────────────┘
              ┌──────────────────┐
              │  Vitest + MSW    │   ← ~150 tests (composants + hooks + API contract)
              └──────────────────┘
            ┌────────────────────────┐
            │     Vitest unit        │   ← ~250 tests (utils, queries, formatters)
            └────────────────────────┘
```

### 1.1 Règles d'or

1. **Test = doc**. Un test doit lire comme une spec : `it('compte les sessions uniques sur 7j', …)`.
2. **Pas de tests fragiles**. On teste un comportement (`renders sessions count`), pas une implémentation (`uses useState`).
3. **Pas de snapshot opaque**. Les snapshots sont autorisés uniquement pour les SVG charts (vérification visuelle ciblée).
4. **MSW pour TOUTES les API** dans les tests composants. Pas de `fetch.mockResolvedValue` ad-hoc.
5. **Aucun test ne tape la vraie DB**. Les tests d'intégration utilisent `test-db` (Postgres dockerisé) avec fixtures déterministes.
6. **A11y systématique**. Chaque composant testé doit passer `expectNoAxeViolations` (utility existant `@/test/axe`).
7. **Couverture cible** : 85 % statements sur `lib/analytics/` et `components/admin/analytics/`. **Pas négociable** sur les utilitaires (queries, attribution, filters).

### 1.2 Outillage existant à réutiliser

| Outil | Path | Usage |
|---|---|---|
| Vitest | `vitest.config.ts` | Runner unifié |
| Testing Library | `@testing-library/react` | Render composants |
| MSW | déjà utilisé pour `apps/web/src/test/mswSetup.ts` (à étendre) | Mock API |
| Playwright | `apps/web/playwright.config.ts` | E2E |
| `@/test/axe` | `apps/web/src/test/axe.ts` | A11y violation check |
| `@/test/factories` | (à créer) | Factories d'événements et sessions |

## §2 — Factories & fixtures

### 2.1 Event factory

```ts
// apps/web/src/test/factories/event.ts
import { faker } from '@faker-js/faker/locale/fr';
import type { TrackingEventLogRow } from '@/lib/db/schema/tracking';

export function makeEvent(overrides: Partial<TrackingEventLogRow> = {}): TrackingEventLogRow {
  const sessionId = overrides.session_id ?? faker.string.uuid();
  return {
    id: faker.number.int({ min: 1, max: 999_999 }),
    event_id: faker.string.uuid(),
    event_name: 'page_view',
    event_category: 'engagement',
    session_id: sessionId,
    anonymous_id: faker.string.uuid(),
    user_id: null,
    page_route: '/kit',
    locale: 'fr',
    device: 'mobile',
    received_at: faker.date.recent({ days: 1 }),
    payload: {},
    consent_snapshot: { analytics_storage: 'granted' },
    is_conversion: false,
    traffic_source: 'direct',
    traffic_medium: null,
    experiment_id: null,
    ...overrides,
  };
}

export function makeSession(events: Partial<TrackingEventLogRow>[]): TrackingEventLogRow[] {
  const sessionId = faker.string.uuid();
  const anonymousId = faker.string.uuid();
  const baseTime = faker.date.recent({ days: 1 });
  return events.map((e, i) =>
    makeEvent({
      session_id: sessionId,
      anonymous_id: anonymousId,
      received_at: new Date(baseTime.getTime() + i * 1000),
      ...e,
    }),
  );
}
```

### 2.2 Funnel scenario factory

```ts
// apps/web/src/test/factories/funnel.ts
export function makeFullFunnelSession(opts: { device?: 'mobile' | 'desktop'; traffic?: string } = {}) {
  return makeSession([
    { event_name: 'page_view', page_route: '/kit', device: opts.device, traffic_source: opts.traffic },
    { event_name: 'view_item', page_route: '/kit', device: opts.device },
    { event_name: 'scroll_depth_50', page_route: '/kit', device: opts.device },
    { event_name: 'cta_click', page_route: '/kit', payload: { cta_intent: 'purchase' } },
    { event_name: 'add_to_cart', page_route: '/kit' },
    { event_name: 'begin_checkout', page_route: '/checkout' },
    { event_name: 'purchase', page_route: '/checkout/confirmation', payload: { value: 320, currency: 'MAD' } },
  ]);
}

export function makeAbandonedAtCart() {
  return makeSession([
    { event_name: 'page_view', page_route: '/kit' },
    { event_name: 'view_item', page_route: '/kit' },
    { event_name: 'add_to_cart', page_route: '/kit' },
    // pas de checkout
  ]);
}
```

### 2.3 Test DB setup

Pour les queries SQL, on utilise `pgTAP`-like via Drizzle :

```ts
// apps/web/src/test/db.ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';

export async function createTestDb() {
  const client = new Client({ connectionString: process.env.TEST_DATABASE_URL });
  await client.connect();
  const db = drizzle(client);
  await db.execute(sql`TRUNCATE tracking_events_log CASCADE`);
  return { db, cleanup: () => client.end() };
}

export async function seedEvents(db, events) {
  await db.insert(trackingEventsLog).values(events);
  await db.execute(sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_overview_hourly`);
}
```

`docker-compose.test.yml` (à ajouter) lance Postgres 16 sur port 5433. CI utilise un service Postgres GitHub Actions.

## §3 — Tests Vitest unit

### 3.1 `lib/analytics/attribution.test.ts`

```ts
import { classifyTraffic } from './attribution';

describe('classifyTraffic', () => {
  it.each([
    [{ utm_source: 'google', utm_medium: 'cpc' }, undefined, 'google'],
    [{ utm_source: 'meta', utm_medium: 'paid_social' }, undefined, 'meta'],
    [{ utm_source: 'facebook' }, undefined, 'meta'],
    [{ utm_source: 'tiktok' }, undefined, 'tiktok'],
    [{ utm_source: 'snapchat' }, undefined, 'snap'],
    [{ utm_source: 'pinterest' }, undefined, 'pinterest'],
    [{}, 'https://t.co/xyz', 'twitter'],
    [{}, 'https://www.google.com/', 'google'],
    [{}, 'https://www.bing.com/', 'bing'],
    [{}, undefined, 'direct'],
    [{ utm_medium: 'email' }, undefined, 'email'],
    [{ utm_source: 'partner123', utm_medium: 'affiliate' }, undefined, 'affiliate'],
  ])('%s + referrer %s → %s', (utm, referrer, expected) => {
    expect(classifyTraffic({ utm, referrer })).toBe(expected);
  });

  it('priorise utm sur referrer', () => {
    expect(classifyTraffic({ utm: { utm_source: 'meta' }, referrer: 'https://google.com' }))
      .toBe('meta');
  });

  it('fallback "other" pour utm_source inconnu', () => {
    expect(classifyTraffic({ utm: { utm_source: 'mystery_partner' } })).toBe('other');
  });
});
```

### 3.2 `lib/analytics/filters.test.ts`

```ts
import { AnalyticsFiltersSchema, parseFiltersFromUrl } from './filters';

describe('AnalyticsFiltersSchema', () => {
  it('accepte les défauts', () => {
    expect(AnalyticsFiltersSchema.parse({})).toEqual({
      period: 'today',
      device: 'mobile',
      traffic: 'all',
    });
  });

  it('valide period custom avec from/to', () => {
    const r = AnalyticsFiltersSchema.parse({
      period: 'custom',
      from: '2026-04-01',
      to: '2026-05-01',
    });
    expect(r.from).toEqual(new Date('2026-04-01'));
  });

  it('refuse from > to', () => {
    expect(() =>
      AnalyticsFiltersSchema.parse({ period: 'custom', from: '2026-05-01', to: '2026-04-01' }),
    ).toThrow(/from must be before to/);
  });

  it('refuse plage > 365 jours', () => {
    expect(() =>
      AnalyticsFiltersSchema.parse({ period: 'custom', from: '2025-01-01', to: '2026-05-01' }),
    ).toThrow(/range too large/);
  });
});

describe('parseFiltersFromUrl', () => {
  it('lit les query params', () => {
    const url = new URL('https://x.com?period=7d&device=desktop&traffic=google');
    expect(parseFiltersFromUrl(url.searchParams).period).toBe('7d');
  });
});
```

### 3.3 `lib/analytics/format.test.ts`

```ts
describe('formatDuration', () => {
  it.each([
    [0, '0s'],
    [45, '45s'],
    [60, '1m 0s'],
    [125, '2m 5s'],
    [3600, '1h 0m'],
    [3725, '1h 2m'],
  ])('%d s → %s', (s, expected) => {
    expect(formatDuration(s)).toBe(expected);
  });
});

describe('formatPercent', () => {
  it('arrondit à 1 décimale', () => {
    expect(formatPercent(0.12345)).toBe('12,3 %');
  });
  it('gère les zéros', () => {
    expect(formatPercent(0)).toBe('0 %');
  });
  it('gère les undefined', () => {
    expect(formatPercent(undefined)).toBe('—');
  });
});
```

### 3.4 `lib/analytics/queries/overview.test.ts` (intégration DB)

```ts
import { createTestDb, seedEvents } from '@/test/db';
import { fetchOverviewKpi } from './overview';
import { makeFullFunnelSession, makeAbandonedAtCart } from '@/test/factories/funnel';

describe('fetchOverviewKpi', () => {
  let testDb;
  beforeAll(async () => {
    testDb = await createTestDb();
  });
  afterAll(() => testDb.cleanup());

  beforeEach(async () => {
    await testDb.db.execute(sql`TRUNCATE tracking_events_log CASCADE`);
  });

  it('compte les sessions uniques', async () => {
    await seedEvents(testDb.db, [
      ...makeFullFunnelSession(),
      ...makeFullFunnelSession(),
      ...makeAbandonedAtCart(),
    ]);
    const r = await fetchOverviewKpi(testDb.db, {
      from: new Date('2026-05-05'),
      to: new Date('2026-05-07'),
      device: null,
      source: null,
    });
    expect(r.sessions).toBe(3);
    expect(r.purchases).toBe(2);
    expect(r.conversion_rate).toBeCloseTo(2 / 3, 4);
  });

  it('respecte le filtre device', async () => {
    await seedEvents(testDb.db, [
      ...makeFullFunnelSession({ device: 'mobile' }),
      ...makeFullFunnelSession({ device: 'desktop' }),
    ]);
    const r = await fetchOverviewKpi(testDb.db, {
      from: new Date('2026-05-05'),
      to: new Date('2026-05-07'),
      device: 'mobile',
      source: null,
    });
    expect(r.sessions).toBe(1);
  });

  it('exclut les events sans consent_storage = granted', async () => {
    const events = makeFullFunnelSession();
    events.forEach((e) => (e.consent_snapshot = { analytics_storage: 'denied' }));
    await seedEvents(testDb.db, events);
    const r = await fetchOverviewKpi(testDb.db, /* ... */);
    expect(r.sessions).toBe(0);
  });
});
```

## §4 — Tests Vitest + MSW (composants)

### 4.1 Setup MSW étendu

```ts
// apps/web/src/test/handlers/analytics.ts
import { http, HttpResponse } from 'msw';

export const analyticsHandlers = [
  http.get('/api/admin/analytics/overview', ({ request }) => {
    const url = new URL(request.url);
    const period = url.searchParams.get('period') ?? 'today';
    return HttpResponse.json({
      kpi: {
        sessions: 12340,
        unique_visitors: 9876,
        page_views: 23456,
        avg_session_duration_s: 145,
        bounce_rate: 0.42,
        conversion_rate: 0.012,
      },
      series: { sessions_by_day: [/* ... */] },
      previous_period: { sessions: 11000 },
    });
  }),
  http.get('/api/admin/analytics/live', () =>
    HttpResponse.json({
      online_users: 42,
      conversions_1h: 3,
      cta_purchases_1h: 12,
      by_page: [],
      by_source: [],
      by_device: [],
    }),
  ),
  // ... checkout, cta, funnel
];
```

### 4.2 KpiCard

```ts
describe('<KpiCard>', () => {
  it('rend valeur, label et delta', () => {
    render(
      <KpiCard
        label="Sessions"
        value={12340}
        format="number"
        delta={{ value: 0.124, direction: 'up' }}
        comparisonLabel="vs 7j précédents"
      />,
    );
    expect(screen.getByText('SESSIONS')).toBeInTheDocument();
    expect(screen.getByText('12 340')).toBeInTheDocument();
    expect(screen.getByText(/12,4 %/)).toBeInTheDocument();
    expect(screen.getByText(/vs 7j/i)).toBeInTheDocument();
  });

  it('affiche skeleton en loading', () => {
    render(<KpiCard label="Sessions" loading />);
    expect(screen.getByTestId('kpi-skeleton')).toBeInTheDocument();
    expect(screen.queryByText(/SESSIONS/i)).not.toBeInTheDocument();
  });

  it('affiche em-dash si valeur nulle', () => {
    render(<KpiCard label="Sessions" value={null} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('flèche selon direction', () => {
    const { rerender } = render(
      <KpiCard label="X" value={1} delta={{ value: 0.1, direction: 'up' }} />,
    );
    expect(screen.getByText(/↑/)).toBeInTheDocument();
    rerender(<KpiCard label="X" value={1} delta={{ value: -0.1, direction: 'down' }} />);
    expect(screen.getByText(/↓/)).toBeInTheDocument();
  });

  it('respecte axe', async () => {
    const { container } = render(<KpiCard label="Sessions" value={100} />);
    await expectNoAxeViolations(container);
  });

  it('rend un lien si href fourni', () => {
    render(<KpiCard label="X" value={1} href="/admin/analytics?period=7d" />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/admin/analytics?period=7d');
  });
});
```

### 4.3 FilterBar

```ts
describe('<FilterBar>', () => {
  it('rend les 3 selects et le reset', () => {
    render(<FilterBar filters={defaultFilters} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/période/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/device/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/trafic/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reset/i })).toBeInTheDocument();
  });

  it('appelle onChange à la sélection période', async () => {
    const onChange = vi.fn();
    render(<FilterBar filters={defaultFilters} onChange={onChange} />);
    await userEvent.selectOptions(screen.getByLabelText(/période/i), '7d');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ period: '7d' }));
  });

  it('reset remet aux defaults', async () => {
    const onChange = vi.fn();
    render(<FilterBar filters={{ period: '30d', device: 'desktop', traffic: 'google' }} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect(onChange).toHaveBeenCalledWith({ period: 'today', device: 'mobile', traffic: 'all' });
  });

  it('ouvre DateRangePicker quand period=custom', async () => {
    render(<FilterBar filters={defaultFilters} onChange={vi.fn()} showCustomRange />);
    await userEvent.selectOptions(screen.getByLabelText(/période/i), 'custom');
    expect(screen.getByRole('dialog', { name: /plage personnalisée/i })).toBeInTheDocument();
  });
});
```

### 4.4 OverviewKpiGrid (intégration MSW)

```ts
import { server } from '@/test/mswSetup';
import { analyticsHandlers } from '@/test/handlers/analytics';

beforeAll(() => server.use(...analyticsHandlers));

describe('<OverviewKpiGrid>', () => {
  it('charge et rend les 6 KPI', async () => {
    render(<OverviewKpiGrid filters={defaultFilters} />);
    await waitFor(() => {
      expect(screen.getByText('12 340')).toBeInTheDocument();
    });
    expect(screen.getByText('SESSIONS')).toBeInTheDocument();
    expect(screen.getByText('VISITEURS UNIQUES')).toBeInTheDocument();
    // ... 4 autres
  });

  it('affiche état error si API renvoie 500', async () => {
    server.use(
      http.get('/api/admin/analytics/overview', () =>
        HttpResponse.json({ error: { code: 'INTERNAL', message: 'oops' } }, { status: 500 }),
      ),
    );
    render(<OverviewKpiGrid filters={defaultFilters} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/erreur/i);
  });

  it('refetch quand filters changent', async () => {
    const { rerender } = render(<OverviewKpiGrid filters={{ period: 'today', device: 'mobile', traffic: 'all' }} />);
    await screen.findByText('12 340');
    rerender(<OverviewKpiGrid filters={{ period: '7d', device: 'mobile', traffic: 'all' }} />);
    // assert refetch via spy ou via différent payload
  });
});
```

### 4.5 LiveEventStream (SSE simulation)

MSW supporte SSE via `http.get(url, () => new HttpResponse(stream, { headers: ... }))`.

```ts
describe('<LiveEventStream>', () => {
  it('affiche les events à mesure que SSE pousse', async () => {
    let push: (event: any) => void;
    server.use(
      http.get('/api/admin/analytics/live/stream', () => {
        const stream = new ReadableStream({
          start(controller) {
            push = (e) => controller.enqueue(`data: ${JSON.stringify(e)}\n\n`);
          },
        });
        return new HttpResponse(stream, { headers: { 'Content-Type': 'text/event-stream' } });
      }),
    );
    render(<LiveEventStream />);
    push!({ event_name: 'page_view', page_route: '/kit', received_at: new Date().toISOString() });
    expect(await screen.findByText('page_view')).toBeInTheDocument();
  });

  it('limite le buffer à 100 events', async () => {
    // simule 150 events, vérifie que la 1ère est purgée
  });

  it('pause arrête l\'arrivée', async () => {
    // simule push, click pause, push, vérifie que le 2nd n'apparaît pas
  });

  it('respecte prefers-reduced-motion (pas d\'animation)', () => {
    const matchMediaSpy = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as any);
    // assert pas de classe animate-pulse
  });
});
```

### 4.6 FunnelStepper

```ts
describe('<FunnelStepper>', () => {
  it('rend tous les steps avec valeurs et %', () => {
    render(
      <FunnelStepper
        orientation="horizontal"
        steps={[
          { label: 'View', value: 100, share: 1.0 },
          { label: 'Cart', value: 10, share: 0.10, drop: 0.90 },
        ]}
        showDrop
      />,
    );
    expect(screen.getByText('View')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Cart')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText(/10[,.]0?\s?%/)).toBeInTheDocument();
    expect(screen.getByText(/-90[,.]0?\s?%/)).toBeInTheDocument();
  });

  it('rend en mode vertical', () => {
    const { container } = render(<FunnelStepper orientation="vertical" steps={mockSteps} />);
    expect(container.querySelector('[data-orientation="vertical"]')).toBeTruthy();
  });

  it('expose une table sr-only équivalente (a11y)', () => {
    render(<FunnelStepper orientation="horizontal" steps={mockSteps} />);
    const table = screen.getByRole('table', { hidden: true });
    expect(table).toBeInTheDocument();
  });

  it('respecte axe', async () => {
    const { container } = render(<FunnelStepper orientation="horizontal" steps={mockSteps} />);
    await expectNoAxeViolations(container);
  });
});
```

### 4.7 ChartFrame

```ts
describe('<ChartFrame>', () => {
  it('rend titre et description', () => {
    render(<ChartFrame title="Sessions" description="Évolution"><div>chart</div></ChartFrame>);
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('Évolution')).toBeInTheDocument();
  });

  it('skeleton si loading', () => {
    render(<ChartFrame title="X" loading><div>chart</div></ChartFrame>);
    expect(screen.getByTestId('chart-skeleton')).toBeInTheDocument();
  });

  it('empty state si data vide', () => {
    render(<ChartFrame title="X" empty><div>chart</div></ChartFrame>);
    expect(screen.getByText(/aucune donnée/i)).toBeInTheDocument();
  });

  it('error state', () => {
    render(<ChartFrame title="X" error={new Error('oops')}><div>chart</div></ChartFrame>);
    expect(screen.getByRole('alert')).toHaveTextContent(/oops|erreur/i);
  });
});
```

## §5 — Tests E2E Playwright

### 5.1 Configuration

```ts
// apps/web/playwright/analytics.spec.ts
import { test, expect } from '@playwright/test';
import { loginAsAdmin, seedScenario } from './helpers';

test.beforeEach(async ({ page }) => {
  await loginAsAdmin(page);
  await seedScenario('full-funnel-7d'); // helper qui pré-remplit la DB de test
});
```

### 5.2 Scénarios golden path

#### 5.2.1 Vue d'ensemble — défauts et changement de période

```ts
test('Vue d\'ensemble charge avec les défauts (Mobile · Aujourd\'hui · Tout)', async ({ page }) => {
  await page.goto('/admin/analytics');

  await expect(page.getByLabel('Période')).toHaveValue('today');
  await expect(page.getByLabel('Device')).toHaveValue('mobile');
  await expect(page.getByLabel('Trafic')).toHaveValue('all');

  await expect(page.getByText('SESSIONS')).toBeVisible();
  await expect(page.getByText('TAUX DE CONVERSION')).toBeVisible();

  // Charts présents
  await expect(page.getByRole('region', { name: /sessions par jour/i })).toBeVisible();
});

test('Changer la période rafraîchit les KPI et l\'URL', async ({ page }) => {
  await page.goto('/admin/analytics');
  await page.getByLabel('Période').selectOption('7d');
  await expect(page).toHaveURL(/period=7d/);
  // attendre que les nouvelles données arrivent (assertion sur valeur changée)
});

test('Reset filters retourne aux défauts et nettoie l\'URL', async ({ page }) => {
  await page.goto('/admin/analytics?period=30d&device=desktop&traffic=google');
  await page.getByRole('button', { name: /reset/i }).click();
  await expect(page).not.toHaveURL(/period=/);
  await expect(page.getByLabel('Période')).toHaveValue('today');
});

test('Custom range ouvre le date picker', async ({ page }) => {
  await page.goto('/admin/analytics');
  await page.getByLabel('Période').selectOption('custom');
  await expect(page.getByRole('dialog', { name: /plage personnalisée/i })).toBeVisible();
});
```

#### 5.2.2 Live — affichage temps réel et pause

```ts
test('Live affiche les KPI BIG et le stream', async ({ page }) => {
  await page.goto('/admin/analytics/live');
  await expect(page.getByText(/en ligne/i)).toBeVisible();
  await expect(page.getByText(/conversions/i)).toBeVisible();
  // Pulse rouge animé
  await expect(page.locator('[data-testid="live-pulse"]')).toBeVisible();
});

test('Live stream reçoit un event simulé', async ({ page }) => {
  await page.goto('/admin/analytics/live');
  // Simule un event via /api/track
  await page.request.post('/api/track', {
    data: makeEventPayload({ event_name: 'page_view', page_route: '/kit' }),
  });
  await expect(page.getByText('page_view').first()).toBeVisible({ timeout: 10000 });
});

test('Pause arrête le flux', async ({ page }) => {
  await page.goto('/admin/analytics/live');
  await page.getByRole('button', { name: /pause/i }).click();
  await page.request.post('/api/track', { data: makeEventPayload() });
  // Attendre 6s : l'event ne doit pas apparaître
  await page.waitForTimeout(6000);
  // Si stream affichait déjà des events, capturer le compteur avant click et vérifier inchangé
});
```

#### 5.2.3 Funnel — drill-down

```ts
test('Funnel affiche les 5 stages', async ({ page }) => {
  await page.goto('/admin/analytics/funnel');
  await expect(page.getByText('View')).toBeVisible();
  await expect(page.getByText('Engage')).toBeVisible();
  await expect(page.getByText('CTA')).toBeVisible();
  await expect(page.getByText('Checkout')).toBeVisible();
  await expect(page.getByText('Purchase')).toBeVisible();
});

test('Sankey funnel × pages se rend', async ({ page }) => {
  await page.goto('/admin/analytics/funnel');
  await expect(page.getByRole('region', { name: /sankey/i })).toBeVisible();
});
```

#### 5.2.4 CTA — top messages

```ts
test('CTA affiche le tableau et top messages', async ({ page }) => {
  await page.goto('/admin/analytics/cta');
  await expect(page.getByText('IMPRESSIONS CTA')).toBeVisible();
  // Tri par CR
  await page.getByRole('button', { name: /CR ↕/i }).click();
  // Vérifier ordre
});

test('Export CSV', async ({ page }) => {
  await page.goto('/admin/analytics/cta');
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /exporter csv/i }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/cta-.*\.csv/);
});
```

#### 5.2.5 Checkout — funnel + erreurs

```ts
test('Checkout affiche funnel et histogramme', async ({ page }) => {
  await page.goto('/admin/analytics/checkout');
  await expect(page.getByText('VUES PANIER')).toBeVisible();
  await expect(page.getByRole('region', { name: /time to submit/i })).toBeVisible();
});
```

### 5.3 Scénarios edge

#### 5.3.1 Permission

```ts
test('Non admin redirigé', async ({ page }) => {
  await page.context().clearCookies();
  await page.goto('/admin/analytics');
  await expect(page).toHaveURL(/login|admin$/);
});
```

#### 5.3.2 Données vides

```ts
test('Période sans données affiche em-dash', async ({ page }) => {
  await seedScenario('empty');
  await page.goto('/admin/analytics?period=today');
  await expect(page.getByText('—').first()).toBeVisible();
});
```

#### 5.3.3 Vidéo audit

```ts
test('Autoplay vidéo n\'incrémente pas user engagement', async ({ page }) => {
  await page.goto('/kit'); // page publique
  // Attendre que la vidéo autoplay
  await page.waitForTimeout(2000);
  // Aller à l'admin live
  await page.goto('/admin/analytics/live');
  // Vérifier qu'il n'y a pas de video_user_play
  const userPlayEvents = await page.locator('[data-event="video_user_play"]').count();
  expect(userPlayEvents).toBe(0);
  // Mais bien un video_autoplay_view (catégorie passive)
  await expect(page.locator('[data-event="video_autoplay_view"]')).toBeVisible();
});

test('Click play utilisateur émet video_user_play', async ({ page }) => {
  await page.goto('/kit');
  await page.locator('video').first().evaluate((el: HTMLVideoElement) => el.play());
  // Note: l'autoplay se fait avant, on ajoute click manuel = user_play
  await page.locator('[data-cta-id="hero-cta"]').click(); // ou bouton play exposé
  await page.goto('/admin/analytics/live');
  await expect(page.locator('[data-event="video_user_play"]').first()).toBeVisible({ timeout: 5000 });
});
```

#### 5.3.4 RGPD

```ts
test('Sans consent, events ne remontent pas dans les KPI', async ({ page }) => {
  await page.goto('/kit');
  // Refuser cookies
  await page.getByRole('button', { name: /refuser/i }).click();
  // Naviguer dans le site → events émis avec consent denied
  await page.goto('/rituel');
  // Côté admin
  await page.goto('/admin/analytics?period=today');
  // Vérifier que les events ne sont pas comptés (assertion sur compteur attendu)
});
```

#### 5.3.5 SSE déconnexion

```ts
test('SSE perd connexion → fallback polling', async ({ page, context }) => {
  await page.goto('/admin/analytics/live');
  // Couper connexion en blockant /stream/
  await context.route('**/api/admin/analytics/live/stream', (route) => route.abort());
  await page.waitForTimeout(35000); // > 30s = bascule polling
  await expect(page.getByText(/connexion temps réel perdue|reconnex/i)).toBeVisible();
  // Polling actif : vérifier que les KPI continuent à se mettre à jour
});
```

### 5.4 Visual regression (optionnel V2)

```ts
test('Vue d\'ensemble — capture visuelle', async ({ page }) => {
  await page.goto('/admin/analytics');
  await page.waitForLoadState('networkidle');
  await expect(page).toHaveScreenshot('overview.png', { maxDiffPixelRatio: 0.02 });
});
```

## §6 — Tests par onglet — checklist exhaustive

### 6.1 Vue d'ensemble

- [ ] 6 KPI rendus avec valeurs corrects depuis MSW
- [ ] Skeleton pendant loading
- [ ] EmptyState si aucune donnée
- [ ] ErrorState si API 500
- [ ] Filtres period/device/traffic refetch
- [ ] URL sync (entrée + sortie)
- [ ] Defaults Mobile/Today/All (Vitest test depuis localStorage vide)
- [ ] localStorage hydraté → restore filters précédents
- [ ] Delta vs période précédente correct
- [ ] Top sources rendu, top pages rendu
- [ ] Export CSV fonctionne
- [ ] A11y axe pass

### 6.2 Live

- [ ] 3 BIG KPI rendus
- [ ] LivePulse animée (sauf reduce-motion)
- [ ] Stream événements fonctionne (MSW + SSE)
- [ ] Pause/Resume
- [ ] Filtre catégorie events
- [ ] Window selector 1h/2h/3h
- [ ] Buffer cap 100 events (Vitest)
- [ ] Reconnexion auto SSE (E2E avec abort)
- [ ] Fallback polling si SSE down 3 fois
- [ ] Funnel TOF/MOF/BOF live se met à jour
- [ ] Click event ouvre side panel JSON

### 6.3 Funnel

- [ ] FunnelStepper 5 stages
- [ ] Drop-off rates corrects (Vitest avec factories)
- [ ] Sankey rendu
- [ ] DataTable funnel par page sortable
- [ ] Filtres period/device/traffic appliqués
- [ ] Time-to-next-step P50 affiché

### 6.4 CTA

- [ ] 4 KPI globaux rendus
- [ ] Tableau CTA principal sortable par CR
- [ ] Top messages BarChart
- [ ] Top pages → achat DataTable
- [ ] Export CSV
- [ ] Component supprimé affiché en gris
- [ ] Attribution 7-day window (Vitest queries)

### 6.5 Checkout

- [ ] 4 KPI rendus
- [ ] FunnelStepper checkout
- [ ] Histogram time-to-submit avec P25/50/75/95
- [ ] Top form errors
- [ ] Champs abandonnés
- [ ] Webhook fallback purchase (test integration)
- [ ] Outliers > 30 min plafonnés (Vitest queries)

### 6.6 Audit événements (point g)

- [ ] `useFormTracking` émet sur pagehide (Vitest)
- [ ] IntersectionObserver unobserve après 1er hit
- [ ] Throttle scroll_depth ≥ 300 ms
- [ ] `video_autoplay_view` distinct de `video_user_play`
- [ ] `*Fired.current` empêche double-emit (Vitest sur composant)
- [ ] Script `scripts/check-event-emit-patterns.ts` détecte les patterns interdits

## §7 — Test data scenarios (présets)

```ts
// apps/web/src/test/scenarios.ts
export const SCENARIOS = {
  'empty': () => [],
  'minimal': () => [...makeFullFunnelSession()],
  'full-funnel-7d': () => [
    ...Array.from({ length: 50 }, () => makeFullFunnelSession()),
    ...Array.from({ length: 200 }, () => makeAbandonedAtCart()),
    ...Array.from({ length: 500 }, () => makeBounceSession()),
  ],
  'high-volume-1h': () => /* 5000 events sur 1h */,
  'mixed-devices': () => /* mix mobile/desktop/tablet */,
  'multi-source': () => /* google + meta + direct */,
  'video-autoplay-only': () => /* sessions avec autoplay sans user_play */,
  'form-abandoners': () => /* sessions abandonnant à différents champs */,
};
```

## §8 — CI / pipeline

```yaml
# .github/workflows/analytics-tests.yml (extrait)
jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run test:unit -- --coverage
      - uses: codecov/codecov-action@v4

  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: test, POSTGRES_DB: femiglow_test }
        ports: ['5433:5432']
    steps:
      - run: npm run test:integration
        env: { TEST_DATABASE_URL: postgres://postgres:test@localhost:5433/femiglow_test }

  e2e:
    runs-on: ubuntu-latest
    services:
      postgres: { ... }
    steps:
      - run: npx playwright install --with-deps
      - run: npm run test:e2e -- --project=chromium
      - run: npm run test:e2e -- --project=mobile
```

Triggers : push sur `main`, PR, et tag `analytics:*`. Coverage report posté en commentaire PR.

## §9 — Checklist avant release

- [ ] Tous les tests unit passent (npm run test:unit)
- [ ] Tests d'intégration passent (npm run test:integration)
- [ ] Tests E2E passent sur Chromium **et** Mobile Safari
- [ ] Coverage `lib/analytics/` ≥ 85 %
- [ ] Coverage `components/admin/analytics/` ≥ 80 %
- [ ] Aucun `expectNoAxeViolations` failed
- [ ] Lighthouse mobile sur `/admin/analytics` ≥ 90 perf, ≥ 95 a11y
- [ ] Bundle JS analytics < 80 KB gzipped (analyse via `next build` rapport)
- [ ] Aucun warning hydration dans la console pendant les tests E2E
- [ ] Script `check-event-emit-patterns.ts` retourne 0
- [ ] Sentry receive 0 erreur sur staging pendant 24 h après déploiement

---

**Suite** : `07-runbook-roadmap.md` — plan de phases, runbook prod, troubleshooting.
