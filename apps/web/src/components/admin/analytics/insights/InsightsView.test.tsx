import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { InsightsView } from './InsightsView';

const router = {
  replace: vi.fn(),
  push: vi.fn(),
  refresh: vi.fn(),
};

let currentSearchParams = new URLSearchParams('');

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  useSearchParams: () => currentSearchParams,
  usePathname: () => '/admin/analytics/insights',
}));

const mockOverview = {
  kpis: {
    totalEvents: 12_437,
    uniqueSessions: 3_210,
    pageViews: 8_940,
    conversions: 42,
    avgEventsPerSession: 3.87,
    bounceRate: 0.31,
  },
  variations: { totalEvents: 0.14 },
  timeseries: [{ date: '2026-05-01', events: 100, sessions: 40, conversions: 2 }],
  heatmap: [],
  topEvents: [
    {
      eventName: 'page_view',
      eventCategory: 'navigation',
      count: 100,
      share: 0.5,
      conversionCount: 0,
      isConversion: false,
    },
  ],
  refreshedAt: '2026-05-08T12:00:00.000Z',
  firstRun: false,
};

const mockRefreshStatus = {
  lastRun: {
    id: 'irf_1',
    trigger: 'cron',
    status: 'success',
    startedAt: '2026-05-08T11:50:00.000Z',
    finishedAt: '2026-05-08T11:50:23.000Z',
    durationsMs: { event: 1000 },
    counts: { event: 100 },
    errorCode: null,
    errorMessage: null,
    triggeredBy: null,
  },
  lockHeld: false,
  enabled: true,
  intervalMinutes: 15,
};

beforeEach(() => {
  router.replace.mockClear();
  currentSearchParams = new URLSearchParams('');
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (url.includes('/refresh')) {
        return new Response(JSON.stringify(mockRefreshStatus), {
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('/overview')) {
        return new Response(JSON.stringify(mockOverview), {
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('/pages')) {
        return new Response(JSON.stringify({ pages: [], totalRows: 0 }), {
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('/components')) {
        return new Response(JSON.stringify({ components: [], totalRows: 0, dead: [] }), {
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('/sections')) {
        return new Response(JSON.stringify({ sections: [], totalRows: 0 }), {
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('/funnel')) {
        return new Response(JSON.stringify({ stages: [], dropoffs: [], totalRevenueCents: 0, uniquePurchasers: 0 }), {
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('InsightsView', () => {
  it('rend le titre + 5 onglets', async () => {
    render(<InsightsView />);
    expect(screen.getByText('Analytics Insights')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Vue d.ensemble/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Pages' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Composants' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Sections' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Funnel' })).toBeInTheDocument();
  });

  it('affiche les KPIs après chargement de l\'overview', async () => {
    render(<InsightsView />);
    await waitFor(() => {
      expect(screen.getByText('Total events')).toBeInTheDocument();
    });
    expect(screen.getByText('12 437')).toBeInTheDocument();
  });

  it('changement de tab vers Pages déclenche fetch /pages', async () => {
    render(<InsightsView />);
    fireEvent.click(screen.getByRole('tab', { name: 'Pages' }));
    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
      expect(calls.some((c) => String(c).includes('/pages'))).toBe(true);
    });
  });

  it('refresh indicator présent', () => {
    render(<InsightsView />);
    expect(screen.getByTestId('refresh-indicator')).toBeInTheDocument();
  });

  it('changement de filtre période → router.replace', async () => {
    render(<InsightsView />);
    const periodSelect = screen.getByLabelText('Période') as HTMLSelectElement;
    fireEvent.change(periodSelect, { target: { value: '30d' } });
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalled();
    });
  });

  it('window=custom dans URL → inputs de date visibles', async () => {
    currentSearchParams = new URLSearchParams(
      'window=custom&customFrom=2026-01-01&customTo=2026-01-31',
    );
    render(<InsightsView />);
    expect(screen.getByTestId('filter-custom-from')).toBeInTheDocument();
    expect(screen.getByTestId('filter-custom-to')).toBeInTheDocument();
  });

  it('clic sur ligne Pages → drawer drill-down ouvert', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      if (url.includes('/refresh')) {
        return new Response(JSON.stringify(mockRefreshStatus), {
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('/pages/')) {
        return new Response(
          JSON.stringify({
            pageRoute: '/kit',
            pageViews: 100,
            sessions: 60,
            events: [{ eventName: 'page_view', count: 100, share: 1 }],
            components: [],
            daily: [],
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.includes('/pages')) {
        return new Response(
          JSON.stringify({
            pages: [
              {
                pageRoute: '/kit',
                pageViews: 100,
                sessions: 60,
                visitors: 50,
                scroll75: 30,
                conversions: 5,
                bounceCount: 10,
                bounceRate: 0.16,
                avgTimeSeconds: 120,
              },
            ],
            totalRows: 1,
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    });
    render(<InsightsView />);
    fireEvent.click(screen.getByRole('tab', { name: 'Pages' }));
    await waitFor(() => screen.getByText('/kit'));
    fireEvent.click(screen.getByText('/kit'));
    await waitFor(() => {
      expect(screen.getByTestId('insights-drawer')).toBeInTheDocument();
    });
  });

  it('Esc ferme le drawer drill-down', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async (url: string) => {
      if (url.includes('/refresh')) {
        return new Response(JSON.stringify(mockRefreshStatus), {
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.includes('/pages/')) {
        return new Response(
          JSON.stringify({
            pageRoute: '/kit',
            pageViews: 100,
            sessions: 60,
            events: [],
            components: [],
            daily: [],
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.includes('/pages')) {
        return new Response(
          JSON.stringify({
            pages: [
              {
                pageRoute: '/kit',
                pageViews: 100,
                sessions: 60,
                visitors: 50,
                scroll75: 30,
                conversions: 5,
                bounceCount: 10,
                bounceRate: 0.16,
                avgTimeSeconds: 120,
              },
            ],
            totalRows: 1,
          }),
          { headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    });
    render(<InsightsView />);
    fireEvent.click(screen.getByRole('tab', { name: 'Pages' }));
    await waitFor(() => screen.getByText('/kit'));
    fireEvent.click(screen.getByText('/kit'));
    await waitFor(() => screen.getByTestId('insights-drawer'));
    fireEvent.keyDown(window, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByTestId('insights-drawer')).toBeNull();
    });
  });

  it('refresh trigger bouton appelle POST /refresh', async () => {
    render(<InsightsView />);
    await waitFor(() => screen.getByTestId('refresh-trigger'));
    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    fetchMock.mockClear();
    fireEvent.click(screen.getByTestId('refresh-trigger'));
    await waitFor(() => {
      const calls = fetchMock.mock.calls;
      const refreshCall = calls.find(
        (c) => String(c[0]).includes('/refresh') && (c[1] as RequestInit | undefined)?.method === 'POST',
      );
      expect(refreshCall).toBeTruthy();
    });
  });

  it('reset filtres : URL nettoyée si filtres customisés', async () => {
    currentSearchParams = new URLSearchParams('window=30d&device=mobile');
    render(<InsightsView />);
    const reset = screen.getByTestId('filters-reset');
    fireEvent.click(reset);
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith('?', { scroll: false });
    });
  });

  it('aria-selected reflète l\'onglet actif', () => {
    render(<InsightsView />);
    const tab = screen.getByRole('tab', { name: /Vue d.ensemble/ });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    const others = screen
      .getAllByRole('tab')
      .filter((t) => t.getAttribute('aria-selected') === 'true');
    expect(others.length).toBe(1);
  });

  it('changement onglet → aria-selected migré', () => {
    render(<InsightsView />);
    fireEvent.click(screen.getByRole('tab', { name: 'Funnel' }));
    expect(screen.getByRole('tab', { name: 'Funnel' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('tab', { name: /Vue d.ensemble/ })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });
});
