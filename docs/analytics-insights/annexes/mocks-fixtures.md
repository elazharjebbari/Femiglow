# Annexe — Mocks & fixtures

> *Fixtures MSW pour les tests*

---

## 1. Vue d'ensemble

Les fixtures sont centralisées dans
`apps/web/src/test/fixtures/insights/`. Une fixture par grand
endpoint, déterministe (timestamps figés), réutilisable.

```
src/test/fixtures/insights/
├── overview.fixture.ts
├── pages.fixture.ts
├── components.fixture.ts
├── sections.fixture.ts
├── funnel.fixture.ts
├── refresh.fixture.ts
├── empty.fixture.ts
└── helpers.ts
```

## 2. Fixture `overview`

```ts
// src/test/fixtures/insights/overview.fixture.ts
import type { OverviewResponse } from '@/lib/analytics/insights/contracts';

export const FIXTURE_REFRESHED_AT = '2026-05-07T12:00:00.000Z';

export const FIXTURE_OVERVIEW: OverviewResponse = {
  kpis: {
    totalEvents: 12_437,
    uniqueSessions: 3_210,
    pageViews: 8_940,
    conversions: 42,
    avgEventsPerSession: 3.87,
    bounceRate: 0.312,
  },
  variations: {
    totalEvents: 0.14,
    uniqueSessions: 0.08,
    pageViews: -0.02,
    conversions: 0.12,
    avgEventsPerSession: 0.05,
    bounceRate: -0.03,
  },
  timeseries: [
    { date: '2026-05-01', events: 1_800, sessions: 480, conversions: 6 },
    { date: '2026-05-02', events: 1_900, sessions: 510, conversions: 8 },
    { date: '2026-05-03', events: 1_650, sessions: 440, conversions: 4 },
    { date: '2026-05-04', events: 1_720, sessions: 460, conversions: 5 },
    { date: '2026-05-05', events: 1_950, sessions: 520, conversions: 7 },
    { date: '2026-05-06', events: 1_840, sessions: 490, conversions: 6 },
    { date: '2026-05-07', events: 1_577, sessions: 410, conversions: 6 },
  ],
  heatmap: buildHeatmapFixture(),
  refreshedAt: FIXTURE_REFRESHED_AT,
};

function buildHeatmapFixture() {
  const cells = [];
  for (let dow = 0; dow < 7; dow++) {
    for (let h = 0; h < 24; h++) {
      cells.push({
        hour: h,
        dayOfWeek: dow,
        count: Math.round(50 + 100 * Math.sin((h * Math.PI) / 12) * (dow > 4 ? 0.7 : 1)),
      });
    }
  }
  return cells;
}
```

## 3. Fixture `pages`

```ts
// src/test/fixtures/insights/pages.fixture.ts
export const FIXTURE_PAGES_TOP = {
  pages: [
    { pageRoute: '/', pageViews: 8_240, sessions: 5_100, conversions: 12, scroll75: 2_142, bounceRate: 0.38 },
    { pageRoute: '/kit', pageViews: 3_410, sessions: 2_800, conversions: 31, scroll75: 2_284, bounceRate: 0.22 },
    { pageRoute: '/journal/manucure-jaipur', pageViews: 1_220, sessions: 940, conversions: 4, scroll75: 707, bounceRate: 0.31 },
    { pageRoute: '/panier', pageViews: 890, sessions: 760, conversions: 20, scroll75: 658, bounceRate: 0.12 },
    { pageRoute: '/commander', pageViews: 540, sessions: 480, conversions: 18, scroll75: 432, bounceRate: 0.08 },
    { pageRoute: '/maison', pageViews: 410, sessions: 320, conversions: 2, scroll75: 192, bounceRate: 0.42 },
    /* ... 24 pages additionnelles */
  ],
};

export const FIXTURE_PAGE_DETAIL = {
  route: '/kit',
  events: [
    { eventName: 'page_view', count: 3_410 },
    { eventName: 'cta-recevoir-rituel', count: 1_800 },
    { eventName: 'add_to_cart', count: 620 },
    { eventName: 'select_item', count: 480 },
    { eventName: 'view_item_list', count: 410 },
  ],
};
```

## 4. Fixture `components`

```ts
// src/test/fixtures/insights/components.fixture.ts
export const FIXTURE_COMPONENTS_TOP = {
  components: [
    { componentId: 'cta-recevoir-rituel', name: 'CTA Recevoir le rituel', pageRoute: '/kit', total: 4_200, topEvent: 'add_to_cart', engagement: 0.18 },
    { componentId: 'chat-widget-launcher', name: 'Lanceur chat', pageRoute: '/', total: 1_800, topEvent: 'chat_widget_open', engagement: 0.12 },
    { componentId: 'journal-card-3', name: 'Journal carte 3', pageRoute: '/journal', total: 920, topEvent: 'select_content', engagement: 0.08 },
    /* ... 47 composants additionnels */
  ],
};

export const FIXTURE_COMPONENTS_DEAD = {
  components: [
    { id: 'cta-newsletter-footer', name: 'CTA Newsletter pied de page', pages: 12 },
    { id: 'carrousel-witness-2', name: 'Carrousel témoignage 2', pages: 1 },
    { id: 'banner-soldes', name: 'Bannière soldes', pages: 1 },
  ],
};
```

## 5. Fixture `funnel`

```ts
// src/test/fixtures/insights/funnel.fixture.ts
export const FIXTURE_FUNNEL = {
  stages: [
    { name: 'view_item', count: 12_400, conversionFromPrev: null },
    { name: 'add_to_cart', count: 4_800, conversionFromPrev: 0.387 },
    { name: 'begin_checkout', count: 2_100, conversionFromPrev: 0.437 },
    { name: 'add_payment_info', count: 1_580, conversionFromPrev: 0.752 },
    { name: 'purchase', count: 1_240, conversionFromPrev: 0.785 },
  ],
  dropoffs: [
    { stage: 'view_item → add_to_cart', lost: 7_600, percent: -0.613 },
    { stage: 'add_to_cart → begin_checkout', lost: 2_700, percent: -0.563 },
    { stage: 'begin_checkout → add_payment_info', lost: 520, percent: -0.248 },
    { stage: 'add_payment_info → purchase', lost: 340, percent: -0.215 },
  ],
  totalRevenue: 124_320,
  uniquePurchasers: 1_180,
};
```

## 6. Fixture `refresh`

```ts
// src/test/fixtures/insights/refresh.fixture.ts
export const FIXTURE_REFRESH_SUCCESS = {
  lastRun: {
    id: 'irf_test_success_001',
    status: 'success' as const,
    trigger: 'cron' as const,
    startedAt: '2026-05-07T11:50:00.000Z',
    finishedAt: '2026-05-07T11:50:23.000Z',
    durations: { event: 8200, page: 1100, component: 11200, section: 2900, funnel: 600 },
    counts: { event: 1245, page: 240, component: 8930, section: 1240, funnel: 1 },
  },
  lockHeld: false,
  enabled: true,
  intervalMinutes: 15,
};

export const FIXTURE_REFRESH_FAILED = {
  lastRun: {
    id: 'irf_test_failed_001',
    status: 'failed' as const,
    trigger: 'cron' as const,
    startedAt: '2026-05-07T11:50:00.000Z',
    finishedAt: '2026-05-07T11:50:08.000Z',
    durations: { event: 8000, page: 800 },
    counts: { event: 1245, page: 240 },
    errorCode: 'db_connection',
    errorMessage: 'Neon connection timeout',
  },
  lockHeld: false,
  enabled: true,
  intervalMinutes: 15,
};

export const FIXTURE_REFRESH_RUNNING = {
  lastRun: {
    id: 'irf_test_running_001',
    status: 'running' as const,
    trigger: 'manual' as const,
    startedAt: '2026-05-07T11:59:55.000Z',
    finishedAt: null,
    durations: {},
    counts: {},
  },
  lockHeld: true,
  enabled: true,
  intervalMinutes: 15,
};

export const FIXTURE_REFRESH_DISABLED = {
  lastRun: null,
  lockHeld: false,
  enabled: false,
  intervalMinutes: 15,
};
```

## 7. Fixture `empty`

```ts
// src/test/fixtures/insights/empty.fixture.ts
export const FIXTURE_EMPTY_OVERVIEW = {
  kpis: { totalEvents: 0, uniqueSessions: 0, pageViews: 0, conversions: 0, avgEventsPerSession: 0, bounceRate: 0 },
  variations: {},
  timeseries: [],
  heatmap: [],
  refreshedAt: null,
  firstRun: true,
};

export const FIXTURE_EMPTY_PAGES = { pages: [] };
export const FIXTURE_EMPTY_COMPONENTS = { components: [] };
export const FIXTURE_EMPTY_SECTIONS = { sections: [] };
```

## 8. Helpers

```ts
// src/test/fixtures/insights/helpers.ts
export function buildEventsLogRow(overrides: Partial<EventsLogRow> = {}): EventsLogRow {
  return {
    id: `evt_${Math.random().toString(36).slice(2, 12)}`,
    eventId: `id_${Math.random().toString(36).slice(2, 8)}`,
    eventName: 'page_view',
    eventCategory: 'navigation',
    pageRoute: '/',
    componentId: null,
    anonymousId: 'anon_test',
    sessionId: 'sess_test',
    userId: null,
    payload: {},
    consentSnapshot: { analytics: true },
    receivedAt: new Date('2026-05-07T10:00:00Z'),
    env: 'production',
    device: 'mobile',
    locale: 'fr-MA',
    isConversion: false,
    providersDispatched: [],
    providersResults: {},
    schemaVersion: 1,
    trafficSource: 'direct',
    trafficMedium: null,
    experimentId: null,
    experimentVariant: null,
    uaHash: 'hash_test',
    ipAnonymized: '192.168.0.0',
    ...overrides,
  };
}

export function buildBatchOfEvents(count: number, base: Partial<EventsLogRow> = {}): EventsLogRow[] {
  return Array.from({ length: count }, (_, i) =>
    buildEventsLogRow({
      ...base,
      eventId: `id_${i}`,
      receivedAt: new Date(Date.now() - i * 60_000),
    }),
  );
}
```

## 9. Pattern MSW handlers

```ts
// src/test/msw/insights-handlers.ts
import { http, HttpResponse } from 'msw';
import { FIXTURE_OVERVIEW, FIXTURE_REFRESH_SUCCESS } from '@/test/fixtures/insights';

export const insightsHandlers = [
  http.get('/api/admin/analytics/insights/overview', () => HttpResponse.json(FIXTURE_OVERVIEW)),
  http.get('/api/admin/analytics/insights/refresh', () => HttpResponse.json(FIXTURE_REFRESH_SUCCESS)),
  http.post('/api/admin/analytics/insights/refresh', () =>
    HttpResponse.json({ ok: true, runId: 'irf_test', durations: {}, counts: {} }),
  ),
  http.get('/api/admin/analytics/insights/pages', () => HttpResponse.json(FIXTURE_PAGES_TOP)),
  http.get('/api/admin/analytics/insights/components', () => HttpResponse.json(FIXTURE_COMPONENTS_TOP)),
  http.get('/api/admin/analytics/insights/sections', () => HttpResponse.json({ sections: [] })),
  http.get('/api/admin/analytics/insights/funnel', () => HttpResponse.json(FIXTURE_FUNNEL)),
  http.get('/api/admin/analytics/insights/settings', () =>
    HttpResponse.json({ enabled: true, intervalMinutes: 15 }),
  ),
];
```

## 10. Pattern de tests intégration

```ts
// src/test/integration/admin-analytics-insights/overview.test.ts
import { describe, expect, it, beforeEach } from 'vitest';
import { setupServer } from 'msw/node';
import { insightsHandlers } from '@/test/msw/insights-handlers';

const server = setupServer(...insightsHandlers);

describe('GET /api/admin/analytics/insights/overview', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  it('renvoie les KPIs', async () => {
    const res = await fetch('/api/admin/analytics/insights/overview');
    const body = await res.json();
    expect(body.kpis.totalEvents).toBe(12437);
  });

  it('respecte le filtre env', async () => {
    server.use(
      http.get('/api/admin/analytics/insights/overview', ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('env')).toBe('production');
        return HttpResponse.json({ ...FIXTURE_OVERVIEW, kpis: { ...FIXTURE_OVERVIEW.kpis, totalEvents: 8200 } });
      }),
    );
    const res = await fetch('/api/admin/analytics/insights/overview?env=production');
    const body = await res.json();
    expect(body.kpis.totalEvents).toBe(8200);
  });
});
```

## 11. Reset entre tests

```ts
// src/lib/analytics/insights/_resetForTests.ts
export async function _resetInsightsForTests() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('reset only in test env');
  }
  await db.delete(insightsEventDaily);
  await db.delete(insightsPageDaily);
  await db.delete(insightsComponentDaily);
  await db.delete(insightsSectionDaily);
  await db.delete(insightsFunnelDaily);
  await db.delete(insightsRefreshRun);
}
```

## 12. Lecture suivante

- [scenarios-tests.md](scenarios-tests.md) pour la matrice détaillée.
- [09 — Stratégie tests](../09-tests.md) pour la stratégie globale.
