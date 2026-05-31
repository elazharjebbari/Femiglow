/**
 * Non-régression AF-01 (réactivité des filtres) + F-PERF-03 (pas de double
 * fetch au mount) pour CtaDashboard.
 * cf. docs/analytics-audit-qa-2026-05-30/00-audit/findings-register.csv
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import type { AnalyticsFilters } from '@/lib/analytics/filters';
import type { CtaData } from '@/lib/analytics/queries/cta';

import { CtaDashboard } from './CtaDashboard';

const router = { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() };
let currentSearchParams = new URLSearchParams('');

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => currentSearchParams,
  usePathname: () => '/admin/analytics/cta',
}));

function ctaData(clicks: number): CtaData {
  return {
    range: { from: '2026-05-13T00:00:00.000Z', to: '2026-05-20T00:00:00.000Z' },
    totals: {
      impressions: 100,
      clicks,
      conversionRate: 0.1,
      revenueAttributedCents: 19900,
    },
    rows: [],
    topMessages: [],
    topPages: [],
  };
}

const F7D: AnalyticsFilters = { period: '7d', device: 'all', traffic: 'all' };

beforeEach(() => {
  currentSearchParams = new URLSearchParams('period=7d&device=all&traffic=all');
  router.replace.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CtaDashboard — AF-01 réactivité des filtres', () => {
  it('F-PERF-03 — aucun refetch au mount quand les filtres = ceux pré-chargés par le RSC', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    render(
      <CtaDashboard initialFilters={F7D} initialData={ctaData(10)} currency="MAD" />,
    );

    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('AF-01 — changer la période déclenche un refetch avec les nouveaux filtres', async () => {
    const fetchMock = vi.fn(
      async (_url: string) =>
        new Response(JSON.stringify(ctaData(999)), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { rerender } = render(
      <CtaDashboard initialFilters={F7D} initialData={ctaData(10)} currency="MAD" />,
    );

    // l'opérateur passe à « 30 jours » : la FilterBar réécrit l'URL.
    currentSearchParams = new URLSearchParams('period=30d&device=all&traffic=all');
    rerender(
      <CtaDashboard initialFilters={F7D} initialData={ctaData(10)} currency="MAD" />,
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toContain('/api/admin/analytics/cta');
    expect(calledUrl).toContain('period=30d');
  });
});
