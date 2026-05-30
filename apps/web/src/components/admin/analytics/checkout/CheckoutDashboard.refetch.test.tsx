/**
 * Non-régression AF-01 (réactivité des filtres) + F-PERF-03 pour CheckoutDashboard.
 * cf. docs/analytics-audit-qa-2026-05-30/00-audit/findings-register.csv
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';

import type { AnalyticsFilters } from '@/lib/analytics/filters';
import type { CheckoutData } from '@/lib/analytics/queries/checkout';

import { CheckoutDashboard } from './CheckoutDashboard';

const router = { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() };
let currentSearchParams = new URLSearchParams('');

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => currentSearchParams,
  usePathname: () => '/admin/analytics/checkout',
}));

function checkoutData(viewCart: number): CheckoutData {
  return {
    range: { from: '2026-05-13T00:00:00.000Z', to: '2026-05-20T00:00:00.000Z' },
    totals: {
      viewCart,
      beginCheckout: 0,
      submissions: 0,
      abandons: 0,
      serverFallbackPurchases: 0,
    },
    steps: [],
    timeToSubmit: { buckets: [], p25: null, p50: null, p75: null, p95: null, sampleSize: 0 },
    topErrors: [],
    topAbandonedFields: [],
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

describe('CheckoutDashboard — AF-01 réactivité des filtres', () => {
  it('F-PERF-03 — aucun refetch au mount quand les filtres = pré-chargés', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<CheckoutDashboard initialFilters={F7D} initialData={checkoutData(10)} />);
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('AF-01 — changer le device déclenche un refetch avec les nouveaux filtres', async () => {
    const fetchMock = vi.fn(
      async (_url: string) =>
        new Response(JSON.stringify(checkoutData(999)), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { rerender } = render(
      <CheckoutDashboard initialFilters={F7D} initialData={checkoutData(10)} />,
    );

    currentSearchParams = new URLSearchParams('period=7d&device=desktop&traffic=all');
    rerender(<CheckoutDashboard initialFilters={F7D} initialData={checkoutData(10)} />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const calledUrl = String(fetchMock.mock.calls[0]?.[0]);
    expect(calledUrl).toContain('/api/admin/analytics/checkout');
    expect(calledUrl).toContain('device=desktop');
  });
});
