/**
 * Tests `IngredientCard` — carte verticale mobile.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { IngredientCard } from './IngredientCard';
import type { IngredientDetailed } from '@/lib/schemas';

afterEach(() => cleanup());

const baseIngredient: IngredientDetailed = {
  name: 'Cire d’abeille',
  inci: 'Cera Alba',
  function: 'Filmogène naturel',
  origin: 'Coopérative apicole, Atlas marocain',
  concentrationPct: 12,
};

describe('IngredientCard — rendu', () => {
  it('affiche le nom, l\'INCI, la fonction, l\'origine et le %', () => {
    render(
      <IngredientCard
        ingredient={baseIngredient}
        subProductId="1-paste"
        accentColor="sauge"
      />,
    );
    expect(screen.getByText('Cire d’abeille')).toBeDefined();
    expect(screen.getByText('Cera Alba')).toBeDefined();
    expect(screen.getByText(/Filmogène naturel/)).toBeDefined();
    expect(screen.getByText(/Coopérative apicole/)).toBeDefined();
    expect(screen.getByText(/12.*%/)).toBeDefined();
  });

  it('teinte le pourcentage en couleur d\'accent (sauge)', () => {
    render(
      <IngredientCard
        ingredient={baseIngredient}
        subProductId="1-paste"
        accentColor="sauge"
      />,
    );
    const pctEl = screen.getByText(/12.*%/) as HTMLElement;
    // resolveAccentHex('sauge') = #A8B89E
    expect(pctEl.style.color.toLowerCase()).toBe('rgb(168, 184, 158)');
  });

  it('utilise un fallback champagne si accentColor absent', () => {
    render(<IngredientCard ingredient={baseIngredient} subProductId="1-paste" />);
    const pctEl = screen.getByText(/12.*%/) as HTMLElement;
    // resolveAccentHex(undefined) = #B8956B (champagne fallback)
    expect(pctEl.style.color.toLowerCase()).toBe('rgb(184, 149, 107)');
  });

  it('affiche « — » si concentrationPct est absent', () => {
    render(
      <IngredientCard
        ingredient={{ ...baseIngredient, concentrationPct: undefined }}
        subProductId="1-paste"
      />,
    );
    expect(screen.getByText('—')).toBeDefined();
  });

  it('data-testid stable basé sur subProductId + inci', () => {
    render(
      <IngredientCard ingredient={baseIngredient} subProductId="1-paste" />,
    );
    expect(screen.getByTestId('ingredient-card-1-paste-Cera Alba')).toBeDefined();
  });

  it('sépare fonction et origine par un point médian (·) décoratif', () => {
    const { container } = render(
      <IngredientCard ingredient={baseIngredient} subProductId="1-paste" />,
    );
    const dot = container.querySelector('[aria-hidden="true"]');
    expect(dot?.textContent).toBe('·');
  });

  it('arrondi et bordure encre/10 (carte premium)', () => {
    const { container } = render(
      <IngredientCard ingredient={baseIngredient} subProductId="1-paste" />,
    );
    const card = container.firstChild as HTMLElement;
    expect(card.className).toMatch(/rounded-md/);
    expect(card.className).toMatch(/border-encre\/10/);
  });
});
