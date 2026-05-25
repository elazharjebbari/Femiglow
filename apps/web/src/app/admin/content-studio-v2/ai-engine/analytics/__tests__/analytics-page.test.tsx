/**
 * Tests for the AI Engine Analytics page — KPI cards, period selector,
 * recent generations table, cost breakdowns, and empty/loading states.
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

import AIEngineAnalyticsPage from '../page';

function mockAnalyticsResponse(overrides?: Record<string, unknown>) {
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
        label: 'Analyse brief',
        provider: 'openai',
        avgLatencyMs: 1200,
        avgCostCents: 8,
        totalInvocations: 120,
        errorCount: 2,
        errorRate: 1.7,
        status: 'healthy',
      },
    ],
    costByProvider: [
      { provider: 'openai', costCents: 2000, count: 800 },
      { provider: 'anthropic', costCents: 900, count: 117 },
    ],
    costByNode: [
      { nodeName: 'generateScript', costCents: 900, count: 117 },
      { nodeName: 'generateImages', costCents: 800, count: 82 },
    ],
    recentJobs: [
      {
        id: 'job-001',
        status: 'completed',
        platform: 'instagram',
        format: 'carousel',
        contentType: 'image',
        totalCostCents: '25',
        durationMs: 5200,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'job-002',
        status: 'failed',
        platform: 'tiktok',
        format: 'reel',
        contentType: 'video',
        totalCostCents: '12',
        durationMs: 3100,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
    ...overrides,
  };
}

function mockEmptyAnalyticsResponse() {
  return {
    overview: {
      generationsToday: 0,
      generationsWeek: 0,
      generationsMonth: 0,
      costTodayCents: 0,
      costWeekCents: 0,
      costMonthCents: 0,
      avgQualityScore: 0,
      successRate: 0,
      errorRate: 0,
    },
    nodeMetrics: [],
    costByProvider: [],
    costByNode: [],
    recentJobs: [],
  };
}

describe('AIEngineAnalyticsPage', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "Analytiques" title after loading', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAnalyticsResponse()),
    });

    render(<AIEngineAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Analytiques')).toBeInTheDocument();
    });
  });

  it('shows 4 KPI cards', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAnalyticsResponse()),
    });

    render(<AIEngineAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Analytiques')).toBeInTheDocument();
    });

    expect(screen.getByText("Generations aujourd'hui")).toBeInTheDocument();
    expect(screen.getByText('Cout total (mois)')).toBeInTheDocument();
    expect(screen.getByText('Qualite moyenne')).toBeInTheDocument();
    expect(screen.getByText('Taux de succes')).toBeInTheDocument();
  });

  it('period selector has 3 buttons', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAnalyticsResponse()),
    });

    render(<AIEngineAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Analytiques')).toBeInTheDocument();
    });

    expect(screen.getByText('Dernieres 24h')).toBeInTheDocument();
    expect(screen.getByText('7 jours')).toBeInTheDocument();
    expect(screen.getByText('30 jours')).toBeInTheDocument();
  });

  it('clicking period re-fetches data', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAnalyticsResponse()),
    });

    render(<AIEngineAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Analytiques')).toBeInTheDocument();
    });

    // Initial fetch + click another period
    const dayBtn = screen.getByText('Dernieres 24h');
    fireEvent.click(dayBtn);

    await waitFor(() => {
      // Should have been called at least twice (initial + period change)
      expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('recent generations table shows jobs', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAnalyticsResponse()),
    });

    render(<AIEngineAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Generations recentes')).toBeInTheDocument();
    });

    // Table header columns
    expect(screen.getByText('Statut')).toBeInTheDocument();
    expect(screen.getByText('Plateforme')).toBeInTheDocument();
    expect(screen.getByText('Format')).toBeInTheDocument();
  });

  it('job rows show status, platform, format, cost, duration', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAnalyticsResponse()),
    });

    render(<AIEngineAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Generations recentes')).toBeInTheDocument();
    });

    // Status badges
    expect(screen.getByText('Termine')).toBeInTheDocument();
    expect(screen.getByText('Echoue')).toBeInTheDocument();
    // Platform
    expect(screen.getByText('instagram')).toBeInTheDocument();
    expect(screen.getByText('tiktok')).toBeInTheDocument();
    // Cost columns
    expect(screen.getByText('0.25 MAD')).toBeInTheDocument();
    expect(screen.getByText('0.12 MAD')).toBeInTheDocument();
  });

  it('cost by provider section visible', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAnalyticsResponse()),
    });

    render(<AIEngineAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Cout par fournisseur')).toBeInTheDocument();
    });
  });

  it('cost by node section visible', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAnalyticsResponse()),
    });

    render(<AIEngineAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Cout par noeud')).toBeInTheDocument();
    });
  });

  it('link to graph viewer present', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAnalyticsResponse()),
    });

    render(<AIEngineAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Analytiques')).toBeInTheDocument();
    });

    // The "Graphe" button linking to graph viewer
    const graphLinks = screen.getAllByText('Graphe');
    expect(graphLinks.length).toBeGreaterThanOrEqual(1);
    // Check there is a link to the graph page
    const graphLink = graphLinks[0]!.closest('a');
    expect(graphLink).toHaveAttribute('href', '/admin/content-studio-v2/ai-engine/graph');
  });

  it('empty state for no data', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockEmptyAnalyticsResponse()),
    });

    render(<AIEngineAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByText('Analytiques')).toBeInTheDocument();
    });

    // Empty state for recent jobs
    expect(screen.getByText('Aucune generation enregistree')).toBeInTheDocument();
    // Empty state for cost sections
    const emptyMessages = screen.getAllByText('Aucune donnee de cout disponible');
    expect(emptyMessages.length).toBeGreaterThanOrEqual(1);
  });
});
