/**
 * Tests `StepCard` — Server Component pur.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { StepCard } from './StepCard';
import type { ProductFeedStep } from '@/lib/products/feed/types';

afterEach(() => cleanup());

const baseStep: ProductFeedStep = {
  step: 1,
  kicker: 'Préparation',
  title: 'Préparez vos ongles',
  description: 'On nettoie, on sèche, on lime.',
  accent: 'sauge',
};

describe('StepCard — base', () => {
  it('rend pastille avec numéro et accent color', () => {
    render(<StepCard step={baseStep} />);
    const card = screen.getByTestId('step-card-1');
    expect(card.querySelector('span')?.textContent).toBe('1');
    expect(card.querySelector('span')?.className).toContain('bg-sauge-soft');
  });

  it('rend kicker, h4, description', () => {
    render(<StepCard step={baseStep} />);
    expect(screen.getByText('Préparation')).toBeDefined();
    expect(screen.getByRole('heading', { level: 4 }).textContent).toBe(
      'Préparez vos ongles',
    );
    expect(screen.getByText(/On nettoie/)).toBeDefined();
  });
});

describe('StepCard — duration badge', () => {
  it('rend le badge si duration présente', () => {
    render(<StepCard step={{ ...baseStep, duration: '30 s' }} />);
    expect(screen.getByTestId('step-duration-1').textContent).toContain('30 s');
  });

  it('ne rend pas le badge si duration absente (rétro-compat)', () => {
    render(<StepCard step={baseStep} />);
    expect(screen.queryByTestId('step-duration-1')).toBeNull();
  });
});

describe('StepCard — isResult', () => {
  const resultStep: ProductFeedStep = {
    ...baseStep,
    step: 4,
    accent: 'champagne',
    isResult: true,
  };

  it('porte data-is-result="true"', () => {
    render(<StepCard step={resultStep} />);
    expect(
      screen.getByTestId('step-card-4').getAttribute('data-is-result'),
    ).toBe('true');
  });

  it('pastille a anneau doublé champagne', () => {
    render(<StepCard step={resultStep} />);
    const card = screen.getByTestId('step-card-4');
    const pastille = card.querySelector('span');
    expect(pastille?.className).toContain('ring-2');
    expect(pastille?.className).toContain('ring-champagne-dark/30');
  });

  it('rend le badge RÉSULTAT', () => {
    render(<StepCard step={resultStep} />);
    const badge = screen.getByTestId('step-badge-4');
    expect(badge.textContent).toContain('Résultat');
  });

  it('description en font-display italic', () => {
    render(<StepCard step={resultStep} />);
    const desc = screen.getByText(resultStep.description);
    expect(desc.className).toContain('font-display');
    expect(desc.className).toContain('italic');
  });

  it('un step non-isResult ne porte ni badge ni ring doublé', () => {
    render(<StepCard step={baseStep} />);
    expect(screen.queryByTestId('step-badge-1')).toBeNull();
    expect(
      screen.getByTestId('step-card-1').getAttribute('data-is-result'),
    ).toBeNull();
  });
});
