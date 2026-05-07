import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProgressBar3Steps } from './ProgressBar3Steps';
import { expectNoAxeViolations } from '@/test/axe';

const labels = ['Informations', 'Livraison', 'Paiement'] as const;

describe('ProgressBar3Steps', () => {
  it('annonce la progression via aria-valuenow', () => {
    render(<ProgressBar3Steps currentStep={1} labels={labels} />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '2');
    expect(bar).toHaveAttribute('aria-valuemin', '1');
    expect(bar).toHaveAttribute('aria-valuemax', '3');
  });

  it('appelle onStepClick uniquement pour les étapes passées', async () => {
    const user = userEvent.setup();
    const onStepClick = vi.fn();
    render(
      <ProgressBar3Steps
        currentStep={2}
        labels={labels}
        onStepClick={onStepClick}
      />,
    );
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    await user.click(buttons[0]!);
    expect(onStepClick).toHaveBeenCalledWith(0);
  });

  it('respecte axe', async () => {
    const { container } = render(
      <ProgressBar3Steps currentStep={0} labels={labels} />,
    );
    await expectNoAxeViolations(container);
  });
});
