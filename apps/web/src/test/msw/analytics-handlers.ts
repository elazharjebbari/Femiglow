/**
 * Handlers MSW pour les dashboards Analytics admin.
 *
 * Couche de contrat partagée par les tests COMPOSANT des onglets
 * Vue d'ensemble / Funnel / CTA / Checkout / Insights — voir
 * docs/analytics-audit-2026-06-04/00-overview/test-strategy.md (§ MSW).
 *
 * Cycle de vie géré PAR FICHIER (jamais global) :
 *   beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
 *   afterEach(() => server.resetHandlers());
 *   afterAll(() => server.close());
 *
 * La fabrique `analyticsHandlers({...})` renvoie un tableau de handlers GET pour
 * tous les endpoints `/api/admin/analytics/*`. Chaque endpoint sert le payload
 * fourni (peuplé), un défaut « vide » sinon, un 500 si listé dans `fail`, et
 * peut simuler une latence (`latencyMs`).
 */
import { http, HttpResponse } from 'msw';

import type { OverviewData } from '@/lib/analytics/queries/overview';
import type { FunnelOverviewData, FunnelSankeyData } from '@/lib/analytics/queries/funnel';
import type { CtaData } from '@/lib/analytics/queries/cta';
import type { CheckoutData } from '@/lib/analytics/queries/checkout';

/** Endpoints couverts. `'network'` ⇒ HttpResponse.error(). */
export interface AnalyticsFailMap {
  overview?: number | 'network';
  funnel?: number | 'network';
  sankey?: number | 'network';
  cta?: number | 'network';
  checkout?: number | 'network';
  insightsOverview?: number | 'network';
  insightsPages?: number | 'network';
  insightsComponents?: number | 'network';
  insightsSections?: number | 'network';
  insightsFunnel?: number | 'network';
}

export interface AnalyticsHandlersOptions {
  overview?: OverviewData;
  funnel?: FunnelOverviewData;
  sankey?: FunnelSankeyData;
  cta?: CtaData;
  checkout?: CheckoutData;
  /** Payload générique pour les endpoints insights/* (peuplé). */
  insights?: unknown;
  fail?: AnalyticsFailMap;
  /** Latence simulée en ms (0 = aucune). */
  latencyMs?: number;
}

/* ── Défauts « état vide » (mêmes shapes que les query fns) ───────────────── */

const EMPTY_RANGE = { from: '2026-06-04T00:00:00.000Z', to: '2026-06-05T00:00:00.000Z' };

const EMPTY_KPI = { current: null, previous: null, delta: null } as const;

export const EMPTY_OVERVIEW: OverviewData = {
  range: { ...EMPTY_RANGE, granularity: 'hour' },
  kpis: {
    sessions: { current: 0, previous: 0, delta: null },
    uniqueVisitors: { current: 0, previous: 0, delta: null },
    pageViews: { current: 0, previous: 0, delta: null },
    avgSessionDuration: { ...EMPTY_KPI },
    bounceRate: { ...EMPTY_KPI },
    conversionRate: { ...EMPTY_KPI },
  },
  series: [],
  topSources: [],
  topPages: [],
};

export const EMPTY_FUNNEL: FunnelOverviewData = {
  range: { ...EMPTY_RANGE },
  steps: [
    { stage: 'view', sessions: 0, progressionFromPrevious: null, dropoffToNext: null, medianTimeToNextSeconds: null },
    { stage: 'engage', sessions: 0, progressionFromPrevious: null, dropoffToNext: null, medianTimeToNextSeconds: null },
    { stage: 'cta', sessions: 0, progressionFromPrevious: null, dropoffToNext: null, medianTimeToNextSeconds: null },
    { stage: 'checkout', sessions: 0, progressionFromPrevious: null, dropoffToNext: null, medianTimeToNextSeconds: null },
    { stage: 'purchase', sessions: 0, progressionFromPrevious: null, dropoffToNext: null, medianTimeToNextSeconds: null },
  ],
  totalSessions: 0,
};

export const EMPTY_SANKEY: FunnelSankeyData = {
  range: { ...EMPTY_RANGE },
  links: [],
  truncated: false,
};

export const EMPTY_CTA: CtaData = {
  range: { ...EMPTY_RANGE },
  totals: { impressions: 0, clicks: 0, conversionRate: null, revenueAttributedCents: 0 },
  rows: [],
  topMessages: [],
  topPages: [],
};

export const EMPTY_CHECKOUT: CheckoutData = {
  range: { ...EMPTY_RANGE },
  totals: {
    viewCart: 0,
    beginCheckout: 0,
    submissions: 0,
    abandons: 0,
    serverFallbackPurchases: 0,
  },
  steps: [
    { stage: 'view_cart', sessions: 0, progressionFromPrevious: null, dropoffToNext: null },
    { stage: 'begin_checkout', sessions: 0, progressionFromPrevious: null, dropoffToNext: null },
    { stage: 'add_shipping', sessions: 0, progressionFromPrevious: null, dropoffToNext: null },
    { stage: 'add_payment', sessions: 0, progressionFromPrevious: null, dropoffToNext: null },
    { stage: 'submit', sessions: 0, progressionFromPrevious: null, dropoffToNext: null },
    { stage: 'purchase', sessions: 0, progressionFromPrevious: null, dropoffToNext: null },
  ],
  timeToSubmit: { buckets: [], p25: null, p50: null, p75: null, p95: null, sampleSize: 0 },
  topErrors: [],
  topAbandonedFields: [],
};

/** Payload insights « vide » (firstRun = matview non rafraîchie / pas de trafic). */
export const EMPTY_INSIGHTS = {
  refreshedAt: null,
  firstRun: true,
  kpis: {},
  timeseries: [],
  rows: [],
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */

async function maybeDelay(ms: number | undefined): Promise<void> {
  if (ms && ms > 0) await new Promise((r) => setTimeout(r, ms));
}

function failResponse(code: number | 'network'): Response {
  if (code === 'network') return HttpResponse.error();
  return HttpResponse.json({ error: { code: 'forced_failure' } }, { status: code });
}

/* ── Fabrique ───────────────────────────────────────────────────────────────
 * Read-only : les dashboards analytics ne mutent pas la donnée. La fabrique
 * sert le payload fourni (peuplé) ou le défaut vide, avec injection d'échec /
 * latence par endpoint.
 */
export function analyticsHandlers(opts: AnalyticsHandlersOptions = {}) {
  const fail = opts.fail ?? {};

  const serve =
    <T>(payload: T | undefined, empty: T, code: number | 'network' | undefined) =>
    async (): Promise<Response> => {
      await maybeDelay(opts.latencyMs);
      if (code) return failResponse(code);
      // Les payloads analytics sont des objets JSON-sérialisables ; le cast
      // satisfait le type `JsonBodyType` de MSW sans perte de garantie de shape
      // (les types `T` viennent des interfaces des query fns).
      return HttpResponse.json((payload ?? empty) as Record<string, unknown>);
    };

  const serveInsights = (code: number | 'network' | undefined) => async (): Promise<Response> => {
    await maybeDelay(opts.latencyMs);
    if (code) return failResponse(code);
    return HttpResponse.json(opts.insights ?? EMPTY_INSIGHTS);
  };

  return [
    http.get('/api/admin/analytics/overview', serve(opts.overview, EMPTY_OVERVIEW, fail.overview)),
    http.get('/api/admin/analytics/funnel', serve(opts.funnel, EMPTY_FUNNEL, fail.funnel)),
    http.get('/api/admin/analytics/funnel/sankey', serve(opts.sankey, EMPTY_SANKEY, fail.sankey)),
    http.get('/api/admin/analytics/cta', serve(opts.cta, EMPTY_CTA, fail.cta)),
    http.get('/api/admin/analytics/checkout', serve(opts.checkout, EMPTY_CHECKOUT, fail.checkout)),
    http.get('/api/admin/analytics/insights/overview', serveInsights(fail.insightsOverview)),
    http.get('/api/admin/analytics/insights/pages', serveInsights(fail.insightsPages)),
    http.get('/api/admin/analytics/insights/components', serveInsights(fail.insightsComponents)),
    http.get('/api/admin/analytics/insights/sections', serveInsights(fail.insightsSections)),
    http.get('/api/admin/analytics/insights/funnel', serveInsights(fail.insightsFunnel)),
  ];
}
