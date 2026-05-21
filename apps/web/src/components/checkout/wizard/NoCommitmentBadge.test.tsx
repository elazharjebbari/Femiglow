/**
 * Tests `NoCommitmentBadge` — Server Component pur.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

import { NoCommitmentBadge } from './NoCommitmentBadge';

afterEach(() => cleanup());

describe('NoCommitmentBadge', () => {
  it('rend label par défaut « Aucun paiement maintenant »', () => {
    render(<NoCommitmentBadge />);
    expect(
      screen.getByTestId('wizard-no-commitment-badge').textContent,
    ).toContain('Aucun paiement maintenant');
  });

  it('rend sub par défaut « Vous payez à la livraison, en main »', () => {
    render(<NoCommitmentBadge />);
    expect(
      screen.getByTestId('wizard-no-commitment-badge').textContent,
    ).toContain('Vous payez à la livraison');
  });

  it('override label via prop', () => {
    render(<NoCommitmentBadge label="Custom label" />);
    expect(
      screen.getByTestId('wizard-no-commitment-badge').textContent,
    ).toContain('Custom label');
  });

  it('override sub via prop', () => {
    render(<NoCommitmentBadge sub="Custom sub" />);
    expect(
      screen.getByTestId('wizard-no-commitment-badge').textContent,
    ).toContain('Custom sub');
  });

  it('aria-label + role="note"', () => {
    render(<NoCommitmentBadge />);
    const el = screen.getByTestId('wizard-no-commitment-badge');
    expect(el.getAttribute('role')).toBe('note');
    expect(el.getAttribute('aria-label')).toContain('engagement');
  });

  it('icône cadenas SVG aria-hidden', () => {
    render(<NoCommitmentBadge />);
    const svg = screen
      .getByTestId('wizard-no-commitment-badge')
      .querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
  });

  it('classes sauge correctes', () => {
    render(<NoCommitmentBadge />);
    const el = screen.getByTestId('wizard-no-commitment-badge');
    expect(el.className).toContain('border-sauge-dark/25');
    expect(el.className).toContain('bg-sauge-soft/40');
  });
});
