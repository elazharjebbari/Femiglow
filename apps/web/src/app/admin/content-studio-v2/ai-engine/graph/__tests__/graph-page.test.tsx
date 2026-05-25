/**
 * Tests for the AI Engine Graph Viewer page — title, summary bar,
 * node cards, expand/collapse, conditional edges, loading state.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock next/link
vi.mock('next/link', () => ({
  __esModule: true,
  default: ({
    href,
    children,
    style: _style,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    style?: React.CSSProperties;
    [k: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import GraphViewerPage from '../page';

function mockAnalyticsResponse() {
  return {
    overview: {
      generationsToday: 5,
      generationsWeek: 28,
      generationsMonth: 120,
      costTodayCents: 150,
      costWeekCents: 850,
      costMonthCents: 3200,
      avgQualityScore: 0.87,
      successRate: 94.2,
      errorRate: 5.8,
    },
    nodeMetrics: [
      {
        nodeId: 'parseBrief',
        label: 'Analyse du brief',
        provider: 'openai',
        avgLatencyMs: 1200,
        avgCostCents: 8,
        totalInvocations: 120,
        errorCount: 2,
        errorRate: 1.7,
        status: 'healthy',
      },
      {
        nodeId: 'enrichKnowledge',
        label: 'Enrichissement savoir',
        provider: 'openai',
        avgLatencyMs: 800,
        avgCostCents: 5,
        totalInvocations: 118,
        errorCount: 0,
        errorRate: 0,
        status: 'healthy',
      },
      {
        nodeId: 'enrichTrends',
        label: 'Enrichissement tendances',
        provider: 'openai',
        avgLatencyMs: 950,
        avgCostCents: 6,
        totalInvocations: 118,
        errorCount: 1,
        errorRate: 0.8,
        status: 'healthy',
      },
      {
        nodeId: 'generateScript',
        label: 'Generation script',
        provider: 'anthropic',
        avgLatencyMs: 3500,
        avgCostCents: 25,
        totalInvocations: 117,
        errorCount: 3,
        errorRate: 2.6,
        status: 'healthy',
      },
      {
        nodeId: 'generateVideo',
        label: 'Generation video',
        provider: 'runway',
        avgLatencyMs: 12000,
        avgCostCents: 80,
        totalInvocations: 35,
        errorCount: 5,
        errorRate: 14.3,
        status: 'degraded',
      },
      {
        nodeId: 'generateCaption',
        label: 'Generation caption',
        provider: 'openai',
        avgLatencyMs: 1500,
        avgCostCents: 7,
        totalInvocations: 117,
        errorCount: 1,
        errorRate: 0.9,
        status: 'healthy',
      },
      {
        nodeId: 'qualityCheck',
        label: 'Controle qualite',
        provider: 'openai',
        avgLatencyMs: 1100,
        avgCostCents: 4,
        totalInvocations: 116,
        errorCount: 0,
        errorRate: 0,
        status: 'healthy',
      },
    ],
    costByProvider: [],
    costByNode: [],
    recentJobs: [],
  };
}

describe('GraphViewerPage', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows title after loading', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAnalyticsResponse()),
    });

    render(<GraphViewerPage />);

    await waitFor(() => {
      expect(screen.getByText('Visualisation du graphe LangGraph')).toBeInTheDocument();
    });
  });

  it('shows summary bar with node count', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAnalyticsResponse()),
    });

    render(<GraphViewerPage />);

    await waitFor(() => {
      expect(screen.getByText('Noeuds:')).toBeInTheDocument();
    });
  });

  it('node cards render with labels', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAnalyticsResponse()),
    });

    render(<GraphViewerPage />);

    await waitFor(() => {
      expect(screen.getByText('Visualisation du graphe LangGraph')).toBeInTheDocument();
    });

    // French node labels from the NODES array in the page
    // Some labels appear more than once (node card + conditional edges legend),
    // so we use getAllByText to verify they exist.
    expect(screen.getByText('Analyse du brief')).toBeInTheDocument();
    expect(screen.getByText('Enrichissement savoir')).toBeInTheDocument();
    expect(screen.getAllByText('Generation script').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Generation caption').length).toBeGreaterThanOrEqual(1);
  });

  it('clicking node card toggles expanded state', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAnalyticsResponse()),
    });

    render(<GraphViewerPage />);

    await waitFor(() => {
      expect(screen.getByText('Visualisation du graphe LangGraph')).toBeInTheDocument();
    });

    // Click "Analyse du brief" node card (it has role="button")
    const nodeCards = screen.getAllByRole('button');
    const briefCard = nodeCards.find(
      (btn) => btn.textContent?.includes('Analyse du brief'),
    );
    expect(briefCard).toBeDefined();
    fireEvent.click(briefCard!);

    // Expanded should show "Fournisseur"
    await waitFor(() => {
      expect(screen.getByText('Fournisseur')).toBeInTheDocument();
    });

    // Click again to collapse
    fireEvent.click(briefCard!);

    await waitFor(() => {
      expect(screen.queryByText('Fournisseur')).not.toBeInTheDocument();
    });
  });

  it('expanded card shows provider info', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAnalyticsResponse()),
    });

    render(<GraphViewerPage />);

    await waitFor(() => {
      expect(screen.getByText('Visualisation du graphe LangGraph')).toBeInTheDocument();
    });

    // Click a node to expand
    const nodeCards = screen.getAllByRole('button');
    const briefCard = nodeCards.find(
      (btn) => btn.textContent?.includes('Analyse du brief'),
    );
    fireEvent.click(briefCard!);

    await waitFor(() => {
      expect(screen.getByText('Fournisseur')).toBeInTheDocument();
    });

    // Should show provider name
    expect(screen.getByText('openai')).toBeInTheDocument();
    expect(screen.getByText('Latence moy.')).toBeInTheDocument();
    expect(screen.getByText('Cout moy.')).toBeInTheDocument();
    expect(screen.getByText('Invocations')).toBeInTheDocument();
  });

  it('conditional edges legend visible', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAnalyticsResponse()),
    });

    render(<GraphViewerPage />);

    await waitFor(() => {
      expect(screen.getByText('Routages conditionnels')).toBeInTheDocument();
    });
  });

  it('back navigation link present', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAnalyticsResponse()),
    });

    render(<GraphViewerPage />);

    await waitFor(() => {
      expect(screen.getByText('Visualisation du graphe LangGraph')).toBeInTheDocument();
    });

    // Back link to AI Engine dashboard
    const backLink = document.querySelector('a[href="/admin/content-studio-v2/ai-engine"]');
    expect(backLink).toBeTruthy();
  });

  it('loading state shows skeleton', () => {
    // fetch never resolves = stuck in loading
    fetchSpy.mockReturnValue(new Promise(() => {}));

    const { container } = render(<GraphViewerPage />);

    // Loading skeleton renders shimmer divs
    const skeletons = container.querySelectorAll('div[style*="animation"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });
});
