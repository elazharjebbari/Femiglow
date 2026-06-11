/**
 * Non-régression AF-01 (réactivité des filtres) + F-PERF-03 pour FunnelDashboard.
 * cf. docs/analytics-audit-qa-2026-05-30/00-audit/findings-register.csv
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import type { AnalyticsFilters } from '@/lib/analytics/filters';
import type {
  FunnelByPageData,
  FunnelOverviewData,
  FunnelSankeyData,
} from '@/lib/analytics/queries/funnel';

import { FunnelDashboard } from './FunnelDashboard';

const router = { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() };
let currentSearchParams = new URLSearchParams('');

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => currentSearchParams,
  usePathname: () => '/admin/analytics/funnel',
}));

const RANGE = { from: '2026-05-13T00:00:00.000Z', to: '2026-05-20T00:00:00.000Z' };
const overview: FunnelOverviewData = { range: RANGE, steps: [], totalSessions: 0 };
const sankey: FunnelSankeyData = { range: RANGE, links: [], truncated: false };
const byPage: FunnelByPageData = { range: RANGE, rows: [] };

const F7D: AnalyticsFilters = { period: '7d', device: 'all', traffic: 'all' };

function renderFunnel() {
  return render(
    <FunnelDashboard
      initialFilters={F7D}
      initialOverview={overview}
      initialSankey={sankey}
      initialByPage={byPage}
    />,
  );
}

beforeEach(() => {
  currentSearchParams = new URLSearchParams('period=7d&device=all&traffic=all');
  router.replace.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('FunnelDashboard — AF-01 réactivité des filtres', () => {
  it('F-PERF-03 — aucun refetch au mount quand les filtres = pré-chargés', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderFunnel();
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('AF-01 — changer la période refetch les 3 endpoints avec les nouveaux filtres', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const body = url.includes('/sankey')
        ? sankey
        : url.includes('view=table')
          ? byPage
          : overview;
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = renderFunnel();

    currentSearchParams = new URLSearchParams('period=30d&device=all&traffic=all');
    rerender(
      <FunnelDashboard
        initialFilters={F7D}
        initialOverview={overview}
        initialSankey={sankey}
        initialByPage={byPage}
      />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.every((u) => u.includes('period=30d'))).toBe(true);
    expect(urls.some((u) => u.includes('/funnel/sankey'))).toBe(true);
    expect(urls.some((u) => u.includes('view=table'))).toBe(true);
  });
});
