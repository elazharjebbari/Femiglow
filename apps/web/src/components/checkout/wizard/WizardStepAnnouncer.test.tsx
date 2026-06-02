/**
 * OWBS F08-S13 — WizardStepAnnouncer (annonce a11y du changement d'étape).
 */
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { WizardStepAnnouncer } from './WizardStepAnnouncer';
import { expectNoAxeViolations } from '@/test/axe';

describe('WizardStepAnnouncer (OWBS F08)', () => {
  it('est une région live polie portant le libellé courant', () => {
    render(<WizardStepAnnouncer label="Adresse" />);
    const region = screen.getByTestId('wizard-step-announcer');
    expect(region).toHaveAttribute('role', 'status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveTextContent('Adresse');
  });

  it('met à jour le contenu quand l\'étape change (mécanisme d\'annonce)', () => {
    const { rerender } = render(<WizardStepAnnouncer label="Vos coordonnées" />);
    expect(screen.getByTestId('wizard-step-announcer')).toHaveTextContent('Vos coordonnées');
    rerender(<WizardStepAnnouncer label="Adresse" />);
    expect(screen.getByTestId('wizard-step-announcer')).toHaveTextContent('Adresse');
  });

  it('est visuellement masqué (sr-only) mais présent dans le DOM', () => {
    render(<WizardStepAnnouncer label="Adresse" />);
    expect(screen.getByTestId('wizard-step-announcer')).toHaveClass('sr-only');
  });

  it('axe 0 violation', async () => {
    const { container } = render(<WizardStepAnnouncer label="Adresse" />);
    await expectNoAxeViolations(container);
  });
});
