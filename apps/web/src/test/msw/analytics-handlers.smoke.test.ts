/** Smoke — la couche MSW analytics répond (peuplé / vide / 500). */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { server } from '@/test/msw/server';
import {
  analyticsHandlers,
  EMPTY_OVERVIEW,
  EMPTY_FUNNEL,
  EMPTY_CTA,
  EMPTY_CHECKOUT,
  EMPTY_INSIGHTS,
} from '@/test/msw/analytics-handlers';

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('MSW analytics-handlers (smoke)', () => {
  it('S001 sert un overview peuplé tel quel', async () => {
    const overview = {
      ...EMPTY_OVERVIEW,
      kpis: { ...EMPTY_OVERVIEW.kpis, sessions: { current: 42, previous: 30, delta: 0.4 } },
      topPages: [{ pageRoute: '/kit', pageViews: 12, sessions: 9 }],
    };
    server.use(...analyticsHandlers({ overview }));
    const json = await (await fetch('/api/admin/analytics/overview')).json();
    expect(json.kpis.sessions.current).toBe(42);
    expect(json.topPages[0].pageRoute).toBe('/kit');
  });

  it('S002 défaut = état vide pour chaque onglet', async () => {
    server.use(...analyticsHandlers({}));
    const overview = await (await fetch('/api/admin/analytics/overview')).json();
    expect(overview).toEqual(EMPTY_OVERVIEW);
    const funnel = await (await fetch('/api/admin/analytics/funnel')).json();
    expect(funnel).toEqual(EMPTY_FUNNEL);
    const cta = await (await fetch('/api/admin/analytics/cta')).json();
    expect(cta).toEqual(EMPTY_CTA);
    const checkout = await (await fetch('/api/admin/analytics/checkout')).json();
    expect(checkout).toEqual(EMPTY_CHECKOUT);
  });

  it('S003 funnel sankey + insights endpoints répondent', async () => {
    server.use(...analyticsHandlers({}));
    const sankey = await (await fetch('/api/admin/analytics/funnel/sankey')).json();
    expect(sankey.links).toEqual([]);
    for (const path of ['overview', 'pages', 'components', 'sections', 'funnel']) {
      const json = await (await fetch(`/api/admin/analytics/insights/${path}`)).json();
      expect(json).toEqual(EMPTY_INSIGHTS);
    }
  });

  it('S004 injection d’échec 500 sur funnel', async () => {
    server.use(...analyticsHandlers({ fail: { funnel: 500 } }));
    const res = await fetch('/api/admin/analytics/funnel');
    expect(res.status).toBe(500);
    // les autres onglets restent OK
    expect((await fetch('/api/admin/analytics/overview')).status).toBe(200);
  });

  it('S005 injection d’échec 500 par endpoint insights', async () => {
    server.use(...analyticsHandlers({ fail: { insightsOverview: 500, cta: 503 } }));
    expect((await fetch('/api/admin/analytics/insights/overview')).status).toBe(500);
    expect((await fetch('/api/admin/analytics/cta')).status).toBe(503);
    expect((await fetch('/api/admin/analytics/insights/pages')).status).toBe(200);
  });
});
