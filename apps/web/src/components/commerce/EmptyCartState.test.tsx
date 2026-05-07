import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyCartState } from './EmptyCartState';
import { expectNoAxeViolations } from '@/test/axe';

describe('EmptyCartState', () => {
  it('rend un h2 « Le panier est vide. » et un CTA vers /rituel', () => {
    render(<EmptyCartState />);
    expect(
      screen.getByRole('heading', { level: 2, name: /panier est vide/i }),
    ).toBeInTheDocument();
    const cta = screen.getByRole('link', { name: /d\u00e9couvrir le rituel/i });
    expect(cta).toHaveAttribute('href', '/rituel');
  });

  it('respecte axe', async () => {
    const { container } = render(<EmptyCartState />);
    await expectNoAxeViolations(container);
  });
});
