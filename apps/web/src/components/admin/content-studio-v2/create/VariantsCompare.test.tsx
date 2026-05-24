/**
 * Tests for VariantsCompare — grid of variant cards with selection.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VariantsCompare } from './VariantsCompare';
import type { VariantViewModel } from './VariantsCompare';
import { buildContentDraft } from '@/test/factories/content-studio';

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
});
