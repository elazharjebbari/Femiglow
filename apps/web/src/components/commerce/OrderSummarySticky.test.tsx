import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OrderSummarySticky } from './OrderSummarySticky';
import { expectNoAxeViolations } from '@/test/axe';

const items = [
  {
    productId: 'pot',
    productSlug: 'pot',
    productName: 'Pot d’or',
    unitPriceCents: 25000,
    quantity: 2,
  },
];

function valueOf(label: RegExp) {
  const dt = screen.getByText(label);
  const dd = dt.parentElement?.querySelector('dd');
  return dd?.textContent ?? '';
}

describe('OrderSummarySticky', () => {
  it('affiche sous-total / livraison / total', () => {
    render(
      <OrderSummarySticky
        items={items}
        subtotalCents={50000}
        shippingCents={4000}
        totalCents={54000}
      />,
    );
    expect(screen.getByText(/^sous-total$/i)).toBeInTheDocument();
    expect(screen.getByText(/^livraison$/i)).toBeInTheDocument();
    expect(screen.getByText(/^total$/i)).toBeInTheDocument();
    expect(valueOf(/^sous-total$/i)).toMatch(/500\s?MAD/);
    expect(valueOf(/^livraison$/i)).toMatch(/40\s?MAD/);
    expect(valueOf(/^total$/i)).toMatch(/540\s?MAD/);
  });

  it('respecte axe', async () => {
    const { container } = render(
      <OrderSummarySticky
        items={items}
        subtotalCents={50000}
        shippingCents={4000}
        totalCents={54000}
      />,
    );
    await expectNoAxeViolations(container);
  });
});
