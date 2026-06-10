/**
 * @vitest-environment jsdom
 */
/**
 * Tests for the ReviewPanel — the human-in-the-loop review UI embedded in the
 * create page.  We render the full create page with fetch mocked to return
 * status='review' so the ReviewPanel phase activates.
 *
 * Gap #31 — 12 tests
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

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

import AIEngineCreatePage from '@/app/admin/content-studio-v2/ai-engine/create/page';

/** Fill required fields so the form becomes valid & clickable. */
function fillRequiredFields() {
  const selects = Array.from(
    document.querySelectorAll('select'),
  ) as HTMLSelectElement[];
  fireEvent.change(selects[0]!, { target: { value: 'awareness' } });
  fireEvent.change(selects[1]!, { target: { value: 'instagram' } });
  fireEvent.change(selects[2]!, { target: { value: 'reel' } });
  fireEvent.change(selects[3]!, { target: { value: 'empowering' } });
  fireEvent.change(screen.getByPlaceholderText(/message principal/i), {
    target: { value: 'Test message' },
  });
}

function reviewResponse() {
  return {
    status: 'review',
    jobId: 'job_abcdef1234567890',
    reviewPayload: {
      script: {
        hook: 'Saviez-vous que votre peau change ?',
        cta: 'Découvrez notre sérum',
        scenes: [
          { sceneNumber: 1, narration: 'Première scène narration' },
        ],
      },
      caption: 'Votre routine hivernale commence ici.',
      hashtags: ['skincare', 'winter', 'glow'],
      images: [],
      qualityScores: { brand_alignment: 0.85, clarity: 0.92 },
      moderationResult: null,
    },
  };
}

/**
 * Trigger generate, then advance fake timers to exhaust the
 * simulateProgress pipeline (6 steps, each up to 3000ms).
 * After all steps complete, the page transitions to the review phase.
 */
async function goToReviewPhase(fetchSpy: ReturnType<typeof vi.fn>) {
  fetchSpy.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(reviewResponse()),
  });

  render(<AIEngineCreatePage />);
  fillRequiredFields();

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Générer/i }));
  });

  // The fetch resolves immediately, then simulateProgress runs 6 steps
  // with setTimeout(fn, 800 + Math.random() * 2200) each.
  // Advance timers generously through all 6 steps.
  for (let i = 0; i < 7; i++) {
    await act(async () => {
      vi.advanceTimersByTime(3100);
    });
  }

  // Now the review phase should be visible
  expect(screen.getByText('Revue humaine requise')).toBeInTheDocument();
}

describe('ReviewPanel (via Create page, Gap #31)', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('review phase shows script hook text', async () => {
    await goToReviewPhase(fetchSpy);
    expect(
      screen.getByText(/Saviez-vous que votre peau change/),
    ).toBeInTheDocument();
  });

  it('review phase shows caption text', async () => {
    await goToReviewPhase(fetchSpy);
    expect(
      screen.getByText('Votre routine hivernale commence ici.'),
    ).toBeInTheDocument();
  });

  it('review phase shows hashtag badges', async () => {
    await goToReviewPhase(fetchSpy);
    expect(screen.getByText('#skincare')).toBeInTheDocument();
    expect(screen.getByText('#winter')).toBeInTheDocument();
    expect(screen.getByText('#glow')).toBeInTheDocument();
  });

  it('review phase shows quality scores', async () => {
    await goToReviewPhase(fetchSpy);
    expect(screen.getByText('Scores qualité')).toBeInTheDocument();
    expect(screen.getByText(/brand_alignment/i)).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('92%')).toBeInTheDocument();
  });

  it('"Approuver" button is visible', async () => {
    await goToReviewPhase(fetchSpy);
    expect(
      screen.getByRole('button', { name: /Approuver/i }),
    ).toBeInTheDocument();
  });

  it('"Rejeter" button is visible', async () => {
    await goToReviewPhase(fetchSpy);
    expect(
      screen.getByRole('button', { name: /Rejeter/i }),
    ).toBeInTheDocument();
  });

  it('"Demander des modifications" button is visible', async () => {
    await goToReviewPhase(fetchSpy);
    expect(
      screen.getByRole('button', { name: /Demander des modifications/i }),
    ).toBeInTheDocument();
  });

  it('clicking "Rejeter" shows feedback textarea', async () => {
    await goToReviewPhase(fetchSpy);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Rejeter/i }));
    });

    expect(
      screen.getByPlaceholderText(/ne convient pas/i),
    ).toBeInTheDocument();
  });

  it('clicking "Demander des modifications" shows feedback textarea', async () => {
    await goToReviewPhase(fetchSpy);

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: /Demander des modifications/i }),
      );
    });

    expect(
      screen.getByPlaceholderText(/modifications souhaitées/i),
    ).toBeInTheDocument();
  });

  it('feedback textarea accepts text input', async () => {
    await goToReviewPhase(fetchSpy);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Rejeter/i }));
    });

    const textarea = screen.getByPlaceholderText(/ne convient pas/i);
    fireEvent.change(textarea, { target: { value: 'Pas assez engageant' } });
    expect(textarea).toHaveValue('Pas assez engageant');
  });

  it('submitting approval calls the review API', async () => {
    await goToReviewPhase(fetchSpy);

    // Mock the review API call
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          status: 'completed',
          script: { hook: 'Approved hook' },
          caption: 'Approved caption',
          hashtags: ['approved'],
          totalCostCents: 200,
        }),
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Approuver/i }));
    });

    // The second fetch call should be the review API
    const calls = fetchSpy.mock.calls;
    const reviewCall = calls.find(
      (c: unknown[]) =>
        typeof c[0] === 'string' && c[0].includes('/review'),
    );
    expect(reviewCall).toBeDefined();
  });

  it('after approval, result phase appears', async () => {
    await goToReviewPhase(fetchSpy);

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          status: 'completed',
          script: { hook: 'Final hook' },
          caption: 'Final approved caption',
          hashtags: ['final'],
          totalCostCents: 300,
        }),
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Approuver/i }));
    });

    // Allow any microtasks to flush
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(screen.getByText('Contenu généré')).toBeInTheDocument();
  });
});
