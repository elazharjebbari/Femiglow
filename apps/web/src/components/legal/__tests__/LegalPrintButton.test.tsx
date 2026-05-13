import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { LegalPrintButton } from '../LegalPrintButton';

describe('LegalPrintButton', () => {
  it('appelle window.print au clic', async () => {
    const printSpy = vi.fn();
    vi.stubGlobal('print', printSpy);
    const user = userEvent.setup();
    render(<LegalPrintButton />);
    await user.click(screen.getByRole('button', { name: /Imprimer/i }));
    expect(printSpy).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('a un aria-label explicite', () => {
    render(<LegalPrintButton />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-label', expect.stringMatching(/PDF/));
  });

  it('a un focus-visible outline', () => {
    render(<LegalPrintButton />);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('focus-visible:outline');
  });
});
