/**
 * @vitest-environment jsdom
 */
/**
 * Tests for error banners / states across multiple AI Engine pages.
 * Each page is rendered with fetch mocked to fail in various ways.
 *
 * Gap #35 — 8 tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock next/link for all page components
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

import AIEngineDashboardPage from '@/app/admin/content-studio-v2/ai-engine/page';
import AIEngineCreatePage from '@/app/admin/content-studio-v2/ai-engine/create/page';
import TrendsPage from '@/app/admin/content-studio-v2/ai-engine/trends/page';
import KnowledgeBasePage from '@/app/admin/content-studio-v2/ai-engine/knowledge/page';
import AIEngineConfigPage from '@/app/admin/content-studio-v2/ai-engine/config/page';

/** Helpers to fill create-page required fields */
function fillCreateForm() {
  const selects = Array.from(
    document.querySelectorAll('select'),
  ) as HTMLSelectElement[];
  fireEvent.change(selects[0]!, { target: { value: 'awareness' } });
  fireEvent.change(selects[1]!, { target: { value: 'instagram' } });
  fireEvent.change(selects[2]!, { target: { value: 'reel' } });
  fireEvent.change(selects[3]!, { target: { value: 'empowering' } });
  fireEvent.change(screen.getByPlaceholderText(/message principal/i), {
    target: { value: 'Test message for error' },
  });
}

describe('ErrorBanners (Gap #35)', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('dashboard: health 500 shows "Statut indisponible"', async () => {
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

  it('dashboard: health timeout shows "Délai d\'attente dépassé"', async () => {
    const abortError = new DOMException(
      'The operation was aborted.',
      'AbortError',
    );
    fetchSpy.mockRejectedValue(abortError);

    render(<AIEngineDashboardPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Délai d'attente dépassé/),
      ).toBeInTheDocument();
    });
  });

  it('dashboard: retry button re-fetches', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () => Promise.resolve({}),
    });

    render(<AIEngineDashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Statut indisponible')).toBeInTheDocument();
    });

    // Mock successful response for retry
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          enabled: true,
          providers: {
            text: {
              name: 'OpenAI',
              provider: 'openai',
              model: 'gpt-4o',
              status: 'active',
            },
          },
          budget: {
            dailyUsedCents: 0,
            dailyLimitCents: 1000,
            monthlyUsedCents: 0,
            monthlyLimitCents: 20000,
          },
        }),
    });

    fireEvent.click(screen.getByRole('button', { name: /Réessayer/i }));

    await waitFor(() => {
      expect(screen.getByText('Texte / LLM')).toBeInTheDocument();
    });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('create: generate 500 shows error phase with message', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      json: () =>
        Promise.resolve({ error: 'Internal server error pipeline crashed' }),
    });

    render(<AIEngineCreatePage />);
    fillCreateForm();
    fireEvent.click(screen.getByRole('button', { name: /Générer/i }));

    await waitFor(() => {
      expect(screen.getByText('Erreur de génération')).toBeInTheDocument();
    });
    expect(
      screen.getByText('Internal server error pipeline crashed'),
    ).toBeInTheDocument();
  });

  it('create: generate 429 shows "Budget" error', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 429,
      json: () =>
        Promise.resolve({ error: 'Budget journalier dépassé' }),
    });

    render(<AIEngineCreatePage />);
    fillCreateForm();
    fireEvent.click(screen.getByRole('button', { name: /Générer/i }));

    await waitFor(() => {
      expect(screen.getByText('Erreur de génération')).toBeInTheDocument();
    });
    expect(
      screen.getByText(/Budget journalier dépassé/),
    ).toBeInTheDocument();
  });

  it('trends: fetch fail shows empty state', async () => {
    fetchSpy.mockRejectedValue(new Error('Network Error'));

    render(<TrendsPage />);

    await waitFor(() => {
      expect(
        screen.getByText(/Aucune tendance détectée/i),
      ).toBeInTheDocument();
    });
  });

  it('knowledge: embed fail shows error banner', async () => {
    // First call: fetch collections succeeds with data
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          collections: [
            {
              id: 'col_1',
              name: 'Test Collection',
              slug: 'test-collection',
              description: 'A test collection',
              category: 'science',
              documentCount: 5,
              chunkCount: 20,
              lastIndexedAt: null,
              isActive: true,
            },
          ],
        }),
    });

    render(<KnowledgeBasePage />);

    await waitFor(() => {
      expect(
        screen.getByText('Base de connaissances'),
      ).toBeInTheDocument();
    });

    // Mock embed call to fail
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () =>
        Promise.resolve({ error: 'Embedding service unavailable' }),
    });

    fireEvent.click(
      screen.getByRole('button', { name: /Générer les embeddings/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Embedding service unavailable/),
      ).toBeInTheDocument();
    });
  });

  it('config: fetch fail shows "Impossible de charger la configuration"', async () => {
    fetchSpy.mockRejectedValue(new Error('Fournisseurs: 500'));

    render(<AIEngineConfigPage />);

    await waitFor(() => {
      expect(
        screen.getByText('Impossible de charger la configuration'),
      ).toBeInTheDocument();
    });
  });
});
