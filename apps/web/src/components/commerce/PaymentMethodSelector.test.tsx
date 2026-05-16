import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { expectNoAxeViolations } from '@/test/axe';

describe('PaymentMethodSelector', () => {
  it('affiche COD en première position et les autres désactivés', () => {
    render(
      <PaymentMethodSelector name="paymentMethod" value="cod" onChange={() => {}} />,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('value', 'cod');
    expect(radios[0]).not.toBeDisabled();
    expect(radios[1]).toBeDisabled(); // carte bancaire — bientôt disponible
    expect(radios[2]).toBeDisabled(); // CMI — bientôt disponible
  });

  it('appelle onChange quand on coche COD', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PaymentMethodSelector name="paymentMethod" value="card" onChange={onChange} />,
    );
    await user.click(screen.getByLabelText(/paiement à la livraison/i));
    expect(onChange).toHaveBeenCalledWith('cod');
  });

  it('respecte axe', async () => {
    const { container } = render(
      <PaymentMethodSelector name="paymentMethod" value="cod" onChange={() => {}} />,
    );
    await expectNoAxeViolations(container);
  });
});