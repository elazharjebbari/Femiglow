import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorBanner } from './ErrorBanner';
import { expectNoAxeViolations } from '@/test/axe';

describe('ErrorBanner', () => {
  it('expose role=alert et aria-live=assertive', () => {
    render(
      <ErrorBanner title="Le paiement n’a pas abouti." description="Réessayez." />,
    );
    const alert = screen.getByRole('alert');
    expect(alert).toHaveAttribute('aria-live', 'assertive');
    expect(alert).toHaveTextContent(/le paiement/i);
  });

  it('appelle onDismiss au clic Fermer', async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<ErrorBanner title="Erreur." onDismiss={onDismiss} />);
    await user.click(screen.getByRole('button', { name: /fermer/i }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('respecte axe', async () => {
    const { container } = render(
      <ErrorBanner title="Erreur." description="Réessayez." />,
    );
    await expectNoAxeViolations(container);
  });
});
