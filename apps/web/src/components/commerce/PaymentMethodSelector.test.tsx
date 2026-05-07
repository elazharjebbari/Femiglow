import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaymentMethodSelector } from './PaymentMethodSelector';
import { expectNoAxeViolations } from '@/test/axe';

describe('PaymentMethodSelector', () => {
  it('affiche COD en première position', () => {
    render(
      <PaymentMethodSelector name="paymentMethod" value="cod" onChange={() => {}} />,
    );
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('value', 'cod');
    expect(radios[1]).toHaveAttribute('value', 'card');
    expect(radios[2]).toHaveAttribute('value', 'cmi');
  });

  it('appelle onChange quand on coche carte', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <PaymentMethodSelector name="paymentMethod" value="cod" onChange={onChange} />,
    );
    await user.click(screen.getByLabelText(/carte bancaire/i));
    expect(onChange).toHaveBeenCalledWith('card');
  });

  it('respecte axe', async () => {
    const { container } = render(
      <PaymentMethodSelector name="paymentMethod" value="cod" onChange={() => {}} />,
    );
    await expectNoAxeViolations(container);
  });
});
