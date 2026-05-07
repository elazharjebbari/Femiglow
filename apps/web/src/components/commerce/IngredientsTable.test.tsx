import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IngredientsTable } from './IngredientsTable';
import { mockKitPageContent } from '@/data/mock/kit';
import { expectNoAxeViolations } from '@/test/axe';

const subProduct = mockKitPageContent.composition[0]!;

describe('IngredientsTable', () => {
  it('rend un nom de sous-produit en figcaption', () => {
    render(<IngredientsTable subProduct={subProduct} />);
    expect(screen.getByText(new RegExp(subProduct.name))).toBeInTheDocument();
  });

  it('rend une ligne par ingrédient avec scope row', () => {
    render(<IngredientsTable subProduct={subProduct} />);
    subProduct.ingredients.forEach((ing) => {
      const cell = screen.getByRole('rowheader', { name: ing.name });
      expect(cell).toHaveAttribute('scope', 'row');
    });
  });

  it('expose les certifications', () => {
    render(<IngredientsTable subProduct={subProduct} />);
    subProduct.certifications.forEach((c) => {
      expect(
        screen.getByText(new RegExp(`${c.label} — ${c.body}`)),
      ).toBeInTheDocument();
    });
  });

  it('respecte axe', async () => {
    const { container } = render(<IngredientsTable subProduct={subProduct} />);
    await expectNoAxeViolations(container);
  });
});
