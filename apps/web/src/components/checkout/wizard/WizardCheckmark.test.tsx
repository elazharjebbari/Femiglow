/**
 * Tests `WizardCheckmark` — Server Component pur.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { WizardCheckmark } from './WizardCheckmark';

afterEach(() => cleanup());

describe('WizardCheckmark', () => {
  it('rend ✓ si visible=true', () => {
    render(<WizardCheckmark visible />);
    expect(screen.getByTestId('wizard-checkmark').textContent).toBe('✓');
  });

  it('retourne null si visible=false', () => {
    const { container } = render(<WizardCheckmark visible={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('aria-hidden="true"', () => {
    render(<WizardCheckmark visible />);
    expect(
      screen.getByTestId('wizard-checkmark').getAttribute('aria-hidden'),
    ).toBe('true');
  });

  it('classes text-sauge-dark + motion-safe:animate-fade-in', () => {
    render(<WizardCheckmark visible />);
    const el = screen.getByTestId('wizard-checkmark');
    expect(el.className).toContain('text-sauge-dark');
    expect(el.className).toContain('motion-safe:animate-fade-in');
  });

  it('propage className additionnelle', () => {
    render(<WizardCheckmark visible className="custom-cls" />);
    expect(
      screen.getByTestId('wizard-checkmark').className.includes('custom-cls'),
    ).toBe(true);
  });
});
