/**
 * Tests `ResponsiveIngredientList` — choisit cards mobile vs tableau desktop.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { ResponsiveIngredientList } from './ResponsiveIngredientList';
import { mockKitPageContent } from '@/data/mock/kit';

afterEach(() => cleanup());

const subProduct = mockKitPageContent.composition[0]!;

describe('ResponsiveIngredientList', () => {
  it('rend la liste mobile (cards) ET le tableau desktop côte à côte (CSS toggle)', () => {
    render(
      <ResponsiveIngredientList
        ingredients={subProduct.ingredients}
        subProductId={subProduct.id}
        accentColor={subProduct.accentColor}
      />,
    );
    expect(screen.getByTestId(`responsive-list-mobile-${subProduct.id}`)).toBeDefined();
    expect(screen.getByTestId(`responsive-list-desktop-${subProduct.id}`)).toBeDefined();
  });

  it('rend autant de IngredientCard que d\'ingredients (mobile)', () => {
    render(
      <ResponsiveIngredientList
        ingredients={subProduct.ingredients}
        subProductId={subProduct.id}
      />,
    );
    const mobile = screen.getByTestId(`responsive-list-mobile-${subProduct.id}`);
    expect(mobile.querySelectorAll('li').length).toBe(subProduct.ingredients.length);
  });

  it('propage accentColor aux IngredientCard', () => {
    render(
      <ResponsiveIngredientList
        ingredients={subProduct.ingredients}
        subProductId={subProduct.id}
        accentColor="sauge"
      />,
    );
    // Le %, dans le 1er card mobile, doit être teinté sauge.
    const mobile = screen.getByTestId(`responsive-list-mobile-${subProduct.id}`);
    const firstPct = mobile.querySelector('[style*="rgb(168, 184, 158)"]');
    expect(firstPct).not.toBeNull();
  });

  it('trie les ingrédients par % décroissant (Kolenda §11)', () => {
    const ingredients = [
      { name: 'Low', inci: 'L', function: 'f', origin: 'o', concentrationPct: 1 },
      { name: 'High', inci: 'H', function: 'f', origin: 'o', concentrationPct: 60 },
      { name: 'Mid', inci: 'M', function: 'f', origin: 'o', concentrationPct: 12 },
    ];
    render(<ResponsiveIngredientList ingredients={ingredients} subProductId="test" />);
    const mobile = screen.getByTestId('responsive-list-mobile-test');
    const names = Array.from(mobile.querySelectorAll('li p:first-child')).map(
      (el) => el.textContent,
    );
    expect(names).toEqual(['High', 'Mid', 'Low']);
  });

  it('aria-label informatif sur la liste mobile', () => {
    render(
      <ResponsiveIngredientList
        ingredients={subProduct.ingredients}
        subProductId={subProduct.id}
      />,
    );
    const mobile = screen.getByTestId(`responsive-list-mobile-${subProduct.id}`);
    expect(mobile.getAttribute('aria-label')).toMatch(/décroissant/i);
  });

  it('cache la liste mobile sur sm+ via class `sm:hidden`', () => {
    render(
      <ResponsiveIngredientList
        ingredients={subProduct.ingredients}
        subProductId={subProduct.id}
      />,
    );
    const mobile = screen.getByTestId(`responsive-list-mobile-${subProduct.id}`);
    expect(mobile.className).toMatch(/sm:hidden/);
  });
});
