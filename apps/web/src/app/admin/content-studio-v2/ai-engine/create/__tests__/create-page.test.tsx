/**
 * Tests for the AI Engine Create page — the brief form, generation pipeline,
 * error/result phases, and field validation.
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

import AIEngineCreatePage from '../page';

/**
 * Helper: get all <select> elements rendered in the brief form.
 */
function getSelects(): HTMLSelectElement[] {
  // The page has 4 select fields: Objective, Platform, Format, Tone
  return Array.from(document.querySelectorAll('select'));
}

/**
 * Helper: fill in all required fields so the form becomes valid.
 */
function fillRequiredFields() {
  const selects = getSelects();

  // Objective
  fireEvent.change(selects[0]!, { target: { value: 'awareness' } });
  // Platform
  fireEvent.change(selects[1]!, { target: { value: 'instagram' } });
  // Format
  fireEvent.change(selects[2]!, { target: { value: 'single_image' } });
  // Tone
  fireEvent.change(selects[3]!, { target: { value: 'empowering' } });

  // Key message
  const keyMessageTextarea = screen.getByPlaceholderText(
    /message principal/i,
  );
  fireEvent.change(keyMessageTextarea, {
    target: { value: 'Un message test pour la validation' },
  });
}

describe('AIEngineCreatePage', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders brief form with all fields', () => {
    render(<AIEngineCreatePage />);
    expect(screen.getByText('Brief créatif')).toBeInTheDocument();
    expect(screen.getByText('Objectif')).toBeInTheDocument();
    expect(screen.getByText('Plateforme')).toBeInTheDocument();
    expect(screen.getByText('Format')).toBeInTheDocument();
    expect(screen.getByText('Ton')).toBeInTheDocument();
    expect(screen.getByText('Message clé')).toBeInTheDocument();
    expect(screen.getByText('Focus produit')).toBeInTheDocument();
    expect(screen.getByText('Référence tendance')).toBeInTheDocument();
  });

  it('objective dropdown has correct options', () => {
    render(<AIEngineCreatePage />);
    const selects = getSelects();
    const options = selects[0]!.querySelectorAll('option');
    const values = Array.from(options).map((o) => o.getAttribute('value'));
    expect(values).toContain('awareness');
    expect(values).toContain('engagement');
    expect(values).toContain('conversion');
    expect(values).toContain('education');
    expect(values).toContain('loyalty');
    expect(values).toContain('ugc');
  });

  it('platform dropdown has correct options', () => {
    render(<AIEngineCreatePage />);
    const selects = getSelects();
    const options = selects[1]!.querySelectorAll('option');
    const values = Array.from(options).map((o) => o.getAttribute('value'));
    expect(values).toContain('instagram');
    expect(values).toContain('tiktok');
    expect(values).toContain('facebook');
    expect(values).toContain('youtube');
    expect(values).toContain('linkedin');
    expect(values).toContain('pinterest');
  });

  it('format dropdown has correct options', () => {
    render(<AIEngineCreatePage />);
    const selects = getSelects();
    const options = selects[2]!.querySelectorAll('option');
    const values = Array.from(options).map((o) => o.getAttribute('value'));
    expect(values).toContain('reel');
    expect(values).toContain('carousel');
    expect(values).toContain('story');
    expect(values).toContain('single_image');
    expect(values).toContain('text_post');
    expect(values).toContain('infographic');
  });

  it('tone dropdown has correct options', () => {
    render(<AIEngineCreatePage />);
    const selects = getSelects();
    const options = selects[3]!.querySelectorAll('option');
    const values = Array.from(options).map((o) => o.getAttribute('value'));
    expect(values).toContain('empowering');
    expect(values).toContain('educational');
    expect(values).toContain('playful');
    expect(values).toContain('luxurious');
    expect(values).toContain('authentic');
    expect(values).toContain('urgent');
  });

  it('key message textarea is required', () => {
    render(<AIEngineCreatePage />);
    const textarea = screen.getByPlaceholderText(/message principal/i);
    expect(textarea).toHaveAttribute('required');
  });

  it('"Générer" button is disabled when form incomplete', () => {
    render(<AIEngineCreatePage />);
    const btn = screen.getByRole('button', { name: /Générer/i });
    expect(btn).toBeDisabled();
  });

  it('"Générer" button is enabled when form complete', () => {
    render(<AIEngineCreatePage />);
    fillRequiredFields();
    const btn = screen.getByRole('button', { name: /Générer/i });
    expect(btn).not.toBeDisabled();
  });

  it('clicking "Générer" shows pipeline progress', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          script: { hook: 'Test hook' },
          caption: 'Test caption',
          hashtags: ['test'],
          totalCostCents: 100,
        }),
    });

    render(<AIEngineCreatePage />);
    fillRequiredFields();

    const btn = screen.getByRole('button', { name: /Générer/i });
    fireEvent.click(btn);

    // After clicking, the pipeline progress should appear
    await waitFor(() => {
      expect(screen.getByText('Pipeline de génération')).toBeInTheDocument();
    });
  });

  it('error phase shows error message', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Quota exceeded' }),
    });

    render(<AIEngineCreatePage />);
    fillRequiredFields();

    const btn = screen.getByRole('button', { name: /Générer/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(screen.getByText('Erreur de génération')).toBeInTheDocument();
    });
    expect(screen.getByText('Quota exceeded')).toBeInTheDocument();
  });

  it('error phase shows retry button', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server Error' }),
    });

    render(<AIEngineCreatePage />);
    fillRequiredFields();

    const btn = screen.getByRole('button', { name: /Générer/i });
    fireEvent.click(btn);

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /Réessayer/i }),
      ).toBeInTheDocument();
    });
  });

  it('reset button returns to brief phase', async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Error' }),
    });

    render(<AIEngineCreatePage />);
    fillRequiredFields();

    fireEvent.click(screen.getByRole('button', { name: /Générer/i }));

    await waitFor(() => {
      expect(screen.getByText('Erreur de génération')).toBeInTheDocument();
    });

    const resetBtn = screen.getByRole('button', {
      name: /Modifier le brief/i,
    });
    fireEvent.click(resetBtn);

    expect(screen.getByText('Brief créatif')).toBeInTheDocument();
  });

  it('back arrow link goes to /ai-engine', () => {
    render(<AIEngineCreatePage />);
    const backLink = screen.getByRole('link', { name: '' });
    // Find the link that goes back to ai-engine
    const links = screen.getAllByRole('link');
    const backArrow = links.find((l) =>
      l.getAttribute('href')?.includes('/ai-engine'),
    );
    expect(backArrow).toHaveAttribute(
      'href',
      '/admin/content-studio-v2/ai-engine',
    );
  });

  it('product focus is optional', () => {
    render(<AIEngineCreatePage />);
    const input = screen.getByPlaceholderText(/Nom du produit/i);
    expect(input).not.toHaveAttribute('required');
  });

  it('trend reference is optional', () => {
    render(<AIEngineCreatePage />);
    const input = screen.getByPlaceholderText(/Trend TikTok/i);
    expect(input).not.toHaveAttribute('required');
  });

  it('form maps format values correctly (single_image value exists)', () => {
    render(<AIEngineCreatePage />);
    const selects = getSelects();
    fireEvent.change(selects[2]!, { target: { value: 'single_image' } });
    expect(selects[2]).toHaveValue('single_image');
  });

  it('shows reel format option in dropdown', () => {
    render(<AIEngineCreatePage />);
    // Check that the reel option text is present
    expect(screen.getByText('Reel / Short vidéo')).toBeInTheDocument();
  });

  it('shows single_image format option (post) in dropdown', () => {
    render(<AIEngineCreatePage />);
    expect(screen.getByText('Image unique')).toBeInTheDocument();
  });
});
