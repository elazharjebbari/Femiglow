/**
 * Tests for the AI Engine Dashboard page — fetches health data and displays
 * provider cards, budget bars, navigation links, and disabled/error states.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock next/link to render plain anchors
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

import AIEngineDashboardPage from '../page';

function mockHealthResponse(overrides?: Record<string, unknown>) {
  return {
    enabled: true,
    providers: {
      text: {
        name: 'OpenAI',
        provider: 'openai',
        model: 'gpt-4o',
        status: 'active',
      },
      image: {
        name: 'DALL-E',
        provider: 'openai',
        model: 'dall-e-3',
        status: 'active',
      },
      video: {
        name: 'Runway',
        provider: 'runway',
        model: 'gen-3',
        status: 'inactive',
      },
      tts: {
        name: 'ElevenLabs',
        provider: 'elevenlabs',
        model: 'v2',
        status: 'active',
      },
    },
    budget: {
      dailyUsedCents: 150,
      dailyLimitCents: 1000,
      monthlyUsedCents: 3200,
      monthlyLimitCents: 20000,
    },
    ...overrides,
  };
}

describe('AIEngineDashboardPage', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading skeleton initially', () => {
    // fetch never resolves
    fetchSpy.mockReturnValue(new Promise(() => {}));
    const { container } = render(<AIEngineDashboardPage />);
    // The loading state renders empty div placeholders
    const skeletons = container.querySelectorAll('div[style*="min-height"]');
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  it('shows provider cards after fetch', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHealthResponse()),
    });

    render(<AIEngineDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Texte / LLM')).toBeInTheDocument();
    });
    expect(screen.getByText('Images')).toBeInTheDocument();
    expect(screen.getByText('Vidéo')).toBeInTheDocument();
    expect(screen.getByText('Voix / TTS')).toBeInTheDocument();
  });

  it('shows "Configuré" badge style for active providers', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHealthResponse()),
    });

    render(<AIEngineDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Texte / LLM')).toBeInTheDocument();
    });
    // Active status shows "Actif" badge
    const actifBadges = screen.getAllByText('Actif');
    expect(actifBadges.length).toBeGreaterThanOrEqual(1);
  });

  it('shows "Inactif" for inactive providers', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHealthResponse()),
    });

    render(<AIEngineDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Vidéo')).toBeInTheDocument();
    });
    expect(screen.getByText('Inactif')).toBeInTheDocument();
  });

  it('shows budget bars', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHealthResponse()),
    });

    render(<AIEngineDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Consommation budget')).toBeInTheDocument();
    });
    expect(screen.getByText('Budget journalier')).toBeInTheDocument();
    expect(screen.getByText('Budget mensuel')).toBeInTheDocument();
    // Check formatted values: 150/100 = 1.50, 1000/100 = 10.00
    expect(screen.getByText('1.50 / 10.00 MAD')).toBeInTheDocument();
  });

  it('shows "Nouvelle génération IA" button', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHealthResponse()),
    });

    render(<AIEngineDashboardPage />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Nouvelle génération IA/i }),
      ).toBeInTheDocument();
    });
  });

  it('disabled state shows module disabled message when enabled=false', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHealthResponse({ enabled: false })),
    });

    render(<AIEngineDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Module désactivé')).toBeInTheDocument();
    });
    expect(screen.getByText(/AI_ENGINE_ENABLED=true/)).toBeInTheDocument();
  });

  it('error state shows error message', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({}),
    });

    render(<AIEngineDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Statut indisponible')).toBeInTheDocument();
    });
    expect(screen.getByText(/Erreur 500/)).toBeInTheDocument();
  });

  it('retry button re-fetches health', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () => Promise.resolve({}),
    });

    render(<AIEngineDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Statut indisponible')).toBeInTheDocument();
    });

    // Now mock a successful response
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockHealthResponse()),
    });

    const retryBtn = screen.getByRole('button', { name: /Réessayer/i });
    fireEvent.click(retryBtn);

    await waitFor(() => {
      expect(screen.getByText('Texte / LLM')).toBeInTheDocument();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('shows timeout message after AbortError', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    fetchSpy.mockRejectedValue(abortError);

    render(<AIEngineDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText(/Délai d'attente dépassé/)).toBeInTheDocument();
    });
  });

  it('links to create page', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHealthResponse()),
    });

    render(<AIEngineDashboardPage />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Nouvelle génération IA/i }),
      ).toBeInTheDocument();
    });

    const createLink = screen
      .getByRole('button', { name: /Nouvelle génération IA/i })
      .closest('a');
    expect(createLink).toHaveAttribute(
      'href',
      '/admin/content-studio-v2/ai-engine/create',
    );
  });

  it('links to config page', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockHealthResponse()),
    });

    render(<AIEngineDashboardPage />);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Configuration/i }),
      ).toBeInTheDocument();
    });

    const configLink = screen
      .getByRole('button', { name: /Configuration/i })
      .closest('a');
    expect(configLink).toHaveAttribute('href', '/admin/settings/ai-engine');
  });
});
