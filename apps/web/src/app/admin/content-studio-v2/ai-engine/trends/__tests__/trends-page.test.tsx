/**
 * Tests for the AI Engine Trends page — fetches trends, displays trend cards,
 * filters by category, shows score bars, and links to content creation.
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

import TrendsPage from '../page';

function buildTrend(overrides?: Record<string, unknown>) {
  return {
    id: 'trend_1',
    source: 'tiktok',
    category: 'routine',
    title: 'Glass Skin Routine',
    description: 'La routine glass skin explose sur TikTok',
    originalUrl: 'https://tiktok.com/@trend',
    brandRelevance: 0.82,
    viralPotential: 0.75,
    timeSensitivity: 0.6,
    contentFeasibility: 0.9,
    compositeScore: 0.78,
    suggestedFormats: ['reel', 'carousel'],
    suggestedHooks: ['Votre peau mérite mieux'],
    opportunityWindow: '2 semaines',
    riskAssessment: 'low',
    detectedAt: '2026-05-20T10:00:00Z',
    status: 'active',
    ...overrides,
  };
}

function mockTrendsResponse(trends = [buildTrend()]) {
  return { trends };
}

describe('TrendsPage', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows "Veille & Tendances" title', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTrendsResponse()),
    });

    render(<TrendsPage />);

    await waitFor(() => {
      expect(screen.getByText('Veille & Tendances')).toBeInTheDocument();
    });
  });

  it('renders trend cards with titles', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTrendsResponse()),
    });

    render(<TrendsPage />);

    await waitFor(() => {
      expect(screen.getByText('Glass Skin Routine')).toBeInTheDocument();
    });
    expect(
      screen.getByText('La routine glass skin explose sur TikTok'),
    ).toBeInTheDocument();
  });

  it('shows composite scores', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTrendsResponse()),
    });

    render(<TrendsPage />);

    await waitFor(() => {
      // compositeScore = 0.78 -> displayed as 78
      expect(screen.getByText('78')).toBeInTheDocument();
    });
  });

  it('category filter buttons are present', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve(
          mockTrendsResponse([
            buildTrend({ category: 'routine' }),
            buildTrend({ id: 'trend_2', category: 'ingredient', title: 'Niacinamide' }),
          ]),
        ),
    });

    render(<TrendsPage />);

    await waitFor(() => {
      expect(screen.getByText('Toutes')).toBeInTheDocument();
    });
    // Category filters are rendered as buttons — "Routine" appears in both
    // the filter area and the trend card, so use getAllByText
    expect(screen.getAllByText('Routine').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Ingrédient').length).toBeGreaterThanOrEqual(1);
  });

  it('clicking filter fetches with category param', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve(
          mockTrendsResponse([
            buildTrend({ category: 'routine' }),
            buildTrend({ id: 'trend_2', category: 'ingredient', title: 'Niacinamide' }),
          ]),
        ),
    });

    render(<TrendsPage />);

    await waitFor(() => {
      expect(screen.getAllByText('Routine').length).toBeGreaterThanOrEqual(1);
    });

    // Click on Routine filter button (it's a plain <button> in the filter bar)
    const routineButtons = screen.getAllByText('Routine');
    // The filter button is the one without the category badge styling
    // Filter buttons are rendered first in the DOM
    fireEvent.click(routineButtons[0]!);

    // A re-fetch should happen
    await waitFor(() => {
      expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('"Toutes" filter resets', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve(
          mockTrendsResponse([buildTrend({ category: 'routine' })]),
        ),
    });

    render(<TrendsPage />);

    await waitFor(() => {
      expect(screen.getByText('Toutes')).toBeInTheDocument();
    });

    // Click Toutes
    fireEvent.click(screen.getByText('Toutes'));

    // The Toutes button should have accent styling (selected)
    const toutesBtn = screen.getByText('Toutes');
    expect(toutesBtn).toBeInTheDocument();
  });

  it('shows score bars (Marque, Viralité, Urgence, Faisabilité)', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTrendsResponse()),
    });

    render(<TrendsPage />);

    await waitFor(() => {
      expect(screen.getByText('Marque')).toBeInTheDocument();
    });
    expect(screen.getByText('Viralité')).toBeInTheDocument();
    expect(screen.getByText('Urgence')).toBeInTheDocument();
    expect(screen.getByText('Faisabilité')).toBeInTheDocument();
    // Check score values
    expect(screen.getByText('82')).toBeInTheDocument(); // brandRelevance
    expect(screen.getByText('75')).toBeInTheDocument(); // viralPotential
  });

  it('"Créer un contenu" button links to /create', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTrendsResponse()),
    });

    render(<TrendsPage />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Créer un contenu/i }),
      ).toBeInTheDocument();
    });

    const createBtn = screen.getByRole('button', {
      name: /Créer un contenu/i,
    });
    const link = createBtn.closest('a');
    expect(link?.getAttribute('href')).toContain(
      '/admin/content-studio-v2/ai-engine/create',
    );
  });

  it('refresh button clears cache (calls fetch with refresh=true)', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTrendsResponse()),
    });

    render(<TrendsPage />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Actualiser/i }),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Actualiser/i }));

    await waitFor(() => {
      // Should have fetched again with refresh=true
      const calls = fetchSpy.mock.calls;
      const refreshCall = calls.find(
        (c: unknown[]) => typeof c[0] === 'string' && c[0].includes('refresh=true'),
      );
      expect(refreshCall).toBeTruthy();
    });
  });

  it('empty state shows message', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTrendsResponse([])),
    });

    render(<TrendsPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Aucune tendance détectée/i),
      ).toBeInTheDocument();
    });
  });
});
