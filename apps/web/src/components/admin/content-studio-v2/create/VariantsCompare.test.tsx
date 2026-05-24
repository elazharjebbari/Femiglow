/**
 * Tests for VariantsCompare — grid of variant cards with selection.
 */

import { describe, it, expect, vi, beforeAll, afterEach, afterAll } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { server, http, HttpResponse } from '@/test/msw/server';
import { VariantsCompare } from './VariantsCompare';
import type { VariantViewModel } from './VariantsCompare';
import { buildContentDraft } from '@/test/factories/content-studio';

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  },
}));

import { toast } from 'sonner';

beforeAll(() => server.listen({ onUnhandledRequest: 'bypass' }));
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
});
afterAll(() => server.close());

function makeVariant(overrides: Partial<VariantViewModel> = {}): VariantViewModel {
  return {
    draft: buildContentDraft({
      id: overrides.draft?.id ?? 'draft_v1',
      variantLabel: overrides.draft?.variantLabel ?? 'A',
      caption: overrides.draft?.caption ?? 'Caption variante A',
      hook: overrides.draft?.hook ?? 'Accroche A',
    }),
    score: overrides.score ?? null,
    violations: overrides.violations ?? [],
  };
}

describe('VariantsCompare', () => {
  it('renders N variant cards', () => {
    const variants = [
      makeVariant({ draft: buildContentDraft({ id: 'v1', variantLabel: 'Sobre' }) }),
      makeVariant({ draft: buildContentDraft({ id: 'v2', variantLabel: 'Sensorielle' }) }),
      makeVariant({ draft: buildContentDraft({ id: 'v3', variantLabel: 'Conversion' }) }),
    ];
    render(
      <VariantsCompare variants={variants} selectedId={null} onSelect={vi.fn()} />,
    );
    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(3);
  });

  it('clicking a variant calls onSelect', () => {
    const onSelect = vi.fn();
    const variants = [
      makeVariant({ draft: buildContentDraft({ id: 'v1', variantLabel: 'Sobre' }) }),
      makeVariant({ draft: buildContentDraft({ id: 'v2', variantLabel: 'Sensorielle' }) }),
    ];
    render(
      <VariantsCompare variants={variants} selectedId={null} onSelect={onSelect} />,
    );
    // Click the "Choisir cette variante" button on the second card
    const chooseButtons = screen.getAllByRole('button', {
      name: /Choisir cette variante/i,
    });
    fireEvent.click(chooseButtons[1]!);
    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        draft: expect.objectContaining({ id: 'v2' }),
      }),
    );
  });

  it('selected variant is highlighted (data-selected="true")', () => {
    const variants = [
      makeVariant({ draft: buildContentDraft({ id: 'v1', variantLabel: 'Sobre' }) }),
      makeVariant({ draft: buildContentDraft({ id: 'v2', variantLabel: 'Sensorielle' }) }),
    ];
    render(
      <VariantsCompare variants={variants} selectedId="v2" onSelect={vi.fn()} />,
    );
    const articles = screen.getAllByRole('article');
    const selectedArticle = articles.find(
      (a) => a.getAttribute('data-selected') === 'true',
    );
    expect(selectedArticle).toBeDefined();
    expect(selectedArticle?.getAttribute('data-variant-id')).toBe('v2');
  });

  it('loading state shows loading message', () => {
    render(
      <VariantsCompare
        variants={[]}
        selectedId={null}
        onSelect={vi.fn()}
        loading
      />,
    );
    expect(
      screen.getByText(/Génération des variantes en cours/i),
    ).toBeInTheDocument();
  });

  it('score badge rendered when score provided', () => {
    const variants = [
      makeVariant({
        draft: buildContentDraft({ id: 'v1', variantLabel: 'Sobre' }),
        score: 87,
      }),
    ];
    render(
      <VariantsCompare variants={variants} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText('87/100')).toBeInTheDocument();
  });

  it('empty variants show prompt to generate', () => {
    render(
      <VariantsCompare variants={[]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(
      screen.getByText(/Lance la génération pour voir 3 variantes/i),
    ).toBeInTheDocument();
  });

  it('selected variant shows "Sélectionnée" button text', () => {
    const variants = [
      makeVariant({ draft: buildContentDraft({ id: 'v1', variantLabel: 'Sobre' }) }),
    ];
    render(
      <VariantsCompare variants={variants} selectedId="v1" onSelect={vi.fn()} />,
    );
    expect(
      screen.getByRole('button', { name: /Sélectionnée/i }),
    ).toBeInTheDocument();
  });

  it('"Rejeter" button visible on non-selected variant', () => {
    const variants = [
      makeVariant({ draft: buildContentDraft({ id: 'v1', variantLabel: 'Sobre' }) }),
      makeVariant({ draft: buildContentDraft({ id: 'v2', variantLabel: 'Sensorielle' }) }),
    ];
    render(
      <VariantsCompare variants={variants} selectedId="v1" onSelect={vi.fn()} />,
    );
    // Non-selected variant (v2) should have the Rejeter button
    expect(screen.getByRole('button', { name: /Rejeter/i })).toBeInTheDocument();
  });

  it('"Rejeter" button NOT visible on selected variant', () => {
    const variants = [
      makeVariant({ draft: buildContentDraft({ id: 'v1', variantLabel: 'Sobre' }) }),
    ];
    render(
      <VariantsCompare variants={variants} selectedId="v1" onSelect={vi.fn()} />,
    );
    expect(screen.queryByRole('button', { name: /Rejeter/i })).not.toBeInTheDocument();
  });

  it('click Rejeter opens dialog with reason textarea', async () => {
    const variants = [
      makeVariant({ draft: buildContentDraft({ id: 'v1', variantLabel: 'Sobre' }) }),
    ];
    render(
      <VariantsCompare variants={variants} selectedId={null} onSelect={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Rejeter/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/Raison du rejet/i)).toBeInTheDocument();
    });
  });

  it('confirm reject calls fetch and fires onReject callback', async () => {
    const onReject = vi.fn();
    const draft = buildContentDraft({ id: 'v1', variantLabel: 'Sobre' });
    const variants = [makeVariant({ draft })];
    server.use(
      http.post('/api/admin/content-studio/drafts/v1/reject', async () => {
        return HttpResponse.json({ ok: true });
      }),
    );
    render(
      <VariantsCompare variants={variants} selectedId={null} onSelect={vi.fn()} onReject={onReject} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Rejeter/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/Raison du rejet/i)).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText(/Raison du rejet/i), {
      target: { value: 'Pas assez percutant' },
    });
    fireEvent.click(screen.getByTestId('confirm-reject'));
    await waitFor(() => {
      expect(onReject).toHaveBeenCalledWith(expect.objectContaining({ id: 'v1' }));
    });
  });

  it('reject error shows toast.error', async () => {
    const variants = [
      makeVariant({ draft: buildContentDraft({ id: 'v1', variantLabel: 'Sobre' }) }),
    ];
    server.use(
      http.post('/api/admin/content-studio/drafts/v1/reject', async () => {
        return HttpResponse.json({ error: 'fail' }, { status: 500 });
      }),
    );
    render(
      <VariantsCompare variants={variants} selectedId={null} onSelect={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Rejeter/i }));
    await waitFor(() => {
      expect(screen.getByLabelText(/Raison du rejet/i)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('confirm-reject'));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Rejet échoué.');
    });
  });
});
