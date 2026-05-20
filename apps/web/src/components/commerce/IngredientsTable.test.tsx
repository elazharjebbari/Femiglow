/**
 * Tests `IngredientsTable` — tableau 5 colonnes desktop.
 * Refactor Phase 2 : signature étendue, plus de figcaption ni de certifications
 * (gérés par `SubProductBlock`).
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { IngredientsTable } from './IngredientsTable';
import { mockKitPageContent } from '@/data/mock/kit';
import { expectNoAxeViolations } from '@/test/axe';

const subProduct = mockKitPageContent.composition[0]!;

describe('IngredientsTable — rétrocompat signature subProduct', () => {
  it('accepte la forme legacy `subProduct={…}`', () => {
    render(<IngredientsTable subProduct={subProduct} />);
    expect(screen.getByTestId(`ingredients-table-${subProduct.id}`)).toBeDefined();
  });

  it('rend une ligne par ingrédient avec scope row', () => {
    render(<IngredientsTable subProduct={subProduct} />);
    subProduct.ingredients.forEach((ing) => {
      const cell = screen.getByRole('rowheader', { name: ing.name });
      expect(cell).toHaveAttribute('scope', 'row');
    });
  });
});

describe('IngredientsTable — nouvelle signature ingredients/subProductId/accentColor', () => {
  it('accepte la forme moderne avec ingredients explicite', () => {
    render(
      <IngredientsTable
        ingredients={subProduct.ingredients}
        subProductId={subProduct.id}
        accentColor={subProduct.accentColor}
      />,
    );
    expect(screen.getByTestId(`ingredients-table-${subProduct.id}`)).toBeDefined();
  });

  it('teinte la colonne % en couleur d\'accent (sauge)', () => {
    render(
      <IngredientsTable
        ingredients={[
          { name: 'A', inci: 'INCI-A', function: 'F', origin: 'O', concentrationPct: 10 },
        ]}
        subProductId="test"
        accentColor="sauge"
      />,
    );
    const cell = screen.getByText(/10\s*%/) as HTMLElement;
    expect(cell.style.color.toLowerCase()).toBe('rgb(168, 184, 158)');
  });
});

describe('IngredientsTable — Kolenda', () => {
  it('lignes alternées bg-creme / bg-creme-warm/40', () => {
    const { container } = render(<IngredientsTable subProduct={subProduct} />);
    const rows = container.querySelectorAll('tbody tr');
    expect(rows[0]?.className).toContain('bg-creme');
    expect(rows[1]?.className).toContain('bg-creme-warm/40');
  });

  it('trie par % décroissant (Kolenda §11 transparence)', () => {
    const ingredients = [
      { name: 'Low', inci: 'L', function: 'f', origin: 'o', concentrationPct: 1 },
      { name: 'High', inci: 'H', function: 'f', origin: 'o', concentrationPct: 60 },
      { name: 'Mid', inci: 'M', function: 'f', origin: 'o', concentrationPct: 12 },
    ];
    const { container } = render(
      <IngredientsTable ingredients={ingredients} subProductId="test" />,
    );
    const cells = container.querySelectorAll('tbody tr th');
    expect(cells[0]?.textContent).toBe('High');
    expect(cells[1]?.textContent).toBe('Mid');
    expect(cells[2]?.textContent).toBe('Low');
  });

  it('affiche « — » si concentrationPct absent', () => {
    render(
      <IngredientsTable
        ingredients={[
          { name: 'X', inci: 'X', function: 'f', origin: 'o' },
        ]}
        subProductId="test"
      />,
    );
    expect(screen.getByText('—')).toBeDefined();
  });
});

describe('IngredientsTable — a11y', () => {
  it('respecte axe', async () => {
    const { container } = render(<IngredientsTable subProduct={subProduct} />);
    await expectNoAxeViolations(container);
  }, 15000);

  it('role="region" + aria-label présents', () => {
    render(<IngredientsTable subProduct={subProduct} />);
    const region = screen.getByRole('region', { name: /Composition/ });
    expect(region).toBeDefined();
    expect(region.getAttribute('tabindex')).toBe('0');
  });
});
